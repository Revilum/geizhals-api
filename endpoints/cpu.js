const cheerio = require('cheerio')
const axios = require('axios')

const baseurl = 'https://geizhals.de/'

async function getCPU(url) {
	var page = await axios.get(url)
	const $ = cheerio.load(page.data)
	
	var obj = new Object()
	var specs = new Object()
	var img = new Object()
	var imgarr = []
	
	obj.name = $('.variant__header__headline').text().trim()
	
	$('.variant__header__specs-grid > .variant__header__specs-grid__item').each(function() {
		var val = $(this).text().trim().split('\n\n')
		specs[val[0]] = val[1] 
	})
	
	$('.slide_container').each(function() {
		imgarr.push($(this).find('.slide_videodummy > img').attr('src'))
		console.log($(this).find('.gal_img').attr('src'))
	})
	imgarr.forEach(x => {
		img[imgarr.indexOf(x)] = x
	})
	
	obj.specs = specs
	obj.images = img
	
	return obj
}

getCPU('https://geizhals.de/intel-core-i5-11400f-bx8070811400f-a2492594.html').then(res=> (console.log('res')))
