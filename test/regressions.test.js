'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const api = require('..');

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geizhals-regression-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

for (const [text, result] of [
  ['€ 1.299', '€1299.00'], ['EUR 1.299.999', '€1299999.00'],
  ['€ 1 299,90', '€1299.90'], ['€ 1\u202f299,90', '€1299.90'],
  ['€ 1234.50', '€1234.50'], ['EUR 1,299.00', '€1299.00'],
  ['€ 0,00', '€0.00'], ['€ -3,00', null], ['EUR 12.3456', null],
  ['nicht verfügbar', null], ['€ 999999999999999999999', null]
]) {
  test('price regression: ' + text, () => assert.equal(api.parsePrice(text), result));
}

test('fetch URL policy rejects credentials, unusual ports, schemes and lookalike domains', async () => {
  for (const url of [
    'http://geizhals.de/', 'https://user:pass@geizhals.de/',
    'https://geizhals.de:8443/', 'https://geizhals.de.attacker.example/',
    'https://127.0.0.1/', 'file:///etc/passwd'
  ]) {
    assert.equal(api.isGeizhalsURL(url), false, url);
    await assert.rejects(api.getSite(url), TypeError);
    await assert.rejects(api.getFullSite(url), TypeError);
    assert.throws(() => api.getURL({url}), TypeError);
  }
  assert.equal(api.isGeizhalsURL('https://geizhals.de:443/'), true);
  assert.equal(api.isGeizhalsURL('https://www.geizhals.at/'), true);
  assert.equal(api.parseUrl('https://merchant.example/offer'), 'https://merchant.example/offer');
});

test('URL builder rejects invalid prices and reversed ranges', () => {
  for (const value of [-1, NaN, Infinity, true, [], {}, 'nan', '']) {
    assert.throws(() => api.getURL({query: 'CPU', minPrice: value}), /price/i);
  }
  assert.throws(() => api.getURL({query: 'CPU', minPrice: 500, maxPrice: 100}), /must not exceed/);
  assert.throws(() => api.getURL({query: 'CPU', url: 'https://geizhals.de/?bpmin=NaN'}), /price/i);
  assert.equal(new URL(api.getURL({query: 'CPU', minPrice: 0, maxPrice: 0})).searchParams.get('bpmin'), '0');
});

test('classification does not report arbitrary paths as top10', () => {
  assert.equal(api.detectPageType('/not-a-product'), 'unknown');
  assert.equal(api.detectPageType('/a123.html'), 'item');
  assert.equal(api.detectPageType('/'), 'top10');
  assert.throws(() => api.getURL({type: 'listing'}), /listing requires/);
  assert.throws(() => api.getURL({type: 'listing', m: '../private'}), /category/);
  assert.throws(() => api.getURL([]), /object/);
  assert.equal(api.getParam('m=1&o=4', 'o'), '4');
});

test('numeric named values use their catalog mapping instead of becoming raw tokens', t => {
  const file = path.join(temporary(t), 'memory.json');
  fs.writeFileSync(file, JSON.stringify({memory: {'16': '132_16384', '32': '132_32768'}}));
  assert.deepEqual(api.filterValues({memory: '16'}, file), ['132_16384']);
  assert.deepEqual(api.filterValues({memory: [16, 32]}, file), ['132_16384', '132_32768']);
  assert.throws(() => api.filterValues({memory: '16'}), /filterFile/);
});

test('filter strings with model-name spaces are encoded, composed and deduplicated', () => {
  const url = new URL(api.getURL({query: 'GPU', filters: ['9816_RTX 5090', '132_16384~9816_RTX 5090']}));
  assert.deepEqual(url.searchParams.getAll('xf'), ['9816_RTX 5090~132_16384']);
  assert.throws(() => api.filterValues(['1_hello\nworld']), /token/);
  assert.throws(() => api.filterValues(['']), /nonempty/);
  assert.throws(() => api.filterValues(false), /array or object/);
});

test('invalid catalogs fail clearly rather than crashing later or silently dropping filters', t => {
  const file = path.join(temporary(t), 'invalid.json');
  for (const data of [null, [], {manufacturer: null}, {manufacturer: []}]) {
    fs.writeFileSync(file, JSON.stringify(data));
    assert.throws(() => api.filterValues({manufacturer: 'AMD'}, file), /map group names/);
  }
  fs.writeFileSync(file, '{broken json');
  assert.throws(() => api.filterValues({manufacturer: 'AMD'}, file), SyntaxError);
});

test('filterDir automatically selects a unique category catalog and rejects ambiguity', t => {
  const dir = temporary(t);
  const nested = path.join(dir, 'hardware-m1', 'processors-o4');
  fs.mkdirSync(nested, {recursive: true});
  const file = path.join(nested, 'cat.cpuamdam4.json');
  fs.writeFileSync(file, JSON.stringify({memory: {'16': '132_16384'}}));
  const options = {type: 'listing', cat: 'cpuamdam4', filterDir: dir, filters: {memory: '16'}};
  assert.equal(new URL(api.getURL(options)).searchParams.get('xf'), '132_16384');
  fs.copyFileSync(file, path.join(dir, 'cpuamdam4.json'));
  assert.throws(() => api.getURL(options), /exactly one/);
  assert.doesNotThrow(() => api.getURL({...options, filterFile: file}));
});

