'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const updater = require('../lib/filter-updater');
const {parseOptions} = require('../update-filters');

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-filter-safety-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}
function filters(choices = [['AMD', '7781_AMD']]) {
  return '<div class="xf_tr"><div class="xf_th">Manufacturer:</div><div class="xf_td">'
    + choices.map(([label, value]) => '<a href="/?xf=' + encodeURIComponent(value) + '"><span class="xf_v">' + label + '</span></a>').join('')
    + '</div></div>';
}
const home = '<a class="nav-m-link" href="/?m=1">Hardware</a>';
const subs = '<div class="mocat-item"><a href="/?o=5">CPUs</a></div>';
const leaf = '<div class="mocat-item"><a href="/?cat=cpuamdam4">AMD processors</a></div>';
function fixture(overrides = {}, calls = []) {
  const pages = {'/': home, 'm:1': subs, 'o:5': leaf, 'cat:cpuamdam4': filters(), ...overrides};
  return async url => {
    calls.push(url);
    const parsed = new URL(url);
    const key = ['m', 'o', 'cat'].filter(p => parsed.searchParams.has(p)).map(p => p + ':' + parsed.searchParams.get(p))[0] || '/';
    const value = pages[key];
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error('Fixture URL not found: ' + key);
    return value;
  };
}
const destination = dir => path.join(dir, 'hardware-m1', 'cpus-o5', 'amd-processors-cpuamdam4.json');

for (const status of [401, 403, 429]) {
  test('HTTP ' + status + ' stops after the first blocked page, before any staged write', async t => {
    const dir = temporary(t);
    const original = {manufacturer: {old: '7781_Old'}};
    fs.mkdirSync(path.dirname(destination(dir)), {recursive: true});
    fs.writeFileSync(destination(dir), JSON.stringify(original));
    const before = fs.readFileSync(destination(dir), 'utf8');
    const blocked = Object.assign(new Error('blocked'), {response: {status}});
    const calls = [];
    const fetchPage = fixture({
      'o:5': leaf.replace('</div>', '<a href="/?cat=blocked">Blocked</a><a href="/?cat=never">Never fetched</a></div>'),
      'cat:blocked': blocked
    }, calls);
    await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage, delayMs: 0}),
      error => error.code === 'ERR_UPSTREAM_BLOCKED' && error.status === status);
    assert.equal(calls.length, 5);
    assert.ok(!calls.some(url => url.includes('never')));
    assert.equal(fs.readFileSync(destination(dir), 'utf8'), before);
    assert.deepEqual(fs.readdirSync(path.dirname(destination(dir))), ['amd-processors-cpuamdam4.json']);
  });
}

test('invalid library budgets fail before any fetch', async t => {
  let calls = 0;
  const dir = temporary(t);
  for (const options of [
    {maxPages: NaN}, {maxPages: Infinity}, {maxPages: 0}, {maxPages: 301},
    {maxPages: '10'}, {maxPages: 1.5}, {delayMs: -1}, {delayMs: Infinity},
    {categoryLimit: 0}, {subcategoryLimit: NaN}, {categoryOffset: -1},
    {subcategoryOffset: '0'}, {finalCategoryOffset: -1}, {finalCategoryLimit: 0},
    {now: NaN}, {now: -1}, {outputDir: ''}
  ]) {
    await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage: async () => { calls++; return home; }, ...options}));
  }
  assert.equal(calls, 0);
  await assert.rejects(updater.refreshFilters({outputDir: dir, delayMs: 0}), /delayMs/);
});

test('crawler refuses userinfo, arbitrary ports, insecure schemes and lookalikes', () => {
  for (const url of ['https://name:secret@geizhals.de/', 'https://geizhals.de:8000/', 'http://geizhals.de/', 'https://geizhals.de.evil.example/']) {
    assert.throws(() => updater.geizhalsUrl(url), /Only HTTPS/);
  }
  assert.equal(updater.geizhalsUrl('https://geizhals.de:443/'), 'https://geizhals.de/');
});

