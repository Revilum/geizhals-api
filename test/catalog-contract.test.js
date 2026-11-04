'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const api = require('..');
const updater = require('../lib/filter-updater');

function catalogFile(t, catalog) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-catalog-contract-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const file = path.join(directory, 'cpu.json');
  fs.writeFileSync(file, JSON.stringify(catalog));
  return file;
}

function row(group, choices) {
  return '<div class="xf_tr"><div class="xf_th">' + group + ':</div><div class="xf_td">'
    + choices.map(([label, query]) => '<a href="/?' + query + '"><span class="xf_v">' + label + '</span></a>').join('')
    + '</div></div>';
}

test('public filter parser preserves repeated xf parameters and choices from repeated groups', t => {
  const html = row('Memory', [['16', 'xf=132_16384&amp;xf=133_DDR5']])
    + row('Memory', [['32', 'xf=132_32768']]);
  const parsed = api.parseFilters(html);
  assert.deepEqual(parsed, {memory: {'16': '132_16384~133_DDR5', '32': '132_32768'}});
  const url = new URL(api.getURL({type: 'listing', cat: 'cpu', filterFile: catalogFile(t, parsed),
    filters: {Memory: [16, 32]}}));
  assert.equal(url.searchParams.get('xf'), '132_16384~133_DDR5~132_32768');
});

test('public filter parser combines repeated xf values from a single choice', () => {
  assert.deepEqual(api.parseFilters(row('Memory', [['16', 'xf=132_16384&amp;xf=133_DDR5']])),
    {memory: {'16': '132_16384~133_DDR5'}});
});

test('public parser rejects conflicting normalized choices and accepts repeated identical links', () => {
  assert.throws(() => api.parseFilters(row('Memory', [['DDR 5', 'xf=1_A'], ['DDR-5', 'xf=1_B']])), /Ambiguous filter label/);
  assert.throws(() => api.parseFilters(row('Memory', [['DDR 5', 'xf=1_A']])
    + row('Memory', [['DDR-5', 'xf=1_B']])), /Ambiguous filter label/);
  assert.deepEqual(api.parseFilters(row('Memory', [['DDR 5', 'xf=1_A'], ['DDR-5', 'xf=1_A']])),
    {memory: {'ddr-5': '1_A'}});
});

test('named filters reject normalized catalog group and choice ambiguity', t => {
  for (const catalog of [
    {'Memory Type': {'DDR 5': '1_A'}, 'Memory-Type': {'DDR 5': '1_B'}},
    {'Memory Type': {'DDR 5': '1_A', 'DDR-5': '1_B'}},
    {'Memory Type': {'DDR 5': '1_A', 'DDR-5': '1_A'}}
  ]) {
    assert.throws(() => api.filterValues({'Memory Type': 'DDR 5'}, catalogFile(t, catalog)), /Ambiguous filter (group|label)/);
  }
  assert.deepEqual(api.filterValues({'Memory Type': 'DDR 5'}, catalogFile(t, {'Memory-Type': {'DDR-5': '1_A'}})), ['1_A']);
});

test('public and maintenance filter catalogs resolve original long and Unicode labels', t => {
  const label = 'Very ' + 'long '.repeat(20) + 'choice';
  const html = row('Display_Στοιχεία', [[label, 'xf=1_A'], ['日本語', 'xf=2_B']]);
  for (const parseFilters of [api.parseFilters, updater.parseFilters]) {
    const file = catalogFile(t, parseFilters(html));
    const url = new URL(api.getURL({query: 'display', filterFile: file,
      filters: {'Display_Στοιχεία': [label, '日本語']}}));
    assert.equal(url.searchParams.get('xf'), '1_A~2_B');
  }
});

for (const query of ['xf=invalid', 'xf=1_A&xf=2_bad%0Avalue', 'bpmin=1&bpmin=NaN', 'bqmax=2&bqmax=-1']) {
  test('inherited parameter validation: ' + query, () => {
    assert.throws(() => api.getURL({type: 'listing', url: 'https://geizhals.at/?cat=cpu&' + query}), /token|price/i);
  });
}

test('inherited filter budgets apply and explicit replacements discard previous values', () => {
  assert.throws(() => api.getURL({type: 'listing',
    url: 'https://geizhals.at/?cat=cpu&xf=' + Array.from({length: 101}, (_, index) => index + '_A').join('~')}), /100 filter/);
  const inherited = new URL(api.getURL({type: 'listing',
    url: 'https://geizhals.at/?cat=cpu&xf=1_A&xf=2_B&bpmin=1&bqmax=2'}));
  assert.deepEqual(inherited.searchParams.getAll('xf'), ['1_A', '2_B']);
  const replaced = new URL(api.getURL({type: 'listing',
    url: 'https://geizhals.at/?cat=cpu&xf=invalid&bpmin=NaN', filters: ['1_A'], minPrice: 1}));
  assert.equal(replaced.searchParams.get('xf'), '1_A');
  assert.equal(replaced.searchParams.get('bpmin'), '1');
});

