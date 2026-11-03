'use strict';

const cheerio=require('cheerio');
const {getParam,getSite,parseText,parseUrl}=require('../utils');
const config=require('../config/global.json');

function parseFinalCategories(html, baseURL) {
  const $=cheerio.load(String(html ?? ''));
  const result={};
  $('.mocat-item').each((_,el)=>{
    const item=$(el);
    const a=item.find('.mocat-item__link').first();
    const name=parseText(a.text());
    const param=getParam(a.attr('href'),config.categories.page);
    const srcset=item.find('picture source').first().attr('srcset');
    const src=srcset?.split(',')[0]?.trim().split(/\s+/)[0] || item.find('img').first().attr('src');
    if(name && param) result[name]={param,img:parseUrl(src,baseURL)};
  });
  return result;
}
async function getFinalCategories(url,options={}) {
  const source=options.html??await getSite(url,options);
  return parseFinalCategories(source,parseUrl(url) || undefined);
}
module.exports={getFinalCategories,parseFinalCategories};
