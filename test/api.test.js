'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const api=require('..');

const home = '<div class="box10"><div class="t10"><div class="t10i"><span class="t10a"><a href="/example-gpu-a12345.html">Example GPU</a></span><div class="t10img"><img src="//img.geizhals.de/gpu.jpg"></div><div class="t10p"><strong><span class="gh_price">ab € 969,90</span></strong></div><span class="t10ic t10ic--up"></span><a class="link-secondary" href="/?cat=gra16_512">Grafikkarten</a></div></div></div>';
const listing='<div class="listview__item"><a class="listview__name-link" href="/product-a99.html">AMD Test CPU</a><img class="listview__image" src="/cpu.png"><span class="price">€ 1.299,00</span><a class="listview__offercount-link">12 Angebote</a><span class="listview__availability"></span><span class="stars-value">4,5</span></div>';
const item='<h1 class="variant__header__headline">Example GPU</h1><div class="variant__header__specs-grid"><div class="variant__header__specs-grid__item">Memory\n\n16 GB</div></div><div class="slide_videodummy"><img src="//img.geizhals.de/gpu.jpg"></div><div class="offer"><div class="merchant__logo-caption">Shop A</div><span class="gh_price">€ 999,99</span><a class="offer_bt" href="/offer?id=1"></a><span class="offer__delivery">lagernd</span><span class="offer__payment-icon" title="PayPal"></span></div>';
const reviews='<div class="review__item" data-review-id="1"><h3>Very good</h3><span class="review__author">Reviewer</span><time datetime="2025-04-01"></time><span data-rating="4.5"></span><div class="review__text">Worked well</div></div>';
const menu='<div class="mkat"><a title="PC-Hardware" href="/?m=1"><picture><source srcset="//img.geizhals.de/a.png 1x"></picture></a><a title="Services" href="/?services=yes&amp;m=8">skip</a></div>';
const cats='<div class="mocat-item"><a class="mocat-item__link" href="/?o=4">Processors</a><picture><source srcset="//img.geizhals.de/p.png 1x"></picture></div>';
const filters='<div class="xf_tr"><div class="xf_th">Manufacturer:</div><div class="xf_td"><a href="/?xf=7781_AMD"><span class="xf_v">AMD</span><span class="xf_n">(22)</span></a></div></div>';

