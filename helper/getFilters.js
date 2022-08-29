const {getSite, parseText, getParam} = require("../utils")
const cheerio = require("cheerio")

async function getFilters(url) {
    let source = await getSite(url)
    const $ = cheerio.load(source)
    let filters = {}
    $('.xf_tr').not('.xf_tr_collapse_controls').each((index, elem) => {
        let category = filters[parseText($(elem).children('.xf_th').text()).replaceAll(':', '')] = {} // init the category with the name
        $(elem).find('.xf_td > a').each((i, link) => {
            category[parseText($(link).children('.xf_v').text())] = getParam($(link).attr('href'), 'xf')
            category.amount = parseInt($(link).children('.xf_n').text().split(/[()]+/)[1])
        })
    })
    return filters
}

module.exports = {getFilters}

// getFilters('https://geizhals.de/?cat=cpuamdam4').then(res => console.log(res))