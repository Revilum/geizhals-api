const cheerio = require('cheerio')
const axios = require('axios')
const puppeteer = require('puppeteer')

const baseurl = 'https://geizhals.de'

function price(price) {
	var arr =  price.trim().replace(',', '.').split(' ')
	return arr[1] + arr[0]
}

async function getItem(url) {
	const browser = await puppeteer.launch()
	const page = await browser.newPage();
	await page.goto(url)
	const $ = cheerio.load(await page.content())
	browser.close()
	var obj = new Object()
	var specs = new Object()
	var imgs = []
	var sellers = []
	var payment = []
	
	obj.name = $('.variant__header__headline').text().trim()
	
	$('.variant__header__specs-grid > .variant__header__specs-grid__item').each(function() {
		var val = $(this).text().trim().split('\n\n')
		specs[val[0]] = val[1] 
	})
	
	$('.slide_videodummy').each(function() {
		imgs.push($(this).find('img').attr('src'))
	})
	
	$('.offer').each(function() {
		var seller = new Object()
		var rating = new Object()
		
		seller.name = $(this).find('.offer__merchant > .gh_offerlist__offerurl > .merchant__logo-caption').text().trim()
		seller.price = price($(this).find('.gh_price').text())
		seller.lastChecked = $(this).find('.offer__details > .offer__disclaimer > b > time').text()
		seller.link = baseurl + $(this).find('.offer_bt').attr('href')
		seller.availability =  $(this).find('.offer__delivery').text().trim()
		
		$(this).children('.offer__price').children('.offer__payment-options').children('.offer__payment-icon').each(function() {
			payment.push($(this).attr('title'))
		})
		
		rating.stars = parseFloat($(this).find('.offer__merchant-rating > .gh_stars__rating > .no--underscore').text().trim())
		rating.ratings = parseInt($(this).find('.offer__merchant-rating > .gh_stars__rating > .rating_amount').text().trim())
		rating.link = baseurl + $(this).find('.offer__merchant-rating > .gh_stars__rating').attr('href')
		
		if (Number.isNaN(rating.ratings)) {
			rating.ratings = 0
		}
		if (Number.isNaN(rating.stars)) {
			rating.stars = 0
		}
		
		seller.rating = rating
		seller.payment = payment
		sellers.push(seller)
	})
	
	obj.sellers = sellers
	obj.specs = specs
	obj.images = imgs
	
	return obj
}

getItem('https://geizhals.de/intel-core-i5-11400f-bx8070811400f-a2492594.html').then(res=> (console.log(res.sellers[0])))
