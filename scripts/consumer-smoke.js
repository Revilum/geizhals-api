'use strict';

// packcheck runs this source inside the isolated installed consumer, never the checkout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('geizhals-api');

async function main() {
  for (const method of ['search', 'getListing', 'getItem', 'getTop10', 'getReviews',
    'getURL', 'getFilters', 'parseFilters', 'refreshFilters']) {
    assert.equal(typeof api[method], 'function', method);
  }
  assert.equal(new URL(api.getURL('CPU')).searchParams.get('fs'), 'CPU');

  const group = 'Übertragung_Output_' + 'Long descriptive group '.repeat(4);
  const choice = 'Display_Port_日本語_' + 'Long descriptive choice '.repeat(4);
  const html = '<div class="xf_tr"><div class="xf_th">' + group + ':</div>'
    + '<div class="xf_td"><a href="/?xf=1_first&amp;xf=2_second"><span class="xf_v">'
    + choice + '</span></a></div></div>';
  const selected = {[group]: choice};
  const parsedFile = path.join(process.cwd(), 'parsed-catalog.json');
  fs.writeFileSync(parsedFile, JSON.stringify(api.parseFilters(html)));
  const parsedURL = api.getURL({type: 'listing', cat: 'demo', filterFile: parsedFile, filters: selected});
  assert.equal(new URL(parsedURL).searchParams.get('xf'), '1_first~2_second');

  const outputDir = path.join(process.cwd(), 'refreshed-catalogs');
  const fetchPage = async href => {
    const query = new URL(href).searchParams;
    if (query.get('cat') === 'demo') return html;
    if (query.get('o') === '5') return '<a class="nav-cat-link" href="/?cat=demo">Demo</a>';
    if (query.get('m') === '1') return '<a class="nav-o-link" href="/?o=5">Displays</a>';
    return '<a class="nav-m-link" href="/?m=1">Hardware</a>';
  };
  const report = await api.refreshFilters({outputDir, fetchPage, delayMs: 0, maxPages: 4});
  assert.equal(report.changed, 1);
  assert.equal(report.partial, false);
  const refreshedURL = api.getURL({type: 'listing', cat: 'demo', filterDir: outputDir, filters: selected});
  assert.equal(new URL(refreshedURL).searchParams.get('xf'), '1_first~2_second');
  const repeated = await api.refreshFilters({outputDir, fetchPage, delayMs: 0, maxPages: 4});
  assert.equal(repeated.changed, 0);
  assert.equal(repeated.partial, false);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
