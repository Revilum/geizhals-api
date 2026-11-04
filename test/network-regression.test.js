'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {getSite, getFullSite} = require('../utils');

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

test('fetching rejects distinct media types with HTML-like prefixes', async () => {
  for (const type of ['text/html+json', 'text/html-extra', 'text/plain-other', 'application/xhtml+xml+json']) {
    const client = {get: async () => ({status: 200, data: '<html/>', headers: {'content-type': type}})};
    await assert.rejects(getSite('https://geizhals.de/', {client}), /Expected an HTML text response/, type);
    const browser = browserResponse(type);
    await assert.rejects(getFullSite('https://geizhals.de/', {launch: browser.launch}), /Expected an HTML text response/, type);
    assert.equal(browser.state.contentCalls, 0, type);
    assert.equal(browser.state.closed, 1, type);
  }
});

test('fetching accepts exact supported media types with case, whitespace and parameters', async () => {
  for (const type of ['Text/HTML; charset=UTF-8', ' text/html \t; charset=utf-8', 'application/xhtml+xml; charset=utf-8', 'text/plain', undefined]) {
    const client = {get: async () => ({status: 200, data: '<html/>', headers: {'content-type': type}})};
    assert.equal(await getSite('https://geizhals.de/', {client}), '<html/>', type);
    const browser = browserResponse(type);
    assert.equal(await getFullSite('https://geizhals.de/', {launch: browser.launch}), '<html>document</html>', type);
    assert.equal(browser.state.closed, 1, type);
  }
});
