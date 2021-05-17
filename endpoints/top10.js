const cheerio = require('cheerio')
const axios = require('axios')

const baseurl = 'https://geizhals.de/'

async function getTop10() {
	var arr = []
	var page = await axios.get(baseurl)
	const $ = cheerio.load(page.data)
	$('.t10 > li').each(function() {
		var obj = new Object()
		obj.name = $(this).find('.line-clamp > a').text().trim()
		obj.link = baseurl + $(this).find('.line-clamp > a').attr('href')
		var price = $(this).find('.gh_price').text().replace(',', '.').split(' ')
		obj.price = price[1] + price[0]
		obj.icon = $(this).find('.t10img > a > img').attr('src')
		arr.push(obj)
	})
	return arr
}
getTop10().then(res=> (console.log(res)))
//getTop10()
