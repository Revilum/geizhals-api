'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');

test('explicit listing and top10 operations do not retain an inherited search query', () => {
  for (const type of ['listing', 'top10']) {
    const url = new URL(api.getURL({
      type,
      url: 'https://geizhals.at/?fs=Ryzen&asuch=CPU&cat=cpuamdam4&bpmin=100&xf=7781_AMD'
    }));
    assert.equal(url.searchParams.has('fs'), false, type);
    assert.equal(url.searchParams.has('asuch'), false, type);
    assert.equal(url.origin, 'https://geizhals.at');
    assert.equal(url.searchParams.get('cat'), 'cpuamdam4');
    assert.equal(url.searchParams.get('bpmin'), '100');
    assert.equal(url.searchParams.get('xf'), '7781_AMD');
  }
});

test('category endpoint fetches a listing when given a copied search URL', async () => {
  let target;
  const client = {get: async url => {
    target = new URL(url);
    return {status: 200, data: '<html></html>'};
  }};
  assert.deepEqual(await api.getListing({
    url: 'https://geizhals.eu/?fs=Ryzen&cat=cpuamdam4', client
  }), []);
  assert.equal(target.origin, 'https://geizhals.eu');
  assert.equal(target.searchParams.get('cat'), 'cpuamdam4');
  assert.equal(target.searchParams.has('fs'), false);
});

test('non-item URL builders reject product and unsupported paths before fetching', async () => {
  for (const type of ['search', 'listing', 'top10']) {
    for (const pathname of ['/example-a123.html', '/unsupported']) {
      assert.throws(() => api.getURL({
        type, url: 'https://geizhals.de' + pathname, query: 'CPU', cat: 'cpuamdam4'
      }), /homepage|index|path/i);
    }
  }
  let requests = 0;
  const client = {get: async () => {requests++; return {data: ''};}};
  await assert.rejects(api.search('CPU', {url: 'https://geizhals.de/example-a123.html', client}), /path/i);
  assert.equal(requests, 0);
});

test('non-item builders retain supported index paths and regional category URLs', () => {
  for (const origin of ['https://geizhals.de', 'https://geizhals.at', 'https://geizhals.eu']) {
    for (const pathname of ['/', '/index.php', '/index.html']) {
      const url = new URL(api.getURL({type: 'listing', url: origin + pathname + '?m=1&o=4&cat=cpuamdam4'}));
      assert.equal(url.origin + url.pathname, origin + pathname);
      assert.equal(url.searchParams.get('m'), '1');
      assert.equal(url.searchParams.get('o'), '4');
      assert.equal(url.searchParams.get('cat'), 'cpuamdam4');
      const search = new URL(api.getURL({query: 'RTX & OLED', url: origin + pathname}));
      assert.equal(search.origin + search.pathname, origin + pathname);
      assert.equal(search.searchParams.get('fs'), 'RTX & OLED');
    }
  }
});

test('inherited category URL parameters receive the same validation as explicit options', () => {
  for (const query of ['m=0', 'o=-1', 'm=1&m=invalid', 'cat=bad%2Fpath']) {
    assert.throws(() => api.getURL({type: 'listing', url: 'https://geizhals.de/?' + query}), /category/i);
  }
  assert.equal(new URL(api.getURL({
    type: 'listing', url: 'https://geizhals.de/?m=invalid', m: 1
  })).searchParams.get('m'), '1');
});
