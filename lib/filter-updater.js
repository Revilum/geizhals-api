'use strict';

const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
const cheerio = require('cheerio');

const HOME = 'https://geizhals.de/';

function geizhalsUrl(value) {
  const parsed = new URL(value, HOME);
  if (parsed.protocol !== 'https:' || !['geizhals.de','www.geizhals.de'].includes(parsed.hostname)) {
    throw new TypeError('Only HTTPS pages on geizhals.de may be crawled');
  }
  return parsed.href;
}

function slug(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,65);
}

function parseNavigation(html, param) {
  if (!['m','o','cat'].includes(param)) throw new TypeError('Unknown category parameter');
  const $ = cheerio.load(String(html ?? ''));
  const selector = param==='m' ? '.mkat > a, a.nav-m-link[href*="m="]'
    : param==='o' ? '.mocat-item a[href*="o="], .mocat-item__link, a.nav-o-link'
    : '.mocat-item a[href*="cat="], a.nav-cat-link, .mocat-item__link';
  const seen = new Set();
  return $(selector).toArray().map(el=>{
    const a=$(el);
    const href=a.attr('href');
    if (!href) return null;
    let url;
    try { url=new URL(geizhalsUrl(href)); } catch { return null; }
    const value=url.searchParams.get(param);
    if (!value || !/^[\w-]{1,90}$/.test(value) || seen.has(value)) return null;
    const label=a.attr('title') || a.text().trim();
    const safeLabel=slug(label);
    if (!safeLabel || safeLabel==='mehr' || safeLabel==='more') return null;
    seen.add(value);
    return {name:safeLabel,param:value};
  }).filter(Boolean);
}

function parseFilters(html) {
  const $=cheerio.load(String(html ?? ''));
  const output={};
  $('.xf_tr').not('.xf_tr_collapse_controls').each((_,el)=>{
    const row=$(el);
    const title=slug(row.children('.xf_th').first().text().replace(/:\s*$/,''));
    if (!title) return;
    const choices={};
    row.find('.xf_td a').each((_,a)=>{
      const elem=$(a);
      const label=slug(elem.find('.xf_v').first().text());
      if(!label) return;
      let value;
      try {value=new URL(geizhalsUrl(elem.attr('href'))).searchParams.get('xf');}
      catch{return;}
      if(value && value.length<=120 && !/\s/.test(value))choices[label]=value;
    });
    if(Object.keys(choices).length) {
      output[title]=Object.fromEntries(Object.entries(choices).sort(([a],[b])=>a.localeCompare(b)));
    }
  });
  return Object.fromEntries(Object.entries(output).sort(([a],[b])=>a.localeCompare(b)));
}

async function fetchHtml(url, options={}) {
  const target=geizhalsUrl(url);
  const client=options.client || axios;
  const response=await client.get(target,{
    timeout:20000,
    responseType:'text',
    // Do not follow a redirect to a non-Geizhals host or an internal network.
    maxRedirects:0,
    headers:{
      'User-Agent':'geizhals-api-filter-maintenance/1.0',
      Accept:'text/html,application/xhtml+xml'
    }
  });
  return response.data;
}

function writeIfChanged(destination, content, options={}) {
  const text=JSON.stringify(content,null,2)+'\n';
  const previous=fs.existsSync(destination)?fs.readFileSync(destination,'utf8'):null;
  if (previous===text)return false;
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    const temp=destination+'.tmp-'+process.pid;
    fs.writeFileSync(temp,text,'utf8');
    fs.renameSync(temp,destination);
  }
  return true;
}

function browseUrl(param,value) {
  const url=new URL(HOME);
  url.searchParams.set(param,value);
  return url.href;
}

const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function refreshFilters(options={}) {
  const outputDir=path.resolve(options.outputDir || path.join(process.cwd(),'filters'));
  const maxPages=Math.max(1,Math.min(300,Math.floor(options.maxPages ?? 80)));
  const delayMs=Math.max(0,options.delayMs ?? 3000);
  const fetch=options.fetchPage || fetchHtml;
  const dryRun=Boolean(options.dryRun);
  let requests=0,parsed=0,changed=0;
  const errors=[];
  const created=[];
  async function load(url) {
    if(requests>=maxPages)return null;
    requests++;
    try {return await fetch(geizhalsUrl(url));}
    catch(e) {
      errors.push({url,message:String(e?.message||e).slice(0,250)});
      return null;
    } finally {
      if(delayMs>0)await wait(delayMs);
    }
  }
  const home=await load(HOME);
  const categories=parseNavigation(home,'m');
  if(!categories.length) throw new Error('Could not discover any main categories. Site layout/access may have changed.');
  const rotate=Boolean(options.rotate);
  const week=Math.floor((options.now??Date.now())/(7*86400000));
  const offset=rotate?week % categories.length : Math.max(0,Math.floor(options.categoryOffset??0));
  const categoryLimit=Math.max(1,Math.floor(options.categoryLimit??categories.length));
  const selected=categories.slice(offset,offset+categoryLimit);
  for(const cat of selected) {
    if(requests>=maxPages)break;
    const subHtml=await load(browseUrl('m',cat.param));
    const subs=parseNavigation(subHtml,'o');
    const subOffset=rotate && subs.length ? Math.floor(week/categories.length)%subs.length
      : Math.max(0,Math.floor(options.subcategoryOffset??0));
    const subLimit=Math.max(1,Math.floor(options.subcategoryLimit??subs.length));
    for(const sub of subs.slice(subOffset,subOffset+subLimit)){
      if(requests>=maxPages)break;
      const finalHtml=await load(browseUrl('o',sub.param));
      const finals=parseNavigation(finalHtml,'cat');
      for(const final of finals) {
        if(requests>=maxPages)break;
        const page=await load(browseUrl('cat',final.param));
        const filters=parseFilters(page);
        if(!Object.keys(filters).length)continue; // Never overwrite with empty data.
        parsed++;
        const file=path.join(
          outputDir,
          cat.name+'-m'+slug(cat.param),
          sub.name+'-o'+slug(sub.param),
          final.name+'-'+slug(final.param)+'.json'
        );
        if(writeIfChanged(file,filters,{dryRun}))changed++;
        created.push(path.relative(outputDir,file).split(path.sep).join('/'));
      }
    }
  }
  if(!parsed) {
    throw new Error('No nonempty filter data found. Existing catalogs were left untouched. Errors: '+
      errors.slice(0,3).map(e=>e.message).join('; '));
  }
  return {requests,parsed,changed,dryRun,errors,files:created,
    partial:requests>=maxPages||selected.length<categories.length};
}

module.exports={geizhalsUrl,slug,parseNavigation,parseFilters,fetchHtml,writeIfChanged,browseUrl,refreshFilters};
