const cheerio = require('cheerio')
const axios = require('axios')

const baseurl = 'https://geizhals.de'

function price(price) {
	return price..trim().replace(',', '.').split(' ')
}

async function getCPUs(params) {
	var urlext
	if (params.type == 'intel') {
		urlext = '?cat=cpu1151'
	} else if (params.type == 'amd') {
		urlext = '?cat=cpuamdam4'
	} else if (params.type == 'hpc-processors') {
		urlext = '?cat=cpucoproz'
	} else {
		throw new Error('invalid cpu family specified')
	}
	var page = await axios.get(baseurl + urlext + '&bl1_id=1000')
	const $ = cheerio.load(page.data)
	var arr = []
	$('.productlist__product').each(function() {
		var obj = new Object()
		var rating = new Object()
		var prop = new Object()
		var bestPriceOffer = new Object()
		var reviews = new Object()
		$(this).find('.gh_stars').remove()
		rating.stars = parseFloat($(this).find('.rating_details_stardiv').text().trim())
		rating.ratings = parseInt($(this).find('.rating_details_counttext').text().trim())
		rating.link = baseurl + $(this).find('.productlist__rating > a').attr('href').replace('./', '')
		if (Number.isNaN(rating.ratings)) {
			rating.ratings = 0
			rating.stars = 0.0
		}
		
		$(this).find('.notrans').text().trim().split('...').shift().split('•').forEach(x => {
			var removeFirstElement = x.split('\n').pop()
			var split = removeFirstElement.split(':')
			if (split[1] !== undefined) {
				prop[split[0].trim()] = split[1].trim()
			}
		})
		
		bestPriceOffer.seller = $(this).find('.productlist__bestpriceoffer > .gh-merchant-link > a').text().trim()
		bestPriceOffer.country = $(this).find('.productlist__bestpriceoffer > .gh-merchant-link > img').attr('alt').replace('[', '').replace(']', '')
		
		if ($(this).find('.productlist__metascore > .metascore--listview > .no-score')[0]) {
			reviews.reviews = parseInt($(this).find('.productlist__metascore > .metascore--listview > a > span').text())
			if (Number.isNaN(reviews.reviews)) {
				reviews.reviews = 0
			}
		} else if ($(this).find('.productlist__metascore > .metascore--listview > .metascore_visual')[0]) {
			reviews.reviews = parseInt($(this).find('.productlist__metascore > .metascore--listview > .metascore-info').text().trim().split('\n')[0].replace('aus ', ''))
			reviews.score = parseInt($(this).find('.productlist__metascore > .metascore--listview > .metascore_visual').text().trim())
		}
		
		if ($(this).find('.productlist__metascore > a').attr('href') !== undefined) {
			reviews.link = baseurl + $(this).find('.productlist__metascore > a').attr('href')
		}
		
		obj.name = $(this).find('.productlist__item > .productlist__link > .notrans').text().trim()
		obj.link = baseurl + $(this).find('.productlist__item > .productlist__link').attr('href')
		obj.image = $(this).find('picture > img').attr('big-image-url')
		
		var price = $(this).find('.productlist__price > .gh_price > .notrans').text().trim().replace(',', '.').split(' ')
		obj.price = price[1] + price[0]
		
		obj.offers = parseInt($(this).find('.productlist__offerscount--standard').text().trim())
		if (Number.isNaN(obj.offers)) {
			obj.offers = 0
		}
		
		obj.bestPriceOffer = bestPriceOffer
		obj.properties = prop
		obj.rating = rating
		obj.reviews = reviews
		arr.push(obj)
	})
	return arr
}
getCPUs({type: 'amd'}).then(res=> (console.log(res)))
//.split('•')
