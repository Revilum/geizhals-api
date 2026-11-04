'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const updater = require('../lib/filter-updater');

const filterPage = '<div class="xf_tr"><div class="xf_th">Manufacturer:</div><div class="xf_td">'
  + '<a href="/?xf=1_AMD"><span class="xf_v">AMD</span></a></div></div>';
const leaf = '<div class="mocat-item"><a href="/?cat=cpu">Processors</a></div>';
const destination = dir => path.join(dir, 'hardware-m1', 'cpus-o2', 'cat.cpu.json');

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-filter-integrity-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

function fetchFixture(overrides = {}) {
  const pages = {
    '/': '<a class="nav-m-link" href="/?m=1">Hardware</a>',
    'm:1': '<div class="mocat-item"><a href="/?o=2">CPUs</a></div>',
    'o:2': leaf, 'cat:cpu': filterPage, ...overrides
  };
  return async url => {
    const query = new URL(url).searchParams;
    const key = ['m', 'o', 'cat'].filter(param => query.has(param)).map(param => param + ':' + query.get(param))[0] || '/';
    assert.ok(Object.hasOwn(pages, key), 'Unexpected fixture request: ' + key);
    return pages[key];
  };
}

test('invalid prior tokens abort all prepared catalog updates without rewriting originals', async t => {
  const directory = temporary(t);
  const first = destination(directory);
  const second = path.join(path.dirname(first), 'cat.later.json');
  fs.mkdirSync(path.dirname(first), {recursive: true});
  fs.writeFileSync(first, '{"manufacturer":{"amd":"1_OLD"}}');
  const original = fs.readFileSync(first, 'utf8');
  for (const invalid of ['bad', '1_AMD~', '1_hello\nworld', '1_' + 'x'.repeat(2048)]) {
    const corrupt = JSON.stringify({manufacturer: {amd: invalid}});
    fs.writeFileSync(second, corrupt);
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({
      'o:2': leaf.replace('</div>', '<a href="/?cat=later">Later</a></div>'), 'cat:later': filterPage
    })}), /Existing catalog is malformed/);
    assert.equal(fs.readFileSync(first, 'utf8'), original);
    assert.equal(fs.readFileSync(second, 'utf8'), corrupt);
    assert.deepEqual(fs.readdirSync(path.dirname(first)).sort(), ['cat.cpu.json', 'cat.later.json']);
  }
});

test('prior normalized group and choice collisions reject before a refresh writes', async t => {
  const directory = temporary(t);
  const file = destination(directory);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  for (const prior of [
    {Manufacturer: {amd: '1_AMD'}, manufacturer: {intel: '1_Intel'}},
    {manufacturer: {AMD: '1_AMD', 'AMD!': '1_AMD'}}
  ]) {
    const original = JSON.stringify(prior);
    fs.writeFileSync(file, original);
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()}), /Ambiguous/);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
});

test('merging canonical labels preserves original unambiguous prior spelling and valid values', () => {
  const prior = {GPU_Memory: {'Long_Choice': '1_OLD', retained: ' 2_safe~3_value '}};
  assert.deepEqual(updater.mergeCatalog(prior, {'gpu-memory': {'long-choice': '1_NEW'}}), {
    GPU_Memory: {Long_Choice: '1_NEW', retained: ' 2_safe~3_value '}
  });
});

test('a canonical refresh matches legacy label spelling without a false retained-choice report', async t => {
  const directory = temporary(t);
  const file = destination(directory);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify({Manufacturer: {AMD: '1_OLD'}}));
  const result = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()});
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {Manufacturer: {AMD: '1_AMD'}});
  assert.equal(result.partial, false);
});

test('ambiguous parent directory labels and IDs cannot overwrite the same staged destination', async t => {
  const directory = temporary(t);
  const file = destination(directory);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, 'original sentinel');
  await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({
    '/': '<a class="nav-m-link" href="/?m=2">Hardware m1</a><a class="nav-m-link" href="/?m=1-m2">Hardware</a>',
    'm:2': '<div class="mocat-item"><a href="/?o=2">CPUs</a></div>',
    'm:1-m2': '<div class="mocat-item"><a href="/?o=2">CPUs</a></div>'
  })}), /Ambiguous catalog destination/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'original sentinel');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['cat.cpu.json']);
});

