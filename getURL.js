'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('./config/global.json');
const {parseUrl, isGeizhalsURL, parseText} = require('./utils');

function detectPageType(value) {
  const href = parseUrl(value);
  if (!href || !isGeizhalsURL(href)) return 'unknown';
  const url = new URL(href);
  if (/-a\d+\.html$/i.test(url.pathname)) return 'item';
  if (url.searchParams.has('fs') || url.searchParams.has('asuch')) return 'search';
  if (['cat', 'm', 'o'].some(key => url.searchParams.has(key))) return 'listing';
  return 'top10';
}

function filterValues(filters, filterFile) {
  if (!filters) return [];
  let catalog = {};
  if (filterFile) {
    const resolved = path.resolve(filterFile);
    if (!resolved.endsWith('.json')) throw new TypeError('Filter catalog must be a JSON file');
    catalog = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }
  const values = [];
  const resolveKey = (key, value) => {
    if (value === false || value == null || value === '') return;
    // A plain xf token may be passed without a catalog.
    if (typeof value === 'string' && /^\d[\w~-]*$/.test(value)) {
      values.push(value);
      return;
    }
    if (!filterFile) throw new TypeError('filterFile is required for named filters');
    const group = Object.entries(catalog).find(([label]) => parseText(label) === parseText(key))?.[1];
    const found = group && typeof group === 'object'
      ? Object.entries(group).find(([label]) => parseText(label) === parseText(value))
      : null;
    if (!found || typeof found[1] !== 'string') {
      throw new RangeError('Unknown filter: ' + key + '=' + String(value));
    }
    values.push(found[1]);
  };
  if (Array.isArray(filters)) {
    for (const item of filters) {
      if (typeof item !== 'string' || !item.trim()) throw new TypeError('Filter values must be nonempty strings');
      values.push(item);
    }
  } else if (typeof filters === 'object') {
    for (const [key, value] of Object.entries(filters)) {
      for (const v of Array.isArray(value) ? value : [value]) resolveKey(key, v);
    }
  } else {
    throw new TypeError('filters must be an array or object');
  }
  return [...new Set(values)];
}

function getURL(options = {}) {
  if (typeof options === 'string') options = {type: 'search', query: options};
  if (!options || typeof options !== 'object') throw new TypeError('options must be an object');
  const type = options.type || (options.item ? 'item' : options.query != null ? 'search' : 'top10');
  const href = parseUrl(options.url || (type === 'item' ? options.item : config.baseurl));
  if (!href || !isGeizhalsURL(href) || !href.startsWith('https:')) {
    throw new TypeError('URL must be a HTTPS Geizhals page');
  }
  const url = new URL(href);
  if (type === 'item' || type === 'reviews') {
    if (detectPageType(url.href) !== 'item') throw new TypeError('An item URL ending in -a<ID>.html is required');
    return url.href;
  }
  if (!['top10', 'listing', 'search'].includes(type)) throw new RangeError('Unsupported page type: ' + type);
  const params = url.searchParams;
  if (type === 'search') {
    if (typeof options.query !== 'string' || !options.query.trim()) throw new TypeError('A nonempty search query is required');
    params.set('fs', options.query.trim());
  }
  for (const [key, value] of [
    ['m', options.m ?? options.subcategory],
    ['o', options.o ?? options.category],
    ['cat', options.cat ?? options.finalCategory],
    ['bpmin', options.minPrice],
    ['bqmax', options.maxPrice]
  ]) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  if (options.filters != null) {
    params.delete('xf');
    for (const filter of filterValues(options.filters, options.filterFile)) {
      params.append('xf', filter);
    }
  }
  return url.href;
}

module.exports = {getURL, detectPageType, filterValues};
