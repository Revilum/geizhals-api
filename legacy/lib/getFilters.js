const cheerio = require('cheerio')
const {getPreviewContent, baseurl} = require('../index')

async function getFilters(url) {
	const $ = cheerio.load(await getPreviewContent(url)) // load site into cheerio
	var obj = new Object()

	$('.xf_tr:not(.xf_tr_collapse_controls)').each(function() { // iterate though each row in the filter table but not the controls
		var filter = new Object()        
		$(this).find('.xf_i').each(function() { // iterate though each row in the filter table
			filter[$(this).find('.xf_v').text().trim().replace(/ /g, '-').toLowerCase()] = (new URL(baseurl + $(this).attr('href'))).searchParams.get('xf')//.replace(/ /g, '+')  // set name as indentifer and url param as value
		})
		obj[$(this).find('.xf_th').text().trim().replace(':', '').replace(/ /g, '-').toLowerCase()] = filter // set row title as identifer and the filter object as value
	})
	return obj
}

module.exports = { getFilters }
