'use strict';

const cheerio=require('cheerio');
const {getSite,parseText,getParam}=require('../utils');

function parseFilters(html) {
  const $=cheerio.load(String(html ?? ''));
  const filters={};
  $('.xf_tr').not('.xf_tr_collapse_controls').each((_,el)=>{
    const row=$(el);
    const name=parseText(row.children('.xf_th').first().text().replace(/:\s*$/,''));
    if(!name) return;
    const values={};
    row.find('.xf_td a').each((_,link)=>{
      const a=$(link);
      const key=parseText(a.find('.xf_v').first().text());
      const value=getParam(a.attr('href'),'xf');
      if(key && value) values[key]=value;
    });
    if(Object.keys(values).length) filters[name]=values;
  });
  return filters;
}
async function getFilters(url,options={}) {
  return parseFilters(options.html??await getSite(url,options));
}
module.exports={getFilters,parseFilters};
