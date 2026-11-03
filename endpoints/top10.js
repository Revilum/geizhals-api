'use strict';

const cheerio = require('cheerio');
const {getSite, parseUrl, parsePrice, getParam} = require('../utils');
const {getURL} = require('../getURL');

function parseTop10(html) {
  const $ = cheerio.load(String(html ?? ''));
  let rows = $('.box10').first().find('.t10 > .t10i').toArray();
  // Current Geizhals homepage (2026) uses startpage__top10/galleryview instead.
  const current = rows.length === 0;
  if (current) rows = $('.startpage__top10 .galleryview__item').toArray();
  return rows.slice(0,10).map(el=>{
    const item=$(el);
    const anchor=item.find(current ? '.galleryview__name-link' : '.t10a a').first();
    const trend=item.find(current ? '.trend_icon' : '.t10ic').first();
    const trendText=((trend.attr('title') || '')+' '+(trend.attr('class') || '')).toLowerCase();
    const categoryLink=item.find('.link-secondary').first().attr('href');
    return {
      name: anchor.text().trim(),
      img: parseUrl(item.find(current ? '.galleryview__image' : '.t10img img').first().attr('src')
        || item.find(current ? '.galleryview__image' : '.t10img img').first().attr('data-src')),
      price: parsePrice(item.find(current ? '.galleryview__price .gh_price' : '.t10p .gh_price').first().text()),
      change: /t10ic--up|gestiegen|icon-trending-up/.test(trendText) ? 1
        : /t10ic--down|gefallen|icon-trending-down/.test(trendText) ? -1 : 0,
      category: getParam(categoryLink,'cat'),
      link: parseUrl(anchor.attr('href'))
    };
  }).filter(item=>item.name && item.link);
}

async function getTop10(options = {}) {
  if (typeof options === 'string') options={url:options};
  const url=getURL({type:'top10',...options});
  const html=options.html??await getSite(url,options);
  return parseTop10(html);
}

module.exports={getTop10,parseTop10};
