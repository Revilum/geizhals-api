const {getSite, parseText, getParam} = require("../utils")
const cheerio = require("cheerio")

async function getSubCategories(url) {
    const source = await getSite(url)
    const $ = cheerio.load(source)
    let subCategories = {}
    $('.mocat-item').each((index, elem) => {
        let sub = subCategories[parseText($(elem).find('.mocat-item__link').text())] = {}
        sub.param = getParam($(elem).find('.mocat-item__link').attr('href'), 'o')
        sub.img = (new URL('https:' + $(elem).find('.mocat-item__body > .mocat-item__image > picture > source').attr('srcset').split(' ')[2])).toString()
    })
    // fs.writeFile('subCategories.json', JSON.stringify(subCategories, null, 4), (err) => {console.log(err)})
    return subCategories
}

module.exports = {getSubCategories}

// getSubCategories('https://geizhals.de/?m=1')
