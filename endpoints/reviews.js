'use strict';

const cheerio = require('cheerio');
const {getSite, getFullSite} = require('../utils');
const {getURL} = require('../getURL');

// Best-effort review parsing; selectors are intentionally isolated for site-layout changes.
function parseReviews(html) {
  const $ = cheerio.load(String(html ?? ''));
  return $('.review__item, .review-list__item, [data-review-id]').toArray().map(el=>{
    const row=$(el);
    const starsText=row.find('[data-rating], .review__rating, .stars-value').first();
    const raw=starsText.attr('data-rating') || starsText.text().trim();
    const stars=Number.parseFloat(raw.replace(',','.'));
    return {
      title: row.find('.review__title, .review-title, h3').first().text().trim() || null,
      author: row.find('.review__author, .review-author').first().text().trim() || null,
      date: row.find('time').first().attr('datetime') || row.find('time').first().text().trim() || null,
      stars: Number.isFinite(stars) ? stars : null,
      text: row.find('.review__text, .review-text, .review__body').first().text().trim() || null
    };
  }).filter(item => item.title || item.text);
}
async function getReviews(itemUrl, options = {}) {
  const url=getURL({type:'reviews',url:itemUrl});
  const html=options.html??await (options.rendered?getFullSite(url,options):getSite(url,options));
  return parseReviews(html);
}
module.exports={getReviews,parseReviews};