test('fetchHtml bounds responses and exposes a denied status to the crawler', async () => {
  let options;
  const client = {get: async (_, opts) => { options = opts; return {status: 200, data: '<html/>'}; }};
  assert.equal(await updater.fetchHtml('/', {client}), '<html/>');
  assert.equal(options.maxRedirects, 0);
  assert.equal(options.maxContentLength, 5 * 1024 * 1024);
  await assert.rejects(updater.fetchHtml('/', {client: {get: async () => ({status: 429, data: 'blocked'})}}), error => error.status === 429);
  await assert.rejects(updater.fetchHtml('/', {client: {get: async () => ({status: 200, data: {error: 'not HTML'}})}}), /HTML/);
});

test('maintenance fetch rejects explicit non-HTML media before parsing markup', async () => {
  for (const contentType of ['application/json', 'image/svg+xml', 'application/pdf']) {
    await assert.rejects(updater.fetchHtml('/', {client: {get: async () => ({
      status: 200, headers: {'content-type': contentType}, data: filters()
    })}}), /HTML/);
  }
  for (const contentType of ['text/html; charset=utf-8', 'application/xhtml+xml', 'text/plain']) {
    assert.equal(await updater.fetchHtml('/', {client: {get: async () => ({
      status: 200, headers: {'content-type': contentType}, data: filters()
    })}}), filters());
  }
});

test('incomplete filter pages retain previous groups and choices', async t => {
  const dir = temporary(t);
  const previous = {manufacturer: {amd: '7781_OLD_AMD', intel: '7781_Intel'}, memory: {'16': '132_16384'}};
  fs.mkdirSync(path.dirname(destination(dir)), {recursive: true});
  fs.writeFileSync(destination(dir), JSON.stringify(previous));
  const result = await updater.refreshFilters({outputDir: dir, fetchPage: fixture(), delayMs: 0});
  const value = JSON.parse(fs.readFileSync(destination(dir), 'utf8'));
  assert.equal(value.manufacturer.amd, '7781_AMD');
  assert.equal(value.manufacturer.intel, '7781_Intel');
  assert.deepEqual(value.memory, previous.memory);
  assert.equal(result.changed, 1);
  assert.equal(result.partial, true);
  assert.deepEqual(result.partialReasons, ['retained-existing-choices']);
  assert.ok(!fs.readdirSync(path.dirname(destination(dir))).some(name => name.includes('.tmp-')));
});

test('a complete refresh reports full coverage when no prior choice is retained', async t => {
  const dir = temporary(t);
  const first = await updater.refreshFilters({outputDir: dir, fetchPage: fixture(), delayMs: 0});
  const second = await updater.refreshFilters({outputDir: dir, fetchPage: fixture(), delayMs: 0});
  assert.equal(first.partial, false);
  assert.equal(second.partial, false);
  assert.equal(second.changed, 0);
  assert.deepEqual(second.partialReasons, []);
});

test('generated filenames preserve exact category IDs for public catalog lookup', async t => {
  const dir = temporary(t);
  const {resolveFilterFile} = require('../getURL');
  const ids = ['Mixed_Case', 'a'.repeat(65) + 'first', 'a'.repeat(65) + 'second'];
  const pages = {'o:5': '<div class="mocat-item">'
    + ids.map(id => '<a href="/?cat=' + id + '">Shared label</a>').join('') + '</div>'};
  for (const [index, id] of ids.entries()) pages['cat:' + id] = filters([['Choice', '1_' + index]]);
  const result = await updater.refreshFilters({outputDir: dir, fetchPage: fixture(pages), delayMs: 0});
  assert.equal(result.parsed, ids.length);
  assert.equal(result.files.length, ids.length);
  for (const [index, id] of ids.entries()) {
    const file = resolveFilterFile({filterDir: dir, cat: id});
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).manufacturer.choice, '1_' + index);
  }
  const repeat = await updater.refreshFilters({outputDir: dir, fetchPage: fixture(pages), delayMs: 0});
  assert.equal(repeat.changed, 0);
  assert.equal(repeat.partial, false);
});

