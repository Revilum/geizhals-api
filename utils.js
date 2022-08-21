const fs = require("fs")
const axios = require('axios')
const puppeteer = require('puppeteer')

const config = JSON.parse(fs.readFileSync(__dirname + '/config/global.json', 'utf-8'))

function getParam(params, param) {
    return (new URL(config.baseurl + params).searchParams.get(param))
}

async function getSite(url) {
    return (await axios.get(url)).data
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getDirectories(path) {
    return fs.readdirSync(path, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
}

module.exports = {getSite, getFullSite, getParam, parseText, sleep, getDirectories}
