const cheerio = require('cheerio')
const puppeteer = require('puppeteer')

const baseurl = 'https://geizhals.de'

async function start(url) {
    const browser = await puppeteer.launch()
	const page = await browser.newPage();
	await page.goto(url)
	const $ = cheerio.load(await page.content())
	browser.close()

    var obj = new Object()

    $('.xf_tr').each(function() {
        var filter = new Object()

        $(this).find('.xf_i').each(function() {
            filter[$(this).find('.xf_v').text().trim().replace(' ', '-').toLowerCase()] = (new URL(baseurl + $(this).attr('href'))).searchParams.get('xf')
        })

        obj[$(this).find('.xf_th').text().trim().replace(':', '').replace(' ', '-').toLowerCase()] = filter
    })
    return obj
}

start('https://skinflint.co.uk/?cat=cpuamdam4').then(res => console.log(res))