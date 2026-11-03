'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('./config/global.json');
const {parseUrl, isGeizhalsURL, parseText} = require('./utils');
const INDEX_PATHS = new Set(['/', '/index.php', '/index.html']);

function detectPageType(value) {
  const href = parseUrl(value);
  if (!href || !isGeizhalsURL(href)) return 'unknown';
  const url = new URL(href);
  if (/(?:\/|-)a\d+\.html$/i.test(url.pathname)) return 'item';
  if (url.searchParams.has('fs') || url.searchParams.has('asuch')) return 'search';
  if (['cat', 'm', 'o'].some(key => url.searchParams.has(key))) return 'listing';
  return INDEX_PATHS.has(url.pathname) ? 'top10' : 'unknown';
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Values may contain spaces (e.g. GPU model names); URLSearchParams encodes them.
function tokens(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) {
    throw new TypeError('Filter values must be nonempty strings of at most 2048 characters');
  }
  const result = value.trim().split('~');
  if (!result.every(token => /^\d+(?:_[^\u0000-\u001f\u007f~]+)?$/.test(token))) {
    throw new TypeError('Invalid xf filter token');
  }
  return result;
}

function resolveFilterFile(options) {
  if (options.filterFile !== undefined) {
    if (typeof options.filterFile !== 'string' || !options.filterFile.trim()) {
      throw new TypeError('filterFile must be a nonempty path');
    }
    return path.resolve(options.filterFile);
  }
  if (options.filterDir === undefined) return undefined;
  const cat = options.cat ?? options.finalCategory;
  if (typeof options.filterDir !== 'string' || !options.filterDir.trim()
      || typeof cat !== 'string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(cat)) {
    throw new TypeError('filterDir requires a directory and an explicit valid cat');
  }
  const matches = [];
  const pending = [{directory: path.resolve(options.filterDir), depth: 0}];
  let entries = 0;
  while (pending.length) {
    const {directory, depth} = pending.pop();
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (++entries > 10000) throw new RangeError('Filter directory scan limit exceeded; use filterFile');
      const location = path.join(directory, entry.name);
      if (entry.isDirectory() && depth < 4) pending.push({directory: location, depth: depth + 1});
      if (entry.isFile() && (entry.name === cat + '.json' || entry.name.endsWith('-' + cat + '.json'))) {
        matches.push(location);
      }
    }
  }
  if (matches.length !== 1) throw new RangeError('Expected exactly one filter catalog for ' + cat + '; found ' + matches.length);
  return matches[0];
}

function filterValues(filters, filterFile) {
  if (filters == null) return [];
  let catalog;
  if (filterFile !== undefined) {
    if (typeof filterFile !== 'string' || path.extname(filterFile).toLowerCase() !== '.json') {
      throw new TypeError('Filter catalog must be a JSON file');
    }
    catalog = JSON.parse(fs.readFileSync(path.resolve(filterFile), 'utf8'));
    if (!record(catalog) || !Object.values(catalog).every(record)) {
      throw new TypeError('Filter catalog must map group names to objects');
    }
  }
  const values = [];
  if (Array.isArray(filters)) {
    for (const value of filters) values.push(...tokens(value));
  } else if (record(filters)) {
    for (const [key, selected] of Object.entries(filters)) {
      for (const value of Array.isArray(selected) ? selected : [selected]) {
        if (value === false || value == null || value === '') continue;
        if (!catalog) {
          // Keep the old raw-token shorthand, but never misinterpret numeric labels.
          if (typeof value === 'string' && /^\d+_/.test(value)) values.push(...tokens(value));
          else throw new TypeError('filterFile or filterDir is required for named filters');
          continue;
        }
        const group = Object.entries(catalog).find(([label]) => parseText(label) === parseText(key))?.[1];
        const found = group && Object.entries(group).find(([label]) => parseText(label) === parseText(value));
        if (!found) throw new RangeError('Unknown filter: ' + key + '=' + String(value));
        values.push(...tokens(found[1]));
      }
    }
  } else {
    throw new TypeError('filters must be an array or object');
  }
  if (values.length > 100) throw new RangeError('At most 100 filter tokens are supported');
  return [...new Set(values)];
}

function validPrice(value, name) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value))) {
    throw new TypeError(name + ' must be a finite nonnegative price');
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount * 100 > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(name + ' must be a finite nonnegative price');
  }
  return amount;
}

function categoryValue(key, value) {
  const text = String(value);
  if (typeof value === 'boolean' || !(key === 'cat' ? /^[\w-]{1,90}$/ : /^[1-9]\d{0,9}$/).test(text)) {
    throw new TypeError('Invalid category parameter: ' + key);
  }
  return text;
}

function getURL(options = {}) {
  if (typeof options === 'string') options = {type: 'search', query: options};
  if (!record(options)) throw new TypeError('options must be an object');
  const type = options.type || (options.item ? 'item' : options.query != null ? 'search'
    : options.url ? detectPageType(options.url) : 'top10');
  const href = parseUrl(options.url || options.item || config.baseurl);
  if (!href || !isGeizhalsURL(href)) throw new TypeError('URL must be a HTTPS Geizhals page without credentials or nonstandard ports');
  const url = new URL(href);
  if (type === 'item' || type === 'reviews') {
    if (detectPageType(url.href) !== 'item') throw new TypeError('An item URL ending in -a<ID>.html is required');
    return url.href;
  }
  if (!['top10', 'listing', 'search'].includes(type)) throw new RangeError('Unsupported page type: ' + type);
  if (!INDEX_PATHS.has(url.pathname)) {
    throw new TypeError('Search, listing and top10 require a homepage or index path');
  }
  const params = url.searchParams;
  if (type === 'search') {
    if (typeof options.query !== 'string' || !options.query.trim()) throw new TypeError('A nonempty search query is required');
    params.set('fs', options.query.trim());
    params.delete('asuch');
  } else {
    // A copied search URL must not turn an explicit listing/top10 operation into a search.
    params.delete('fs');
    params.delete('asuch');
  }
  for (const [key, value] of [
    ['m', options.m ?? options.subcategory], ['o', options.o ?? options.category],
    ['cat', options.cat ?? options.finalCategory]
  ]) {
    if (value != null) {
      params.set(key, categoryValue(key, value));
    }
  }
  // URL-derived parameters must satisfy the same contract as explicit options.
  for (const key of ['m', 'o', 'cat']) {
    for (const value of params.getAll(key)) categoryValue(key, value);
  }
  if (type === 'listing' && !['m', 'o', 'cat'].some(key => params.has(key))) {
    throw new TypeError('A listing requires m, o or cat');
  }
  if (options.minPrice != null) params.set('bpmin', String(validPrice(options.minPrice, 'minPrice')));
  if (options.maxPrice != null) params.set('bqmax', String(validPrice(options.maxPrice, 'maxPrice')));
  const min = params.has('bpmin') ? validPrice(params.get('bpmin'), 'minPrice') : 0;
  const max = params.has('bqmax') ? validPrice(params.get('bqmax'), 'maxPrice') : Infinity;
  if (min > max) throw new RangeError('minPrice must not exceed maxPrice');
  if (options.filters != null) {
    const file = resolveFilterFile({...options, cat: options.cat ?? options.finalCategory ?? params.get('cat')});
    const values = filterValues(options.filters, file);
    params.delete('xf');
    if (values.length) params.set('xf', values.join('~'));
  }
  return url.href;
}

module.exports = {getURL, detectPageType, filterValues, resolveFilterFile};
