'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const axios = require('axios');
const cheerio = require('cheerio');

const HOME = 'https://geizhals.de/';
const MAX_BYTES = 5 * 1024 * 1024;

function geizhalsUrl(value) {
  const parsed = new URL(value, HOME);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
      || !['geizhals.de', 'www.geizhals.de'].includes(parsed.hostname)) {
    throw new TypeError('Only HTTPS pages on geizhals.de without credentials or nonstandard ports may be crawled');
  }
  return parsed.href;
}

function slug(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 65);
}

function parseNavigation(html, param) {
  if (!['m', 'o', 'cat'].includes(param)) throw new TypeError('Unknown category parameter');
  const $ = cheerio.load(String(html ?? ''));
  const selector = param === 'm' ? '.mkat > a, a.nav-m-link[href*="m="]'
    : param === 'o' ? '.mocat-item a[href*="o="], .mocat-item__link, a.nav-o-link'
    : '.mocat-item a[href*="cat="], a.nav-cat-link, .mocat-item__link';
  const seen = new Set();
  return $(selector).toArray().map(el => {
    const anchor = $(el);
    const href = anchor.attr('href');
    if (!href) return null;
    let url;
    try { url = new URL(geizhalsUrl(href)); } catch { return null; }
    if (url.searchParams.has('services')) return null;
    const value = url.searchParams.get(param);
    if (!value || !/^[\w-]{1,90}$/.test(value) || seen.has(value)) return null;
    const name = slug(anchor.attr('title') || anchor.text().trim());
    if (!name || name === 'mehr' || name === 'more') return null;
    seen.add(value);
    return {name, param: value};
  }).filter(Boolean);
}