test('case-only catalog IDs abort the whole staged batch before writing', async t => {
  const dir = temporary(t);
  const pages = {'o:5': '<div class="mocat-item">'
    + '<a href="/?cat=ordinary">Ordinary</a><a href="/?cat=Foo">Same</a><a href="/?cat=foo">Same</a></div>',
  'cat:ordinary': filters(), 'cat:Foo': filters([['Choice', '1_UPPER']]), 'cat:foo': filters([['Choice', '1_lower']])};
  await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage: fixture(pages), delayMs: 0}), /catalog path casing/i);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('case-only existing catalog names are preserved and reject later refreshes', async t => {
  const dir = temporary(t);
  const existing = path.join(dir, 'hardware-m1', 'cpus-o5', 'same-Foo.json');
  const original = JSON.stringify({manufacturer: {choice: '1_UPPER'}});
  fs.mkdirSync(path.dirname(existing), {recursive: true});
  fs.writeFileSync(existing, original);
  const pages = {'o:5': '<div class="mocat-item"><a href="/?cat=foo">Same</a></div>',
    'cat:foo': filters([['Choice', '1_lower']])};
  await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage: fixture(pages), delayMs: 0}), /catalog path casing/i);
  assert.equal(fs.readFileSync(existing, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(path.dirname(existing)), ['same-Foo.json']);
});

test('case-only staged directories are rejected even when leaf filenames differ', async t => {
  const dir = temporary(t);
  const pages = {'m:1': '<div class="mocat-item"><a href="/?o=Group">CPUs</a><a href="/?o=group">CPUs</a></div>',
    'o:Group': '<div class="mocat-item"><a href="/?cat=first">First</a></div>',
    'o:group': '<div class="mocat-item"><a href="/?cat=second">Second</a></div>',
    'cat:first': filters(), 'cat:second': filters()};
  await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage: fixture(pages), delayMs: 0}), /catalog path casing/i);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('existing directory casing is checked before writing any catalog', async t => {
  const dir = temporary(t);
  const existingDirectory = path.join(dir, 'Hardware-m1', 'cpus-o5');
  fs.mkdirSync(existingDirectory, {recursive: true});
  const sentinel = path.join(existingDirectory, 'keep.json');
  fs.writeFileSync(sentinel, 'original');
  await assert.rejects(updater.refreshFilters({outputDir: dir, fetchPage: fixture(), delayMs: 0}), /catalog path casing/i);
  assert.deepEqual(fs.readdirSync(dir), ['Hardware-m1']);
  assert.deepEqual(fs.readdirSync(existingDirectory), ['keep.json']);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'original');
});

test('malformed later catalog stops the batch before an earlier catalog is changed', async t => {
  const dir = temporary(t);
  fs.mkdirSync(path.dirname(destination(dir)), {recursive: true});
  fs.writeFileSync(destination(dir), '{"manufacturer":{"old":"7781_Old"}}');
  const corrupt = path.join(path.dirname(destination(dir)), 'bad-catalog-badcat.json');
  fs.writeFileSync(corrupt, '{corrupt');
  const before = fs.readFileSync(destination(dir), 'utf8');
  await assert.rejects(updater.refreshFilters({outputDir: dir, delayMs: 0, fetchPage: fixture({
    'o:5': leaf.replace('</div>', '<a href="/?cat=badcat">Bad catalog</a></div>'),
    'cat:badcat': filters()
  })}), SyntaxError);
  assert.equal(fs.readFileSync(destination(dir), 'utf8'), before);
  assert.equal(fs.readFileSync(corrupt, 'utf8'), '{corrupt');
});

