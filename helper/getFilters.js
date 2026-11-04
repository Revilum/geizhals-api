'use strict';

const cheerio=require('cheerio');
const {getSite,parseText,parseUrl}=require('../utils');

function parseFilters(html) {
  const $=cheerio.load(String(html ?? ''));
  const filters=new Map();
  $('.xf_tr').not('.xf_tr_collapse_controls').each((_,el)=>{
    const row=$(el);
    const name=parseText(row.children('.xf_th').first().text().replace(/:\s*$/,''));
    if(!name) return;
    const values=filters.get(name)||new Map();
    row.find('.xf_td a').each((_,link)=>{
      const a=$(link);
      const key=parseText(a.find('.xf_v').first().text());
      const href=parseUrl(a.attr('href'));
      const value=href && new URL(href).searchParams.getAll('xf').join('~');
      if(key && value) {
        if(values.has(key) && values.get(key)!==value) {
          throw new RangeError('Ambiguous filter label: '+name+'/'+key);
        }
        values.set(key,value);
      }
    });
    if(values.size) filters.set(name,values);
  });
  return Object.fromEntries([...filters].map(([name,values])=>[name,Object.fromEntries(values)]));
}
async function getFilters(url,options={}) {
  return parseFilters(options.html??await getSite(url,options));
}
module.exports={getFilters,parseFilters};