function sorted(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function validTokens(value) {
  return typeof value === 'string' && value.length <= 2048
    && value.split('~').every(token => /^\d+(?:_[^\u0000-\u001f\u007f~]+)?$/.test(token));
}

function parseFilters(html) {
  const $ = cheerio.load(String(html ?? ''));
  const groups = new Map();
  $('.xf_tr').not('.xf_tr_collapse_controls').each((_, el) => {
    const row = $(el);
    const title = slug(row.children('.xf_th').first().text().replace(/:\s*$/, ''));
    if (!title) return;
    const choices = groups.get(title) || new Map();
    row.find('.xf_td a').each((_, link) => {
      const anchor = $(link);
      const label = slug(anchor.find('.xf_v').first().text());
      if (!label) return;
      let value;
      try { value = new URL(geizhalsUrl(anchor.attr('href'))).searchParams.getAll('xf').join('~'); }
      catch { return; }
      if (!validTokens(value)) return;
      if (choices.has(label) && choices.get(label) !== value) {
        throw new Error('Ambiguous filter label: ' + title + '/' + label);
      }
      choices.set(label, value);
    });
    if (choices.size) groups.set(title, choices);
  });
  return sorted([...groups].map(([key, values]) => [key, sorted(values)]));
}

async function fetchHtml(url, options = {}) {
  const response = await (options.client || axios).get(geizhalsUrl(url), {
    timeout: 20000,
    responseType: 'text',
    transformResponse: [data => data],
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    maxRedirects: 0,
    headers: {'User-Agent': 'geizhals-api-filter-maintenance/1.0', Accept: 'text/html,application/xhtml+xml'}
  });
  if (typeof response.status === 'number' && (response.status < 200 || response.status >= 300)) {
    const error = new Error('Geizhals returned HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }
  const contentType = response.headers?.['content-type'];
  if (contentType && !['text/html', 'text/plain', 'application/xhtml+xml'].includes(
    String(contentType).split(';', 1)[0].trim().toLowerCase())) {
    throw new TypeError('Expected an HTML text response');
  }
  if (typeof response.data !== 'string' || Buffer.byteLength(response.data, 'utf8') > MAX_BYTES) {
    throw new Error('Expected bounded HTML text');
  }
  return response.data;
}

function writeIfChanged(destination, content, options = {}) {
  const text = JSON.stringify(content, null, 2) + '\n';
  const previous = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : null;
  if (previous === text) return false;
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    const temporary = destination + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
    try {
      fs.writeFileSync(temporary, text, {encoding: 'utf8', flag: 'wx'});
      fs.renameSync(temporary, destination);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return true;
}

function mergeCatalog(previous, incoming) {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isRecord(previous) || !Object.values(previous).every(group =>
    isRecord(group) && Object.values(group).every(value => typeof value === 'string' && value.length > 0))) {
    throw new TypeError('Existing catalog is malformed; refusing to overwrite it');
  }
  const groups = new Map(Object.entries(previous).map(([key, values]) => [key, new Map(Object.entries(values))]));
  for (const [key, values] of Object.entries(incoming)) {
    const group = groups.get(key) || new Map();
    for (const [label, value] of Object.entries(values)) group.set(label, value);
    groups.set(key, group);
  }
  return sorted([...groups].map(([key, values]) => [key, sorted(values)]));
}

function checkCatalogPaths(outputDir, files) {
  const stagedNames = new Map();
  const directoryEntries = new Map();
  for (const file of files) {
    let directory = outputDir;
    let relative = '';
    for (const name of path.relative(outputDir, file).split(path.sep)) {
      relative = relative ? path.join(relative, name) : name;
      const folded = relative.toLowerCase();
      const previous = stagedNames.get(folded);
      // Reject on every OS so a catalog generated on Linux also remains safe on Windows.
      if (previous !== undefined && previous !== relative) {
        throw new Error('Ambiguous catalog path casing: ' + relative);
      }
      stagedNames.set(folded, relative);
      if (!directoryEntries.has(directory)) {
        directoryEntries.set(directory, fs.existsSync(directory) ? fs.readdirSync(directory) : []);
      }
      if (directoryEntries.get(directory).some(existing => existing !== name
          && existing.toLowerCase() === name.toLowerCase())) {
        throw new Error('Ambiguous catalog path casing: ' + relative);
      }
      directory = path.join(directory, name);
    }
  }
}

function browseUrl(param, value) {
  const url = new URL(HOME);
  url.searchParams.set(param, value);
  return url.href;
}

function integer(value, fallback, name, min, max) {
  const n = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new RangeError(name + ' must be an integer between ' + min + ' and ' + max);
  return n;
}

function select(items, offset, limit, rotate) {
  if (!items.length) return [];
  const start = rotate ? offset % items.length : offset;
  const ordered = rotate ? [...items.slice(start), ...items.slice(0, start)] : items.slice(start);
  return ordered.slice(0, limit);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function refreshFilters(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
  const maxPages = integer(options.maxPages, 80, 'maxPages', 1, 300);
  const delayMs = integer(options.delayMs, 3000, 'delayMs', options.fetchPage ? 0 : 1000, 60000);
  const now = integer(options.now, Date.now(), 'now', 0, Number.MAX_SAFE_INTEGER);
  for (const key of ['categoryOffset', 'subcategoryOffset', 'finalCategoryOffset']) integer(options[key], 0, key, 0, 1000000);
  for (const key of ['categoryLimit', 'subcategoryLimit', 'finalCategoryLimit']) integer(options[key], 1000000, key, 1, 1000000);
  if (options.fetchPage !== undefined && typeof options.fetchPage !== 'function') throw new TypeError('fetchPage must be a function');
  if (options.outputDir !== undefined && (typeof options.outputDir !== 'string' || !options.outputDir.trim())) throw new TypeError('outputDir must be a nonempty path');
  const outputDir = path.resolve(options.outputDir || path.join(process.cwd(), 'filters'));
  const fetch = options.fetchPage || fetchHtml;
  const dryRun = Boolean(options.dryRun);
  const rotate = Boolean(options.rotate);
  const week = Math.floor(now / (7 * 86400000));
  const reasons = new Set();
  const errors = [];
  const staged = new Map();
  let requests = 0, parsed = 0;

  async function load(url) {
    if (requests >= maxPages) { reasons.add('request-budget'); return null; }
    requests++;
    try { return await fetch(geizhalsUrl(url)); }
    catch (error) {
      const status = error.response?.status ?? error.status;
      if ([401, 403, 429].includes(status)) {
        const stopped = new Error('Filter refresh stopped on HTTP ' + status + '; no staged catalogs were written');
        stopped.code = 'ERR_UPSTREAM_BLOCKED';
        stopped.status = status;
        throw stopped;
      }
      reasons.add('request-errors');
      errors.push({url, message: String(error?.message || error).slice(0, 250)});
      return null;
    } finally {
      if (delayMs > 0) await wait(delayMs);
    }
  }

  const categories = parseNavigation(await load(HOME), 'm');
  if (!categories.length) throw new Error('Could not discover any main categories. Site layout/access may have changed.');
  const chosen = select(categories, options.categoryOffset ?? (rotate ? week : 0), options.categoryLimit ?? categories.length, rotate);
  if (chosen.length < categories.length) reasons.add('category-limit');
  for (const category of chosen) {
    if (requests >= maxPages) { reasons.add('request-budget'); break; }
    const subs = parseNavigation(await load(browseUrl('m', category.param)), 'o');
    if (!subs.length) reasons.add('empty-navigation');
    const subOffset = options.subcategoryOffset ?? (rotate ? Math.floor(week / categories.length) : 0);
    const selectedSubs = select(subs, subOffset, options.subcategoryLimit ?? subs.length, rotate);
    if (selectedSubs.length < subs.length) reasons.add('subcategory-limit');
    for (const sub of selectedSubs) {
      if (requests >= maxPages) { reasons.add('request-budget'); break; }
      const finals = parseNavigation(await load(browseUrl('o', sub.param)), 'cat');
      if (!finals.length) reasons.add('empty-navigation');
      const finalOffset = options.finalCategoryOffset ?? (rotate ? Math.floor(week / (categories.length * Math.max(1, subs.length))) : 0);
      const selectedFinals = select(finals, finalOffset, options.finalCategoryLimit ?? finals.length, rotate);
      if (selectedFinals.length < finals.length) reasons.add('final-category-limit');
      for (const final of selectedFinals) {
        if (requests >= maxPages) { reasons.add('request-budget'); break; }
        const filters = parseFilters(await load(browseUrl('cat', final.param)));
        if (!Object.keys(filters).length) { reasons.add('empty-filter-page'); continue; }
        parsed++;
        // The validated category ID is also the API's exact catalog lookup key.
        const file = path.join(outputDir, category.name + '-m' + category.param, sub.name + '-o' + sub.param, final.name + '-' + final.param + '.json');
        staged.set(file, filters);
      }
    }
  }
  if (!parsed) throw new Error('No nonempty filter data found. Existing catalogs were left untouched. Errors: ' + errors.slice(0, 3).map(e => e.message).join('; '));

  checkCatalogPaths(outputDir, staged.keys());
  // Validate every existing destination in this batch before writing; retain missing choices.
  const prepared = [...staged].map(([file, incoming]) => {
    const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const merged = mergeCatalog(previous, incoming);
    if (Object.entries(previous).some(([key, values]) => Object.keys(values).some(label =>
      !Object.hasOwn(incoming, key) || !Object.hasOwn(incoming[key], label)))) {
      reasons.add('retained-existing-choices');
    }
    return [file, merged];
  });
  let changed = 0;
  for (const [file, content] of prepared) if (writeIfChanged(file, content, {dryRun})) changed++;
  return {
    requests, parsed, changed, dryRun, errors,
    files: [...staged.keys()].map(file => path.relative(outputDir, file).split(path.sep).join('/')).sort(),
    partial: reasons.size > 0, partialReasons: [...reasons].sort()
  };
}

module.exports = {geizhalsUrl, slug, parseNavigation, parseFilters, fetchHtml, writeIfChanged, mergeCatalog, browseUrl, refreshFilters};
