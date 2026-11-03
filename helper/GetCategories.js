'use strict';

const cheerio = require('cheerio');
const {getParam, getSite, parseText, parseUrl} = require('../utils');
const config = require('../config/global.json');

function firstImage($, node, baseURL) {
  const srcset = $(node).find('picture source').first().attr('srcset');
  const src = srcset?.split(',')[0]?.trim()?.split(/\s+/)[0] || $(node).find('img').first().attr('src');
  return parseUrl(src, baseURL);
}
function parseCategories(html, baseURL) {
  const $ = cheerio.load(String(html ?? ''));
  const result = {};
  $('.mkat > a, a.nav-m-link[href*="m="]').each((_, el) => {
    const anchor = $(el);
    const href=anchor.attr('href');
    if (getParam(href,'services')) return;
    const title = parseText(anchor.attr('title') || anchor.text());
    const param = getParam(href, config.categories.subCat);
    if(title && param) result[title] = {param,img:firstImage($,el,baseURL)};
  });
  return result;
}
async function getCategories(options = {}) {
  const source=options.html??await getSite(config.baseurl,options);
  return parseCategories(source,config.baseurl);
}
module.exports={getCategories,parseCategories};