test('legacy label-ID catalog suffixes cannot select a different category', t => {
  const directory = path.dirname(catalogFile(t, {}));
  const legacy = path.join(directory, 'shared-a-foo.json');
  const original = JSON.stringify({memory: {'16': '1_otherCategory'}});
  fs.writeFileSync(legacy, original);
  for (const cat of ['foo', 'a-foo']) {
    assert.throws(() => api.getURL({type: 'listing', cat, filterDir: directory, filters: {memory: 16}}),
      /legacy.*filterFile|ambiguous.*filterFile/i);
  }
  const explicit = new URL(api.getURL({type: 'listing', cat: 'a-foo', filterDir: directory,
    filterFile: legacy, filters: {memory: 16}}));
  assert.equal(explicit.searchParams.get('xf'), '1_otherCategory');
  assert.equal(fs.readFileSync(legacy, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(directory).sort(), ['cpu.json', 'shared-a-foo.json']);
});

test('automatic catalogs use exact category identity and ignore legacy suffix candidates', t => {
  const directory = path.dirname(catalogFile(t, {}));
  for (const [filename, value] of [['cat.foo.json', '1_short'], ['cat.a-foo.json', '1_long'],
    ['shared-a-foo.json', '1_legacy'], ['plain.json', '1_plain']]) {
    fs.writeFileSync(path.join(directory, filename), JSON.stringify({memory: {'16': value}}));
  }
  for (const [cat, value] of [['foo', '1_short'], ['a-foo', '1_long'], ['plain', '1_plain']]) {
    const url = new URL(api.getURL({type: 'listing', cat, filterDir: directory, filters: {memory: 16}}));
    assert.equal(url.searchParams.get('xf'), value);
  }
  fs.copyFileSync(path.join(directory, 'cat.foo.json'), path.join(directory, 'foo.json'));
  assert.throws(() => api.resolveFilterFile({filterDir: directory, cat: 'foo'}), /exactly one.*found 2/);
});

for (const query of ['bpmin=1&bpmin=10&bqmax=5', 'bpmin=5&bqmax=10&bqmax=1']) {
  test('conflicting inherited prices fail independently of parameter order: ' + query, () => {
    assert.throws(() => api.getURL({type: 'listing', url: 'https://geizhals.at/?cat=cpu&' + query}), /Conflicting.*Price/);
  });
}

test('equivalent repeated numeric prices and explicit replacements remain valid', () => {
  const equivalent = new URL(api.getURL({type: 'listing',
    url: 'https://geizhals.at/?cat=cpu&bpmin=1&bpmin=01.00&bqmax=2&bqmax=2.0'}));
  assert.deepEqual(equivalent.searchParams.getAll('bpmin'), ['1', '01.00']);
  assert.deepEqual(equivalent.searchParams.getAll('bqmax'), ['2', '2.0']);
  const replaced = new URL(api.getURL({type: 'listing', minPrice: 3, maxPrice: 5,
    url: 'https://geizhals.at/?cat=cpu&bpmin=1&bpmin=10&bqmax=10&bqmax=1'}));
  assert.deepEqual(replaced.searchParams.getAll('bpmin'), ['3']);
  assert.deepEqual(replaced.searchParams.getAll('bqmax'), ['5']);
});

for (const query of ['m=1&m=2', 'o=1&o=2', 'cat=foo&cat=a-foo']) {
  test('conflicting inherited category values are rejected: ' + query, () => {
    assert.throws(() => api.getURL({type: 'listing', url: 'https://geizhals.at/?' + query}), /Conflicting category parameter/);
  });
}

test('identical category duplicates and explicit overrides retain an unambiguous destination', () => {
  const repeated = new URL(api.getURL({type: 'listing',
    url: 'https://geizhals.at/?m=1&m=1&o=2&o=2&cat=foo&cat=foo'}));
  for (const [key, value] of [['m', '1'], ['o', '2'], ['cat', 'foo']]) {
    assert.deepEqual(repeated.searchParams.getAll(key), [value, value]);
  }
  const replaced = new URL(api.getURL({type: 'listing', m: 3, o: 4, cat: 'chosen',
    url: 'https://geizhals.at/?m=1&m=2&o=1&o=2&cat=foo&cat=a-foo'}));
  for (const [key, value] of [['m', '3'], ['o', '4'], ['cat', 'chosen']]) {
    assert.deepEqual(replaced.searchParams.getAll(key), [value]);
  }
});
