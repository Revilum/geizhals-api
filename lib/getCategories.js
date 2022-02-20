const cheerio = require('cheerio')
const fs = require('fs')
const { baseurl } = require('../index')
const { getPreviewContent } = require('./getSite')

async function getCategories() {
	const $ = cheerio.load(await getPreviewContent(baseurl))
	const config = JSON.parse(fs.readFileSync('../config/global.json')) // load global.json
	obj = new Object()
	
	$('.mkat > .mkatimg[href!="./?services=1"]').each(function() { // iterate through all field which are not using the special service
		obj[$(this).attr('title').replace(/ /g, '-').toLowerCase()] = new URL(baseurl + $(this).attr('href')).searchParams.get(config.mainFilters.category) // add the title as identier and the parameter m as value for obj
	})
	
	return obj
}

module.exports = { getCategories }