test('regional result links stay on their original site', async () => {
  const listing = '<div class="listview__item"><a class="listview__name-link" href="/cpu-a1.html">CPU</a><img class="listview__image" src="/cpu.png"></div>';
  const result = await api.search('CPU', {url: 'https://geizhals.at/', html: listing});
  assert.equal(result[0].link, 'https://geizhals.at/cpu-a1.html');
  assert.equal(result[0].icon, 'https://geizhals.at/cpu.png');
  assert.deepEqual(await api.getListing({url: 'https://geizhals.at/', cat: 'cpuamdam4', html: listing}), result);
  const item = await api.getItem('https://geizhals.at/cpu-a1.html', {html: '<div class="offer"><a class="offer_bt" href="/offer/1"></a></div>'});
  assert.equal(item.sellers[0].link, 'https://geizhals.at/offer/1');
});

test('fetch enforces timeout, content and redirect limits even with an injected client', async () => {
  let config;
  const client = {get: async (url, options) => { config = options; return {status: 200, data: '<html/>', headers: {'content-type': 'text/html'}}; }};
  assert.equal(await api.getSite('https://geizhals.de/', {client}), '<html/>');
  assert.equal(config.maxContentLength, 5 * 1024 * 1024);
  for (const target of [
    {protocol: 'https:', hostname: 'localhost'},
    {protocol: 'http:', hostname: 'geizhals.de'},
    {protocol: 'https:', hostname: 'geizhals.de', port: 8080},
    {protocol: 'https:', hostname: 'geizhals.de', auth: 'secret'}
  ]) assert.throws(() => config.beforeRedirect(target), /Redirect/);
  assert.doesNotThrow(() => config.beforeRedirect({protocol: 'https:', hostname: 'www.geizhals.at', port: 443}));
  for (const timeout of [0, -1, Infinity, NaN, '10']) {
    await assert.rejects(api.getSite('https://geizhals.de/', {client, timeout}), /timeout/);
  }
  await assert.rejects(api.getSite('https://geizhals.de/', {client, maxBytes: 1}), /maxBytes/);
  await assert.rejects(api.getSite('https://geizhals.de/', {client: {get: async () => ({status: 403, data: 'blocked'})}}), /403/);
  await assert.rejects(api.getSite('https://geizhals.de/', {client: {get: async () => ({data: '{}', headers: {'content-type': 'application/json'}})}}), /HTML/);
});

function fakeBrowser({status = 200, finalURL = 'https://geizhals.de/', html = '<html/>', requests = [], failure, closeFailure} = {}) {
  let closed = 0;
  let handler;
  const resolutions = [];
  const page = {
    setRequestInterception: async () => {}, on: (event, fn) => { handler = fn; },
    url: () => finalURL, content: async () => html,
    goto: async () => {
      for (const {url, navigation} of requests) handler({
        url: () => url, isNavigationRequest: () => navigation,
        isInterceptResolutionHandled: () => false,
        continue: async () => { resolutions.push('continue'); },
        abort: async () => { resolutions.push('abort'); }
      });
      if (failure) throw failure;
      return {status: () => status};
    }
  };
  const launch = async () => ({newPage: async () => page, close: async () => { closed++; if (closeFailure) throw closeFailure; }});
  return {launch, resolutions, closed: () => closed};
}

test('browser response and redirect failures close Chromium and do not look like empty results', async () => {
  for (const options of [{status: 403}, {finalURL: 'https://localhost/'}]) {
    const browser = fakeBrowser(options);
    await assert.rejects(api.getFullSite('https://geizhals.de/', {launch: browser.launch}));
    assert.equal(browser.closed(), 1);
  }
  const browser = fakeBrowser({failure: new Error('navigation failure'), closeFailure: new Error('close failure')});
  await assert.rejects(api.getFullSite('https://geizhals.de/', {launch: browser.launch}), /navigation failure/);
});

test('browser interception blocks outside navigation and non-publisher resources', async () => {
  const browser = fakeBrowser({requests: [
    {url: 'https://geizhals.de/', navigation: true},
    {url: 'https://gzhls.at/image.webp', navigation: false},
    {url: 'http://127.0.0.1/private', navigation: false},
    {url: 'https://attacker.example/', navigation: true}
  ]});
  await assert.rejects(api.getFullSite('https://geizhals.de/', {launch: browser.launch}), /navigation/);
  assert.deepEqual(browser.resolutions, ['continue', 'continue', 'abort', 'abort']);
});

test('browser content is bounded and top10 can use the optional renderer', async () => {
  const browser = fakeBrowser({html: '<html/>'});
  await assert.rejects(api.getFullSite('https://geizhals.de/', {launch: browser.launch, maxBytes: 1}), /maxBytes/);
  const other = fakeBrowser();
  assert.deepEqual(await api.getTop10({rendered: true, launch: other.launch}), []);
  assert.equal(other.closed(), 1);
});

test('requiring the package does not write sample files or fetch live pages', t => {
  const cwd = temporary(t);
  const code = `const a=require(${JSON.stringify(path.resolve(__dirname, '..'))}); if(typeof a.getListing!=='function')process.exit(1);`;
  const child = spawnSync(process.execPath, ['-e', code], {cwd, encoding: 'utf8', timeout: 20000});
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(fs.readdirSync(cwd), []);
});
