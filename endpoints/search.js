'use strict';

const cheerio = require('cheerio');
const {getSite, getFullSite, parseUrl, parsePrice} = require('../utils');
const {getURL} = require('../getURL');

function parseSearch(html) {
  const $ = cheerio.load(String(html ?? ''));
  return $('.listview__item').toArray().map(element => {
    const row = $(element);
    const link = row.find('.listview__name-link').first();
    const img = row.find('.listview__image').first();
    const availability = row.find('.listview__availability').first();
    const offerCount = Number.parseInt(row.find('.listview__offercount-link').first().text().replace(/\D/g, ''), 10);
    const rawRating = row.find('.listview__rating-text').first().text();
    const discount = row.find('.discount-badge').first().text().trim();
    const stars = Number.parseFloat(row.find('.stars-value').first().text().replace(',', '.'));
    return {
      name: link.text().trim(),
      link: parseUrl(link.attr('href')),
      icon: parseUrl(img.attr('src') || img.attr('data-src')),
      price: parsePrice(row.find('.price, .gh_price').first().text()),
      offers: Number.isNaN(offerCount) ? 0 : offerCount,
      availability: availability.attr('aria-label') || availability.text().trim() || null,
      discount: discount || '0%',
      ratings: Number.parseInt(rawRating.replace(/\D/g, ''),10) || 0,
      stars: Number.isFinite(stars) ? stars : 0
    };
  }).filter(item => item.name && item.link);
}

async function search(query, options = {}) {
  const url = getURL({type:'search',query, ...options});
  const html = options.html ?? await (options.rendered ? getFullSite(url,options) : getSite(url,options));
  return parseSearch(html);
}

module.exports = {search, parseSearch};
