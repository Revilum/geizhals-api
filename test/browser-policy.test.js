'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {getFullSite} = require('../utils');

const PAGE_URL = 'https://geizhals.de/';
const HTML = '<html><body>Mocked publisher page</body></html>';
const DENIED_NETWORK_URLS = [
  'https://127.0.0.1/', 'https://127.1/', 'https://2130706433/',
  'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[fd00::1]/',
  'https://10.0.0.1/', 'https://172.16.0.1/', 'https://192.168.1.1/',
  'https://169.254.169.254/', 'https://localhost/',
  'http://geizhals.de/', 'ftp://geizhals.de/',
  'file:///private/fixture', 'javascript:void(0)',
  'ws://geizhals.de/socket', 'wss://geizhals.de/socket',
  'https://user:pass@geizhals.de/', 'https://geizhals.de:8443/',
  'https://geizhals.de.attacker.invalid/', 'https://gzhls.at.attacker.invalid/',
  'https://evilgeizhals.de/', 'https://attacker.invalid/'
];

// These are policy unit tests with a mocked Page, not Chromium/network integration tests.
// Each redirect is represented by a new request event, as for ordinary HTTP requests.
function mockBrowser({requests = [], finalURL = PAGE_URL, failAt, failure} = {}) {
  const state = {events: [], decisions: [], gotoCalls: 0, contentCalls: 0, closed: 0};
  let interceptionReady = false;
  let serviceWorkerBypassReady = false;
  let handler;
  const page = {
    async setRequestInterception(enabled) {
      assert.equal(enabled, true);
      state.events.push('interception:start');
      await new Promise(resolve => setImmediate(resolve));
      if (failAt === 'interception') throw failure;
      interceptionReady = true;
      state.events.push('interception:ready');
    },
    async setBypassServiceWorker(enabled) {
      assert.equal(enabled, true);
      state.events.push('service-worker:start');
      await new Promise(resolve => setImmediate(resolve));
      if (failAt === 'service-worker') throw failure;
      serviceWorkerBypassReady = true;
      state.events.push('service-worker:ready');
    },
    on(event, listener) {
      assert.equal(event, 'request');
      handler = listener;
      state.events.push('handler:ready');
      return page;
    },
    async goto() {
      state.gotoCalls++;
      state.events.push('navigate');
      assert.equal(interceptionReady, true, 'interception must finish before navigation');
      assert.equal(serviceWorkerBypassReady, true, 'service-worker bypass must finish before navigation');
      assert.equal(typeof handler, 'function', 'the request policy must be installed before navigation');
      const previousRequests = new Map();
      for (const {url, navigation = false, redirectedFrom} of requests) {
        let handled = false;
        const previous = previousRequests.get(redirectedFrom);
        const resolve = action => {
          assert.equal(handled, false, 'request must be resolved exactly once: ' + url);
          handled = true;
          state.decisions.push({url, action});
          return Promise.resolve();
        };
        const request = {
          url: () => url,
          isNavigationRequest: () => navigation,
          isInterceptResolutionHandled: () => handled,
          redirectChain: () => previous ? [...previous.redirectChain(), previous] : [],
          continue: () => resolve('continue'),
          abort: () => resolve('abort')
        };
        if (redirectedFrom) assert.ok(previous, 'redirect source must precede its target');
        previousRequests.set(url, request);
        handler(request);
        assert.equal(handled, true, 'request was left unresolved: ' + url);
      }
      return {status: () => 200};
    },
    url: () => finalURL,
    async content() {
      state.contentCalls++;
      return HTML;
    }
  };
  const launch = async () => ({
    newPage: async () => page,
    close: async () => { state.closed++; }
  });
  return {launch, state};
}

function expectDecisions(browser, urls, action) {
  assert.deepEqual(browser.state.decisions, urls.map(url => ({url, action})));
  assert.equal(browser.state.closed, 1);
}

test('mocked browser completes interception and service-worker setup before navigating', async () => {
  const browser = mockBrowser({requests: [{url: PAGE_URL, navigation: true}]});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  const navigationIndex = browser.state.events.indexOf('navigate');
  for (const event of ['interception:ready', 'service-worker:ready', 'handler:ready']) {
    const setupIndex = browser.state.events.indexOf(event);
    assert.ok(setupIndex >= 0 && setupIndex < navigationIndex, event);
  }
  expectDecisions(browser, [PAGE_URL], 'continue');
});

test('mocked browser navigation permits regional HTTPS origins and standard HTTPS ports', async () => {
  const urls = [
    'https://geizhals.de/', 'https://geizhals.at/', 'https://geizhals.eu/',
    'https://www.geizhals.de/', 'https://www.geizhals.at/', 'https://www.geizhals.eu/',
    'https://geizhals.de:443/'
  ];
  const browser = mockBrowser({requests: urls.map(url => ({url, navigation: true}))});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  expectDecisions(browser, urls, 'continue');
});