test('new category filenames distinguish colliding label-ID suffixes and survive leaf label changes', async t => {
  const directory = temporary(t);
  const pages = {
    'o:2': '<div class="mocat-item"><a href="/?cat=b">One A</a><a href="/?cat=a-b">One</a></div>',
    'cat:b': filterPage, 'cat:a-b': filterPage.replace('1_AMD', '1_Other')
  };
  const first = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture(pages)});
  assert.deepEqual(first.files, ['hardware-m1/cpus-o2/cat.a-b.json', 'hardware-m1/cpus-o2/cat.b.json']);
  const {resolveFilterFile, filterValues} = require('../getURL');
  for (const [cat, expected] of [['b', '1_AMD'], ['a-b', '1_Other']]) {
    const file = resolveFilterFile({filterDir: directory, cat});
    assert.deepEqual(filterValues({manufacturer: 'amd'}, file), [expected]);
  }
  const repeat = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({
    ...pages, 'o:2': pages['o:2'].replace('One A', 'Renamed leaf')
  })});
  assert.deepEqual(repeat.files, first.files);
  assert.equal(repeat.changed, 0);
});

test('legacy catalogs require deliberate migration and leave the entire batch untouched', async t => {
  for (const name of ['later-later.json', 'later.json', 'earlier-label-later.json']) {
    const directory = temporary(t);
    const first = destination(directory);
    const legacy = path.join(path.dirname(first), name);
    fs.mkdirSync(path.dirname(first), {recursive: true});
    const original = '{"manufacturer":{"amd":"1_OLD"}}';
    fs.writeFileSync(first, original);
    fs.writeFileSync(legacy, '{"manufacturer":{"kept":"2_retained"}}');
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({
      'o:2': leaf.replace('</div>', '<a href="/?cat=later">Later</a></div>'), 'cat:later': filterPage
    })}), /Legacy catalog.*migration|Ambiguous catalog identity/);
    assert.equal(fs.readFileSync(first, 'utf8'), original);
    assert.equal(fs.readFileSync(legacy, 'utf8'), '{"manufacturer":{"kept":"2_retained"}}');
    assert.deepEqual(fs.readdirSync(path.dirname(first)).sort(), ['cat.cpu.json', name]);
  }
});

test('an existing identity-safe destination is authoritative while legacy files remain untouched', async t => {
  const directory = temporary(t);
  const file = destination(directory);
  const legacy = path.join(path.dirname(file), 'processors-cpu.json');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '{"manufacturer":{"amd":"1_OLD"}}');
  fs.writeFileSync(legacy, 'legacy sentinel');
  const result = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()});
  assert.equal(result.changed, 1);
  assert.equal(fs.readFileSync(legacy, 'utf8'), 'legacy sentinel');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {manufacturer: {amd: '1_AMD'}});
});

test('exact category duplicates stop updates even when the intended destination exists', async t => {
  for (const relative of ['hardware-m1/cpus-o2/cpu.json', 'renamed-parent/cat.cpu.json', 'renamed-parent/cpu.json']) {
    const directory = temporary(t);
    const file = destination(directory);
    const duplicate = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.mkdirSync(path.dirname(duplicate), {recursive: true});
    fs.writeFileSync(file, '{"manufacturer":{"amd":"1_OLD"}}');
    fs.writeFileSync(duplicate, 'unparsed duplicate sentinel');
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()}), /Ambiguous catalog identity/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{"manufacturer":{"amd":"1_OLD"}}');
    assert.equal(fs.readFileSync(duplicate, 'utf8'), 'unparsed duplicate sentinel');
  }
});

test('catalogs under renamed parents cannot be silently replaced with a new incomplete catalog', async t => {
  for (const name of ['cat.cpu.json', 'cpu.json', 'old-label-cpu.json']) {
    const directory = temporary(t);
    const legacy = path.join(directory, 'previous-parent', 'old-subcategory', name);
    fs.mkdirSync(path.dirname(legacy), {recursive: true});
    fs.writeFileSync(legacy, 'preserved original bytes');
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()}), /Ambiguous catalog identity|Legacy catalog.*migration/);
    assert.equal(fs.readFileSync(legacy, 'utf8'), 'preserved original bytes');
    assert.equal(fs.existsSync(destination(directory)), false);
  }
});

test('filename validation does not parse unrelated JSON contents', async t => {
  const directory = temporary(t);
  const unrelated = path.join(directory, 'unrelated.json');
  fs.writeFileSync(unrelated, 'unparsed unrelated sentinel');
  const result = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()});
  assert.equal(result.changed, 1);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'unparsed unrelated sentinel');
});

test('one exact category cannot be staged under two different parent directories', async t => {
  const directory = temporary(t);
  await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({
    '/': '<a class="nav-m-link" href="/?m=1">Hardware</a><a class="nav-m-link" href="/?m=2">Electronics</a>',
    'm:2': '<div class="mocat-item"><a href="/?o=2">CPUs</a></div>'
  })}), /Ambiguous catalog identity/);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('filename scan respects the entry budget before writing and skips symlinks', async t => {
  const directory = temporary(t);
  const readdir = fs.readdirSync;
  fs.readdirSync = (location, options) => location === directory && options?.withFileTypes
    ? Array.from({length: 10001}, (_, index) => ({
      name: 'entry-' + index, isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false
    })) : readdir(location, options);
  try {
    await assert.rejects(updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()}), /filename scan limit/);
  } finally { fs.readdirSync = readdir; }
  assert.deepEqual(fs.readdirSync(directory), []);

  fs.readdirSync = (location, options) => location === directory && options?.withFileTypes
    ? [{name: 'unfollowed-link', isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false}]
    : readdir(location, options);
  try {
    const result = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture()});
    assert.equal(result.changed, 1);
  } finally { fs.readdirSync = readdir; }
});

