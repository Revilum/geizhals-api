const axios = require('axios')
const puppeteer = require('puppeteer')

async function getPreviewContent(url) { // get Site with axios
	return (await axios.get(url).catch(err => {
		throw err
	})).data
}

async function getFullContent(url) { // get Site with puppeteer
	const browser = await puppeteer.launch()
	const page = await browser.newPage();
	await page.goto(url).catch(err => {
		throw err
	})
	var data = await page.content()
	browser.close()
	return data
}

module.exports = { getPreviewContent, getFullContent}