test('filter parsing supports spaces, merges groups and rejects ambiguous normalized labels', () => {
  const html = filters([['RTX 5090', '9816_RTX 5090']]) + filters([['AMD', '7781_AMD']]);
  assert.deepEqual(updater.parseFilters(html), {manufacturer: {amd: '7781_AMD', 'rtx-5090': '9816_RTX 5090'}});
  assert.throws(() => updater.parseFilters(filters([['AMD', '7781_AMD'], ['AMD!', '7781_Other']])), /Ambiguous/);
  assert.equal(updater.parseNavigation(home + '<a class="nav-m-link" href="/?m=8&services=yes">Services</a>', 'm').length, 1);
});

test('special object keys remain data rather than mutating prototypes', () => {
  const prior = JSON.parse('{"__proto__":{"safe":"1_yes"},"constructor":{"value":"2_yes"}}');
  const merged = updater.mergeCatalog(prior, {manufacturer: {amd: '7781_AMD'}});
  assert.ok(Object.hasOwn(merged, '__proto__'));
  assert.deepEqual(merged.__proto__, {safe: '1_yes'});
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal({}.safe, undefined);
});

test('subcategory and leaf limits are explicitly reported as partial coverage', async t => {
  const dir = temporary(t);
  const result = await updater.refreshFilters({outputDir: dir, delayMs: 0, subcategoryLimit: 1, finalCategoryLimit: 1, fetchPage: fixture({
    'm:1': subs.replace('</div>', '<a href="/?o=6">GPUs</a></div>'),
    'o:5': leaf.replace('</div>', '<a href="/?cat=second">Second</a></div>')
  })});
  assert.equal(result.partial, true);
  assert.deepEqual(result.partialReasons, ['final-category-limit', 'subcategory-limit']);
});

test('rotation wraps main categories instead of silently truncating at the last one', async t => {
  const calls = [];
  const pages = {
    '/': home + '<a class="nav-m-link" href="/?m=2">Electronics</a>',
    'm:2': subs
  };
  const result = await updater.refreshFilters({outputDir: temporary(t), fetchPage: fixture(pages, calls), delayMs: 0,
    rotate: true, now: 7 * 86400000, categoryLimit: 2});
  assert.equal(result.parsed, 2);
  assert.deepEqual(calls.filter(url => new URL(url).searchParams.has('m')).map(url => new URL(url).searchParams.get('m')), ['2', '1']);
});

test('leaf offset allows later categories to be reached under a request budget', async t => {
  const calls = [];
  const result = await updater.refreshFilters({outputDir: temporary(t), delayMs: 0, maxPages: 4,
    finalCategoryOffset: 1, finalCategoryLimit: 1, fetchPage: fixture({
      'o:5': leaf.replace('</div>', '<a href="/?cat=later">Later</a></div>'),
      'cat:later': filters()
    }, calls)});
  assert.equal(result.parsed, 1);
  assert.ok(calls.at(-1).endsWith('cat=later'));
  assert.ok(!calls.some(url => url.endsWith('cat=cpuamdam4')));
});

test('CLI validates ranges, missing paths and leaf rotation options', () => {
  assert.deepEqual(parseOptions(['--final-category-offset', '2', '--final-category-limit', '1']), {finalCategoryOffset: 2, finalCategoryLimit: 1});
  for (const args of [['--max-pages', '0'], ['--max-pages', '301'], ['--max-pages', '999999999999999999999'], ['--category-limit', '0'], ['--output'], ['--output', '--dry-run']]) {
    assert.throws(() => parseOptions(args));
  }
});

test('CLI help exits cleanly without crawling or creating an output directory', t => {
  const dir = temporary(t);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../update-filters.js'), '--help'], {cwd: dir, encoding: 'utf8', timeout: 20000});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.deepEqual(fs.readdirSync(dir), []);
});
