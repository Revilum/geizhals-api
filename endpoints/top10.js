const cheerio = require('cheerio')
const { getSite, parseText, parseUrl, getParam, parsePrice} = require('../utils')
const fs = require('fs')
const config = JSON.parse(fs.readFileSync('../config/global.json', 'utf-8'))

async function getTop10(url) {
	const $ = cheerio.load(await getSite(url))
	return $('.box10').first().find('.t10 > .t10i').toArray()
		.map(elem => {
			const name = parseText($(elem).find('.t10a > .flex > .line-clamp > a').text())
			const img = parseUrl($(elem).find('.t10img > a > img').attr('src'))
			const price = parsePrice($(elem).find('.t10p > strong > .gh_price').text())
			let change = $(elem).find('.t10ic')
			if (change.hasClass('t10ic--up')) change =  1
			else if (change.hasClass('t10ic--down')) change = -1
			else change = 0
			const category = getParam(parseUrl($(elem).find('.link-secondary').attr('href')), config.categories.page)
			return {name, img, price, change, category}
		})
}

module.exports = {getTop10}
// getTop10('https://geizhals.de/?m=1').then(res=> (console.log(res)))
