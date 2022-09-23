const fs = require("fs")
const axios = require('axios')
const puppeteer = require('puppeteer')

const config = JSON.parse(fs.readFileSync(__dirname + '/config/global.json', 'utf-8'))

function getParam(params, param) {
    return (new URL(config.baseurl + params).searchParams.get(param))
}

async function getSite(url) {
    return (await axios.get(url, {headers: {
            'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)'
        }})).data
}

async function getFullSite(url) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto(url)
    return await page.content()
}

function parseText(string) {
    return string.toLowerCase().trim().replaceAll(' ', '-').replaceAll('/', '')
}

function parsePrice(price) {
    return price.split(' ')[1] + price.split(' ')[0]
}

function parseUrl(url) {
    if (url.includes('http')) {
        return (new URL(url)).href
    } else {
        return (new URL(config.baseurl + url)).href
    }
}

function sleep() {
    const maxMsSec = 30 * 1000
    const minMsSec = 10 * 1000
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (maxMsSec - minMsSec) + minMsSec)))
}

function getDirectories(path) {
    return fs.readdirSync(path, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
}

module.exports = {getSite, getFullSite, getParam, parseText, sleep, getDirectories, parseUrl, parsePrice}
