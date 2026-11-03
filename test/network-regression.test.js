'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {getFullSite} = require('../utils');

function browserResponse(contentType) {
  const state = {closed: 0, contentCalls: 0};
  const page = {
    setRequestInterception: async () => {},
    setBypassServiceWorker: async () => {},
    on: () => {},
    goto: async () => ({
      status: () => 200,
      headers: () => contentType === undefined ? {} : {'content-type': contentType}
    }),
    url: () => 'https://geizhals.de/',
    content: async () => { state.contentCalls++; return '<html>document</html>'; }
  };
  return {
    state,
    launch: async () => ({
      newPage: async () => page,
      close: async () => { state.closed++; }
    })
  };
}

test('rendered fetching rejects successful non-HTML responses before reading the generated document', async () => {
  for (const type of ['application/json', 'application/pdf', 'image/png']) {
    const browser = browserResponse(type);
    await assert.rejects(getFullSite('https://geizhals.de/', {launch: browser.launch}), /Expected an HTML text response/);
    assert.equal(browser.state.contentCalls, 0, type);
    assert.equal(browser.state.closed, 1, type);
  }
});

test('rendered fetching accepts supported HTML response media types and missing headers', async () => {
  for (const type of ['text/html; charset=utf-8', 'application/xhtml+xml', 'text/plain', undefined]) {
    const browser = browserResponse(type);
    assert.equal(await getFullSite('https://geizhals.de/', {launch: browser.launch}), '<html>document</html>');
    assert.equal(browser.state.contentCalls, 1, type);
    assert.equal(browser.state.closed, 1, type);
  }
});
