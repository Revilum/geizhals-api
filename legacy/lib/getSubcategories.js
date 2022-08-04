const fs = require('fs')
const cheerio = require('cheerio')
const { getPreviewContent } = require('./getSite')
const { getCategories } = require('./getCategories')
const { baseurl } = require('../index')

async function getSubcategories(category) {
	const config = JSON.parse(fs.readFileSync('../config/global.json')) // load global.json
	var categories = await getCategories()
	var obj = new Object()
	
	var url = new URL(baseurl)
	url.searchParams.set(config.mainFilters.category, categories[category]) // set url category parameter
	const $ = cheerio.load(await getPreviewContent(url.href))
	$('.mocat-item > .mocat-item__link').each(function() { // iterate through each row
		obj[$(this).text().replace(/ /g, '-').trim().toLowerCase()] = new URL(baseurl + $(this).attr('href')).searchParams.get(config.mainFilters.subCategory) // text in link is identifier and attr o in href is value
	})
	
	return obj
}

module.exports = { getSubcategories }
