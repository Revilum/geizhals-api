const cheerio = require('cheerio')
const fs = require('fs')
const { baseurl } = require('../index')
const { getPreviewContent } = require('./getSite')
const { getSubcategories } = require('./getSubcategories')
const { getCategories } = require('./getCategories')
console.log(baseurl)

async function getFinalCategories(category, subCategory) {
	const config = JSON.parse(fs.readFileSync('../config/global.json')) // load global.json
	var obj = new Object()
	categories = await getCategories()
	subCategories = await getSubcategories(category)
	
	var url = new URL(baseurl)
	url.searchParams.set(config.mainFilters.subCategory, subCategories[subCategory])
	const $ = cheerio.load(getPreviewContent(url.href))
	
	$('.mocat-item > .mocat-item__link').each(function() {
		console.log($(this).text())
		obj[$(this).text().trim().replace(/ /g, '-').toLowerCase()] = new URL(baseurl + $(this).attr('href')).searchParams.get(config.mainFilters.finalCategory)
	})
	
	return obj
}

module.exports = { getFinalCategories }

getFinalCategories('hardware', 'grafikkarten').then(res => console.log(res))
//getSubcategories('hardware').then(res => console.log(res))
