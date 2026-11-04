'use strict';

const cheerio = require('cheerio');
const {getParam, getSite, parseText, parseUrl} = require('../utils');
const config=require('../config/global.json');

function parseSubCategories(html, baseURL) {
  const $=cheerio.load(String(html ?? ''));
  const result={};
  $('.mocat-item').each((_, el)=>{
    const item=$(el);
    const anchor=item.find('.mocat-item__link').first();
    const name=parseText(anchor.text());
    const param=getParam(anchor.attr('href'),config.categories.final);
    const srcset=item.find('picture source').first().attr('srcset');
    const src=srcset?.split(',')[0]?.trim().split(/\s+/)[0] || item.find('img').first().attr('src');
    if(name && param) result[name]={param,img:parseUrl(src,baseURL)};
  });
  return result;
}
async function getSubCategories(url,options={}) {
  const source=options.html??await getSite(url,options);
  return parseSubCategories(source,parseUrl(url) || undefined);
}
module.exports={getSubCategories,parseSubCategories};
