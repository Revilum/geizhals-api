'use strict';

const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
const config = require('./config/global.json');

const ALLOWED_DOMAINS = new Set(['geizhals.de', 'geizhals.at', 'geizhals.eu']);

function parseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, config.baseurl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isGeizhalsURL(value) {
  const href = parseUrl(value);
  if (!href) return false;
  const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
  return ALLOWED_DOMAINS.has(host);
}

function getParam(urlOrQuery, key) {
  if (typeof key !== 'string') return null;
  const href = parseUrl(urlOrQuery);
  return href ? new URL(href).searchParams.get(key) : null;
}

async function getSite(url, options = {}) {
  if (!isGeizhalsURL(url)) throw new TypeError('Only HTTPS Geizhals pages are supported');
  const href = parseUrl(url);
  if (!href.startsWith('https:')) throw new TypeError('Geizhals URLs must use HTTPS');
  const client = options.client || axios;
  const response = await client.get(href, {
    timeout: options.timeout || 20000,
    maxRedirects: 4,
    beforeRedirect: target => {
      const hostname = String(target.hostname || '').toLowerCase().replace(/^www\./, '');
      if (target.protocol !== 'https:' || !ALLOWED_DOMAINS.has(hostname)) {
        throw new TypeError('Redirect outside Geizhals is not allowed');
      }
    },
    responseType: 'text',
    headers: {
      'User-Agent': 'geizhals-api/0.2 (+https://github.com/Revilum/geizhals-api)',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  return response.data;
}

async function getFullSite(url, options = {}) {
  if (!isGeizhalsURL(url) || !parseUrl(url).startsWith('https:')) {
    throw new TypeError('Only HTTPS Geizhals pages are supported');
  }
  let launch = options.launch;
  if (!launch) {
    try { launch = require('puppeteer').launch; } catch {
      throw new Error('Rendering requires optional Puppeteer: npm install puppeteer');
    }
  }
  const browser = await launch({headless: true});
  try {
    const page = await browser.newPage();
    await page.goto(parseUrl(url), {waitUntil: 'domcontentloaded', timeout: options.timeout || 30000});
    return await page.content();
  } finally {
    await browser.close();
  }
}

function parseText(value) {
  return String(value ?? '').toLowerCase().trim()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

// Preserve the original price representation (currency followed by a dot-decimal number).
function parsePrice(value) {
  const source = String(value ?? '').replace(/\u00a0/g, ' ').trim();
  const match = source.match(/(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  let number = match[1].replace(/\s/g, '');
  if (number.includes(',')) number = number.replace(/\./g, '').replace(',', '.');
  const amount = Number(number);
  if (!Number.isFinite(amount)) return null;
  const symbol = source.includes('€') || /\bEUR\b/i.test(source) ? '€' : '';
  return symbol + amount.toFixed(2);
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
