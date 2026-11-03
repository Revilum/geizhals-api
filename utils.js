'use strict';

const fs = require('node:fs');
const axios = require('axios');
const config = require('./config/global.json');

const ALLOWED_DOMAINS = new Set(['geizhals.de', 'geizhals.at', 'geizhals.eu']);
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function parseUrl(value, baseURL = config.baseurl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, baseURL);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Fetch policy, not a general link normalizer: reject credentials and unusual ports.
function isGeizhalsURL(value) {
  const href = parseUrl(value);
  if (!href) return false;
  const url = new URL(href);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && ALLOWED_DOMAINS.has(host);
}

function getParam(urlOrQuery, key) {
  if (typeof key !== 'string' || typeof urlOrQuery !== 'string') return null;
  if (/^[\w-]+=/.test(urlOrQuery)) return new URLSearchParams(urlOrQuery).get(key);
  const href = parseUrl(urlOrQuery);
  return href ? new URL(href).searchParams.get(key) : null;
}

function positiveInteger(value, fallback, name, maximum) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(name + ' must be a positive integer no greater than ' + maximum);
  }
  return value;
}

function requestLimits(options, fallbackTimeout) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  return {
    timeout: positiveInteger(options.timeout, fallbackTimeout, 'timeout', 120000),
    maxBytes: positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES, 'maxBytes', 50 * 1024 * 1024)
  };
}

function checkHtml(value, maxBytes) {
  const html = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  if (typeof html !== 'string') throw new TypeError('Expected an HTML text response');
  if (Buffer.byteLength(html, 'utf8') > maxBytes) throw new RangeError('HTML response exceeds maxBytes');
  return html;
}

async function getSite(url, options = {}) {
  if (!isGeizhalsURL(url)) throw new TypeError('Only HTTPS Geizhals pages without credentials or nonstandard ports are supported');
  const {timeout, maxBytes} = requestLimits(options, 20000);
  const client = options.client || axios;
  const response = await client.get(parseUrl(url), {
    timeout,
    maxRedirects: 4,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    beforeRedirect: target => {
      const host = String(target.hostname || '').toLowerCase().replace(/^www\./, '');
      if (target.protocol !== 'https:' || !ALLOWED_DOMAINS.has(host)
          || (target.port && String(target.port) !== '443') || target.auth) {
        throw new TypeError('Redirect outside the allowed Geizhals origin is not allowed');
      }
    },
    responseType: 'text',
    transformResponse: [data => data],
    headers: {
      'User-Agent': 'geizhals-api/0.2 (+https://github.com/Revilum/geizhals-api)',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  if (typeof response.status === 'number' && (response.status < 200 || response.status >= 300)) {
    throw new Error('Geizhals returned HTTP ' + response.status);
  }
  const contentType = response.headers?.['content-type'];
  if (contentType && !/^text\/(html|plain)\b|^application\/xhtml\+xml\b/i.test(contentType)) {
    throw new TypeError('Expected an HTML text response, not ' + contentType);
  }
  return checkHtml(response.data, maxBytes);
}

function allowedBrowserResource(value) {
  try {
    const url = new URL(value);
    if (['data:', 'blob:'].includes(url.protocol)) return true;
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return [...ALLOWED_DOMAINS, 'gzhls.at'].some(host =>
      url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

async function getFullSite(url, options = {}) {
  if (!isGeizhalsURL(url)) throw new TypeError('Only HTTPS Geizhals pages without credentials or nonstandard ports are supported');
  const {timeout, maxBytes} = requestLimits(options, 30000);
  let launch = options.launch;
  if (!launch) {
    try {
      const puppeteer = require('puppeteer');
      launch = puppeteer.launch.bind(puppeteer);
    } catch {
      throw new Error('Rendering requires optional Puppeteer: npm install puppeteer');
    }
  }
  const browser = await launch({headless: true});
  let originalError;
  let navigationBlocked = false;
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    page.on('request', request => {
      if (request.isInterceptResolutionHandled()) return;
      const navigation = request.isNavigationRequest();
      const allowed = navigation ? isGeizhalsURL(request.url()) : allowedBrowserResource(request.url());
      if (navigation && !allowed) navigationBlocked = true;
      // A late interception may race with closing the browser; never leave a rejected promise.
      Promise.resolve(allowed ? request.continue() : request.abort()).catch(() => {});
    });
    const response = await page.goto(parseUrl(url), {waitUntil: 'domcontentloaded', timeout});
    if (navigationBlocked || !isGeizhalsURL(page.url())) {
      throw new TypeError('Browser navigation outside Geizhals is not allowed');
    }
    if (!response || response.status() < 200 || response.status() >= 300) {
      throw new Error('Geizhals returned HTTP ' + (response ? response.status() : 'no response'));
    }
    return checkHtml(await page.content(), maxBytes);
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    try { await browser.close(); } catch (closeError) {
      if (!originalError) throw closeError;
    }
  }
}

function parseText(value) {
  return String(value ?? '').toLowerCase().trim()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

// Geizhals uses German grouping; also accept an ungrouped dot decimal or clear US grouping.
function parsePrice(value) {
  const source = String(value ?? '').replace(/[\u00a0\u202f]/g, ' ').trim();
  const match = source.match(/-?\d+(?:(?:[.,]| (?=\d{3}(?:\D|$)))\d+)*/);
  if (!match) return null;
  const token = match[0];
  let normalized;
  if (/^\d{1,3}(?:[. ]\d{3})+(?:,\d{1,2})?$/.test(token)) {
    normalized = token.replace(/[. ]/g, '').replace(',', '.');
  } else if (/^\d+(?:,\d{1,2})?$/.test(token)) {
    normalized = token.replace(',', '.');
  } else if (/^\d+(?:\.\d{1,2})?$/.test(token)) {
    normalized = token;
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(token)) {
    normalized = token.replace(/,/g, '');
  } else {
    return null;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount * 100 > Number.MAX_SAFE_INTEGER) return null;
  return (source.includes('€') || /\bEUR\b/i.test(source) ? '€' : '') + amount.toFixed(2);
}

function sleep(ms) {
  const duration = Number.isFinite(ms) ? ms : 10000 + Math.random() * 20000;
  return new Promise(resolve => setTimeout(resolve, Math.max(0, duration)));
}

function getDirectories(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true})
    .filter(entry => entry.isDirectory()).map(entry => entry.name);
}

module.exports = {
  getSite, getFullSite, getParam, parseText, sleep, getDirectories,
  parseUrl, parsePrice, isGeizhalsURL
};
