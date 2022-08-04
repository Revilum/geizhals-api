const fs = require("fs")
const cheerio = require('cheerio')
const {getParam, getSite, parseText} = require("../utils");

const config = JSON.parse(fs.readFileSync('../config/global.json', 'utf-8'))

async function getCategories() {
    const source = await getSite(config.baseurl)
    const $ = cheerio.load(source)
    let categories = {}
    $('.mkat > a').each((index, elem) => {
        if (getParam($(elem).attr('href'), 'services') == null) { // filter out the weird power savings
            let sub = categories[parseText($(elem).attr('title'))] = {} // save category
            sub.param = getParam($(elem).attr('href'), 'm') // save url
            sub.img = (new URL('https:' + $(elem).find('picture > source').attr('srcset').split(' ')[2])).toString()
            // go into the weird source and split out the correct link
        }
    })
    // fs.writeFile('../cache/mainCategories.json', JSON.stringify(categories, null, 4), () => {})
    return categories

}

// getCategories()