test('malformed href-selected navigation is reported incomplete without explicit navigation classes', async t => {
  for (const [param, page, malformed] of [
    ['cat', 'o:2', '<div class="mocat-item"><a href="http://[/?cat=lost">Lost</a></div>'],
    ['o', 'm:1', '<div class="mocat-item"><a href="http://[/?o=lost">Lost</a></div>']
  ]) {
    const original = param === 'cat' ? leaf : '<div class="mocat-item"><a href="/?o=2">CPUs</a></div>';
    const result = await updater.refreshFilters({outputDir: temporary(t), delayMs: 0, fetchPage: fetchFixture({[page]: original + malformed})});
    assert.equal(result.parsed, 1);
    assert.deepEqual(result.partialReasons, ['invalid-navigation']);
  }
});

test('rejected navigation candidates report partial coverage alongside valid leaves', async t => {
  for (const rejected of [
    '<a class="nav-cat-link" href="/?cat=bad%2Fid">Bad ID</a>',
    '<a class="nav-cat-link" href="https://example.test/?cat=outside">Outside</a>',
    '<a class="nav-cat-link" href="/?cat=missing-label"></a>',
    '<a class="nav-cat-link">Missing URL</a>',
    '<a class="nav-cat-link" href="/?cat=first&amp;cat=second">Ambiguous ID</a>'
  ]) {
    const result = await updater.refreshFilters({outputDir: temporary(t), delayMs: 0, fetchPage: fetchFixture({'o:2': leaf + rejected})});
    assert.equal(result.parsed, 1);
    assert.equal(result.partial, true);
    assert.deepEqual(result.partialReasons, ['invalid-navigation']);
  }
});

test('rejected filter candidates report partial coverage without discarding valid choices', async t => {
  for (const rejected of [
    '<a href="/?xf=bad"><span class="xf_v">Bad token</span></a>',
    '<a href="https://example.test/?xf=1_other"><span class="xf_v">Outside</span></a>',
    '<a href="/?xf=1_other"><span class="xf_v"></span></a>',
    '<a href="/?xf=1_other">Missing value markup</a>',
    '<a href="http://[/?xf=1_other">Malformed filter URL without value markup</a>',
    '<a><span class="xf_v">Missing URL</span></a>'
  ]) {
    const directory = temporary(t);
    const html = filterPage.replace('</div></div>', rejected + '</div></div>');
    const result = await updater.refreshFilters({outputDir: directory, delayMs: 0, fetchPage: fetchFixture({'cat:cpu': html})});
    assert.equal(result.partial, true);
    assert.deepEqual(result.partialReasons, ['invalid-filter-page']);
    assert.deepEqual(JSON.parse(fs.readFileSync(destination(directory), 'utf8')), {manufacturer: {amd: '1_AMD'}});
  }
});

test('unrelated controls, service links and duplicate valid navigation do not imply incomplete coverage', async t => {
  const result = await updater.refreshFilters({outputDir: temporary(t), delayMs: 0, fetchPage: fetchFixture({
    'o:2': leaf + leaf + '<a class="mocat-item__link" href="/?o=2">Back</a>'
      + '<a class="nav-cat-link" href="/?cat=services&amp;services=yes">Services</a>'
      + '<a class="nav-cat-link" href="/?cat=more">More</a>',
    'cat:cpu': filterPage.replace('</div></div>', '<a href="#expanded">More</a></div></div>')
      + '<div class="xf_tr xf_tr_collapse_controls"><a>Expand</a></div>'
  })});
  assert.equal(result.partial, false);
  assert.deepEqual(result.partialReasons, []);
});

test('a failed rename preserves the original destination and removes its temporary file', t => {
  const directory = temporary(t);
  const file = path.join(directory, 'catalog.json');
  fs.writeFileSync(file, 'original bytes');
  const rename = fs.renameSync;
  const failure = Object.assign(new Error('Simulated rename failure'), {code: 'EACCES'});
  fs.renameSync = () => { throw failure; };
  try {
    assert.throws(() => updater.writeIfChanged(file, {manufacturer: {amd: '1_AMD'}}), error => error === failure);
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(file, 'utf8'), 'original bytes');
  assert.deepEqual(fs.readdirSync(directory), ['catalog.json']);
});
