const {getSite, parseText, getParam} = require("../utils")
const cheerio = require("cheerio")

async function getFinalCategories(url) {
    const source = await getSite(url)
    const $ = cheerio.load(source)
    let finalCategories = {}
    $('.mocat-item').each((index, elem) => {
        let sub = finalCategories[parseText($(elem).find('.mocat-item__link').text())] = {}
        sub.param = getParam($(elem).find('.mocat-item__link').attr('href'), 'cat')
        sub.img = (new URL($(elem).find('.mocat-item__body > .mocat-item__image > picture > source').attr('srcset').split(' ')[2])).toString()
    })
    // fs.writeFile('finalCategories.json', JSON.stringify(finalCategories, null, 4), (err) => {console.log(err)})
    return finalCategories
}

module.exports = {getFinalCategories}

// getFinalCategories('https://geizhals.de/?o=4')
