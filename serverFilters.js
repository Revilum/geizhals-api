const cheerio = require('cheerio')
const axios = require('axios')
const fs = require('fs')

const baseurl = 'https://geizhals.de'

var globalConfig = JSON.parse(fs.readFileSync('./config/global.json', err => {throw err}))

async function getConfig(url) {
	var site = await axios.get(url)
	const $ = cheerio.load(site.data)

    var obj = new Object()

    $('.xf_tr').each(function() {
        var filter = new Object()
        
        $(this).find('.xf_i').each(function() {
            filter[$(this).find('.xf_v').text().trim().replace(/ /g, '-').toLowerCase()] = (new URL(baseurl + $(this).attr('href'))).searchParams.get('xf').replace(/ /g, '+')
        })
        obj[$(this).find('.xf_th').text().trim().replace(':', '').replace(/ /g, '-').toLowerCase()] = filter
    })
    return obj
}

getConfig("https://geizhals.de/?cat=umtsover").then (res => console.log(res))
