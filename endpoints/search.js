const cheerio = require('cheerio')
const puppeteer = require('puppeteer')

const baseurl = 'https://geizhals.de/'

function price(price) {
  var price = price.trim().replace(',', '.').split(' ')
  return price[1]+price[0]
}

async function search(q)
{
  const browser = await puppeteer.launch()
  const page = await browser.newPage();
  await page.goto(`${baseurl}?fs=${q}`)
  const $ = cheerio.load(await page.content())
  browser.close()

  var arr = []  
  $('.listview__item').each(function () {
    var item = new Object()
    item.name = $(this).find('.listview__name-link').text().trim()
    item.link = baseurl + $(this).find('.listview__name-link').attr('href')
    item.icon = $(this).find('.listview__image').attr('src')
    item.price = price($(this).find('.price').text().trim())
    item.offers = parseInt($(this).find('.listview__offercount-link').text())
    item.availability = $(this).find('.listview__availability').attr('aria-label').trim()
    item.discount = $(this).find('.discount-badge').text().trim() != '' ? $(this).find('.discount-badge').text().trim().substr(1) : "0%"
    item.ratings = $(this).find('.listview__rating-text').text() != '' ? parseInt($(this).find('.listview__rating-text').text().trim().substr(2)) : 0
    item.stars = $(this).find('.stars-value').text() != '' ? parseFloat($(this).find('.stars-value').text()) : 0
    arr.push(item)
  })
  return arr
}
search("AMD").then(res=>console.log("res"))