test('common URL parsing and SSRF guard',async ()=>{
  assert.equal(api.parseUrl('/?cat=cpu'), 'https://geizhals.de/?cat=cpu');
  assert.equal(api.parseUrl('javascript:alert(1)'),null);
  assert.equal(api.getParam('/?m=1','m'),'1');
  assert.equal(api.getParam(undefined,'m'),null);
  assert.equal(api.isGeizhalsURL('https://geizhals.at/'),true);
  assert.equal(api.isGeizhalsURL('https://geizhals.de.evil.example/'),false);
  await assert.rejects(api.getSite('http://127.0.0.1/internal'),/Only HTTPS Geizhals/);
});
test('prices parse thousands and euro formats',()=>{
  assert.equal(api.parsePrice('ab € 969,90'),'€969.90');
  assert.equal(api.parsePrice('€ 1.299,00'),'€1299.00');
  assert.equal(api.parsePrice('1.099,99 €'),'€1099.99');
  assert.equal(api.parsePrice('1500 €'),'€1500.00');
  assert.equal(api.parsePrice(''),null);
});
test('category and subcategory URLs and page classification',()=>{
  const first=new URL(api.getURL({type:'top10',m:1,o:4}));
  assert.equal(first.searchParams.get('m'),'1');
  assert.equal(first.searchParams.get('o'),'4');
  assert.equal(api.detectPageType(first.href),'listing');
  assert.equal(api.detectPageType('https://geizhals.de/a-test-a2492594.html'),'item');
  assert.equal(api.detectPageType('https://geizhals.de/?fs=cpu'),'search');
  assert.equal(new URL(api.getURL({type:'search',query:'RTX 5080 & OLED'})).searchParams.get('fs'),'RTX 5080 & OLED');
  assert.throws(()=>api.getURL({type:'item',item:'https://evil.example/a99.html'}),/Geizhals/);
});
test('human-readable filters resolve through JSON catalog and raw xf values',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gh-filters-'));
  try {
    const file=path.join(tmp,'category.json');
    fs.writeFileSync(file,JSON.stringify({manufacturer:{amd:'7781_AMD',intel:'7781_Intel'}}));
    const url=new URL(api.getURL({type:'search',query:'cpu',filters:{manufacturer:['AMD','Intel']},filterFile:file,minPrice:100,maxPrice:300}));
    assert.deepEqual(url.searchParams.getAll('xf'),['7781_AMD~7781_Intel']);
    assert.equal(url.searchParams.get('bpmin'),'100');
    assert.equal(url.searchParams.get('bqmax'),'300');
    assert.throws(()=>api.filterValues({manufacturer:'missing'},file),/Unknown filter/);
    assert.deepEqual(api.filterValues(['12','13','12']),['12','13']);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
test('top-10 parser preserves name, price, price change and category',async()=>{
  const items=api.parseTop10(home);
  assert.equal(items.length,1);
  assert.equal(items[0].name,'Example GPU');
  assert.equal(items[0].price,'€969.90');
  assert.equal(items[0].category,'gra16_512');
  assert.equal(items[0].change,1);
  assert.deepEqual(await api.getTop10({html:home,m:1}),items);
  assert.deepEqual(api.parseTop10(''),[]);
});
test('search parser survives missing optional attributes and exports usable search',async()=>{
  const items=api.parseSearch(listing);
  assert.equal(items.length,1);
  assert.equal(items[0].name,'AMD Test CPU');
  assert.equal(items[0].price,'€1299.00');
  assert.equal(items[0].availability,null);
  assert.equal(items[0].offers,12);
  assert.deepEqual(await api.search('AMD',{html:listing}),items);
});
test('item parser tolerates missing merchant fields',async()=>{
  const value=api.parseItem(item);
  assert.equal(value.name,'Example GPU');
  assert.equal(value.specs.Memory,'16 GB');
  assert.equal(value.sellers[0].price,'€999.99');
  assert.equal(value.sellers[0].rating.ratings,0);
  assert.equal(value.sellers[0].payment[0],'PayPal');
  assert.deepEqual(await api.getItem('https://geizhals.de/example-a12345.html',{html:item}),value);
  assert.equal(api.parseItem('').sellers.length,0);
});
test('review parser only includes actual review content',async()=>{
  const value=api.parseReviews(reviews);
  assert.equal(value[0].title,'Very good');
  assert.equal(value[0].author,'Reviewer');
  assert.equal(value[0].stars,4.5);
  assert.deepEqual(await api.getReviews('https://geizhals.de/example-a12345.html',{html:reviews}),value);
  assert.deepEqual(api.parseReviews('<html></html>'),[]);
});
test('category, subcategory, final category, filters exported as pure parsers',()=>{
  assert.equal(api.parseCategories(menu)['pc-hardware'].param,'1');
  assert.equal(api.parseSubCategories(cats).processors.param,'4');
  assert.equal(api.parseFinalCategories(cats).processors,undefined);
  const final=api.parseFinalCategories(cats.replace('?o=4','?cat=cpuamdam4'));
  assert.equal(final.processors.param,'cpuamdam4');
  assert.equal(api.parseFilters(filters).manufacturer.amd,'7781_AMD');
});
test('browser instances always close on navigation failures',async()=>{
  let closed=0;
  const launch=async()=>({
    newPage:async()=>({setRequestInterception:async()=>{},on:()=>{},goto:async()=>{throw new Error('navigation failed')},content:async()=>'<html></html>'}),
    close:async()=>{closed++;}
  });
  await assert.rejects(api.getFullSite('https://geizhals.de/',{launch}),/navigation failed/);
  assert.equal(closed,1);
});
test('axios client injection and endpoint use sanitized Geizhals URL',async()=>{
  let target='';
  const html=await api.getSite('https://geizhals.de/?fs=AMD',{client:{get:async(href)=>{target=href;return {data:'ok'}}}});
  assert.equal(html,'ok');
  assert.equal(target,'https://geizhals.de/?fs=AMD');
});

test('2026 Geizhals gallery top-10 markup is parsed',()=>{
  const html='<section class="startpage__top10"><article class="galleryview__item"><span class="trend_icon" title="In den Top 10 gestiegen"></span><h3 class="galleryview__name"><a class="galleryview__name-link" href="asus-prime-a3430251.html">ASUS GPU</a></h3><img class="galleryview__image" src="https://gzhls.at/pix/test.webp"><div class="galleryview__price"><span class="gh_price">€ 969,90</span></div></article></section>';
  const result=api.parseTop10(html);
  assert.equal(result.length,1);
  assert.equal(result[0].name,'ASUS GPU');
  assert.equal(result[0].price,'€969.90');
  assert.equal(result[0].change,1);
  assert.equal(result[0].link,'https://geizhals.de/asus-prime-a3430251.html');
});
test('2026 Geizhals spec grid and merchant ratings work',()=>{
  const html='<h1 class="variant__header__headline">GPU</h1><dl class="specs-grid"><div class="specs-grid__item"><dt>Speicher</dt><dd>16GB GDDR6</dd></div></dl><div class="gallery"><img class="swiper-slide__image" src="https://gzhls.at/pix/gpu.webp"></div><div class="offer"><span class="gh_price">€ 969,90</span><div class="merchant__logo-caption">Shop</div><div class="offer__delivery-time">Auf Lager</div><div class="offer__merchant-rating"><a class="gh_stars__rating"><span class="stars-rating-label"><span aria-hidden="true">3.3</span></span><span class="stars-rating-label-bottom">122 Bewertungen</span></a></div></div>';
  const result=api.parseItem(html);
  assert.equal(result.specs.Speicher,'16GB GDDR6');
  assert.equal(result.images.length,1);
  assert.equal(result.sellers[0].rating.stars,3.3);
  assert.equal(result.sellers[0].rating.ratings,122);
  assert.equal(result.sellers[0].availability,'Auf Lager');
});
test('2026 homepage category navigation is parsed',()=>{
  assert.equal(api.parseCategories('<a class="nav-m-link" href="/?m=1">Hardware</a>').hardware.param,'1');
  assert.throws(()=>api.filterValues({manufacturer:'AMD'}),/filterFile/);
});