test('mocked browser aborts disallowed navigation instead of continuing any denied target', async () => {
  const urls = [...DENIED_NETWORK_URLS,
    'https://gzhls.at/', 'https://static.geizhals.de/',
    'data:text/html,fixture', 'blob:https://geizhals.de/fixture'
  ];
  const browser = mockBrowser({requests: urls.map(url => ({url, navigation: true}))});
  await assert.rejects(getFullSite(PAGE_URL, {launch: browser.launch}), /navigation outside Geizhals/);
  expectDecisions(browser, urls, 'abort');
  assert.equal(browser.state.contentCalls, 0);
});

test('mocked browser permits publisher resources and local data/blob resources', async () => {
  const urls = [
    'https://geizhals.de/app.js', 'https://geizhals.at/style.css', 'https://geizhals.eu/data',
    'https://static.geizhals.de/app.js', 'https://static.geizhals.at/style.css',
    'https://static.geizhals.eu/data', 'https://gzhls.at/image.webp',
    'https://cdn.gzhls.at:443/image.webp',
    'data:image/png;base64,AA==', 'blob:https://geizhals.de/fixture'
  ];
  const browser = mockBrowser({requests: urls.map(url => ({url}))});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  expectDecisions(browser, urls, 'continue');
});

test('mocked browser aborts denied subresources while preserving an allowed page', async () => {
  const urls = [...DENIED_NETWORK_URLS,
    'http://gzhls.at/image.webp', 'https://user:pass@gzhls.at/image.webp',
    'https://gzhls.at:8443/image.webp', 'not an absolute URL'
  ];
  const browser = mockBrowser({requests: urls.map(url => ({url}))});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  expectDecisions(browser, urls, 'abort');
});

test('mocked resource redirects recheck the destination after allowing the publisher CDN', async () => {
  const cdn = 'https://gzhls.at/redirected-image.webp';
  const destination = 'https://127.0.0.1/private-resource';
  const browser = mockBrowser({requests: [
    {url: cdn},
    {url: destination, redirectedFrom: cdn}
  ]});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  assert.deepEqual(browser.state.decisions, [
    {url: cdn, action: 'continue'},
    {url: destination, action: 'abort'}
  ]);
  assert.equal(browser.state.closed, 1);
});

test('mocked navigation redirects can move between allowed regional origins', async () => {
  const regionalURL = 'https://www.geizhals.at/a123.html';
  const browser = mockBrowser({finalURL: regionalURL, requests: [
    {url: PAGE_URL, navigation: true},
    {url: regionalURL, navigation: true, redirectedFrom: PAGE_URL}
  ]});
  assert.equal(await getFullSite(PAGE_URL, {launch: browser.launch}), HTML);
  expectDecisions(browser, [PAGE_URL, regionalURL], 'continue');
});

test('mocked navigation redirects abort internal destinations before reading content', async () => {
  const destination = 'https://[::1]/private';
  const browser = mockBrowser({requests: [
    {url: PAGE_URL, navigation: true},
    {url: destination, navigation: true, redirectedFrom: PAGE_URL}
  ]});
  await assert.rejects(getFullSite(PAGE_URL, {launch: browser.launch}), /navigation outside Geizhals/);
  assert.deepEqual(browser.state.decisions, [
    {url: PAGE_URL, action: 'continue'},
    {url: destination, action: 'abort'}
  ]);
  assert.equal(browser.state.contentCalls, 0);
  assert.equal(browser.state.closed, 1);
});

test('mocked browser rejects an off-site final URL before reading page content', async () => {
  const browser = mockBrowser({
    finalURL: 'https://attacker.invalid/', requests: [{url: PAGE_URL, navigation: true}]
  });
  await assert.rejects(getFullSite(PAGE_URL, {launch: browser.launch}), /navigation outside Geizhals/);
  expectDecisions(browser, [PAGE_URL], 'continue');
  assert.equal(browser.state.contentCalls, 0);
});

for (const failAt of ['interception', 'service-worker']) {
  test('mocked browser closes without navigating when ' + failAt + ' setup fails', async () => {
    const failure = new Error(failAt + ' setup failed');
    const browser = mockBrowser({failAt, failure});
    await assert.rejects(getFullSite(PAGE_URL, {launch: browser.launch}), error => error === failure);
    assert.equal(browser.state.gotoCalls, 0);
    assert.equal(browser.state.contentCalls, 0);
    expectDecisions(browser, [], 'abort');
  });
}
