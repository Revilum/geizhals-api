'use strict';

const cheerio = require('cheerio');
const {getSite, getFullSite, parseUrl, parsePrice} = require('../utils');
const {getURL} = require('../getURL');

function parseItem(html, baseURL) {
  const $ = cheerio.load(String(html ?? ''));
  const specs = {};
  const images = [];
  const sellers = [];

  // Legacy and current (2026) product specs.
  $('.variant__header__specs-grid > .variant__header__specs-grid__item, .specs-grid__item').each((_,el)=>{
    const row=$(el);
    const key=row.find('dt').first().text().trim();
    const val=row.find('dd').first().text().trim();
    if(key && val) {specs[key]=val;return;}
    const text=row.text().trim().split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
    if(text.length>1) specs[text[0]]=text.slice(1).join(' ');
  });
  $('.slide_videodummy img, .variant__gallery img, .gallery .swiper-slide__image').each((_,el)=>{
    const url=parseUrl($(el).attr('src') || $(el).attr('data-src'), baseURL);
    if(url && !images.includes(url)) images.push(url);
  });
  $('.offer').each((_,el)=>{
    const row=$(el);
    const rating=row.find('.offer__merchant-rating').first();
    const amount=rating.find('.rating_amount, .stars-rating-label-bottom').first().text().trim();
    const starsText=rating.find('.no--underscore, .stars-rating-label [aria-hidden="true"]').first().text().trim();
    const ratingCount=Number.parseInt(amount.replace(/\D/g,''),10);
    const ratingStars=Number.parseFloat(starsText.replace(',','.'));
    const link=row.find('.offer_bt').first().attr('href');
    const ratingLink=rating.find('.gh_stars__rating').first().attr('href');
    sellers.push({
      name:row.find('.merchant__logo-caption').first().text().trim(),
      price:parsePrice(row.find('.gh_price').first().text()),
      lastChecked:row.find('.offer__disclaimer time').first().text().trim() || null,
      link:parseUrl(link, baseURL),
      availability:row.find('.offer__delivery-time').first().text().trim() || row.find('.offer__delivery').first().text().trim() || null,
      payment:row.find('.offer__payment-icon').toArray().map(el=>$(el).attr('title')).filter(Boolean),
      rating:{
        stars:Number.isFinite(ratingStars)?ratingStars:0,
        ratings:Number.isNaN(ratingCount)?0:ratingCount,
        link:parseUrl(ratingLink, baseURL)
      }
    });
  });
  return {name:$('.variant__header__headline, h1').first().text().trim(),sellers,specs,images};
}

async function getItem(url,options={}) {
  const resolved=getURL({type:'item',item:url});
  const html=options.html??await (options.rendered ? getFullSite(resolved,options):getSite(resolved,options));
  return parseItem(html, resolved);
}

module.exports={getItem,parseItem};
