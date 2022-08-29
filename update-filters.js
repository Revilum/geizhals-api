const fs = require("fs")
const {sleep, getDirectories} = require("./utils")
const {getCategories} = require("./helper/GetCategories")
const {getSubCategories} = require("./helper/getSubCategories")
const {getFinalCategories} = require("./helper/getFinalCategories")
const {getFilters} = require("./helper/getFilters")


const config = JSON.parse(fs.readFileSync('./config/global.json', 'utf-8'))
const keys = config.categories

if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp')

// setInterval(async function() {
async function main() {
    const categories = await getCategories()
    await sleep()
    fs.writeFile("./tmp/categories.json", JSON.stringify(categories, null, 4), err => {if (err) throw err})
    let categoryDirectories = getDirectories('./tmp') // check all folders
    for (const category in categories) {
        if (!fs.existsSync('./tmp/' + category)) { // create folder for category if it doesn't exist
            fs.mkdirSync('./tmp/' + category)
        } else {
            categoryDirectories = categoryDirectories.filter(item => item !== category) // array will contain only redundant folders in the end for deletion
        }
        const subCategoryURL = new URL(config.baseurl)
        subCategoryURL.searchParams.append(keys.subCat, categories[category].param)
        const subCategories = await getSubCategories(subCategoryURL.href)
        await sleep()
        console.log(subCategoryURL.href)
        fs.writeFile('./tmp/' + category + '/' + category + '.json', JSON.stringify(subCategories, null, 4), err => {if (err) throw err})
        let subcategoryDirectories = []
        for (const subCategory in subCategories) {
            if (!fs.existsSync('./tmp/' + category + '/' + subCategory)) { // create folder for subcategory if it doesn't exist
                fs.mkdirSync('./tmp/' + category + '/' + subCategory)
            } else {
                subcategoryDirectories = subcategoryDirectories.filter(item => item !== subCategory) // array will contain only redundant folders in the end for deletion
            }
            const finalCategoryURL = new URL(config.baseurl)
            finalCategoryURL.searchParams.append(keys.final, subCategories[subCategory].param)
            const finalCategories = await getFinalCategories(finalCategoryURL.href)
            await sleep()
            console.log(finalCategoryURL.href)
            let existingFilters = []
            fs.readdirSync('./tmp/' + category + '/' + subCategory + '/', (err, files) => {
                if(err) throw err
                files.forEach(file => existingFilters.push(file))
            })
            for (const finalCategory in finalCategories) {
                console.log(existingFilters)
                const productListURL = new URL(config.baseurl)
                productListURL.searchParams.append(keys.page, finalCategories[finalCategory].param)
                const finalListing = await getFilters(productListURL.href)
                console.log(productListURL.href)
                if (fs.existsSync('./tmp/' + category + '/' + subCategory + '/' + finalCategory + '.json')) {
                    existingFilters = existingFilters.filter(item => item !== finalCategory)
                }
                fs.writeFile('./tmp/' + category + '/' + subCategory + '/' + finalCategory + '.json', JSON.stringify(finalListing, null, 4), err => {if (err) throw err})
                await sleep()
            }
            existingFilters.forEach(file => fs.unlink('./tmp/' + category + '/' + subCategory + '/' + file + '.json', err => {if (err) throw err}))
        }
        for (const dir in subcategoryDirectories) {
            fs.rmSync('./tmp/' + subCategory + '/' + dir, {recursive: true, force: true})  // delete all old filters
        }
    }
    for (const dir in categoryDirectories) {
        fs.rmSync('./tmp/' + dir, {recursive: true, force: true})  // delete all old filters
    }
// }, 1000 * 60 * 60 * 24)
}

main().then()