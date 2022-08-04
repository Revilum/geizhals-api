const fs = require('fs')

function getURL(obj, filters) {
    const config = JSON.parse(fs.readFileSync(__dirname + '/config/global.json', 'utf8'))
    const filtersobj = JSON.parse(fs.readFileSync(__dirname + '/config/cpu2.json', 'utf8'))
    var url = new URL(obj.url)
    // iterate through every param in obj.values
    for (attr in obj.values) {
        // set val and param for URL
        var param = config.identifier[attr]
        var val
        // if value in global.json is undefined then use the provided one
        val = config.values[attr] === undefined ? obj.values[attr] : config.values[attr][obj.values[attr]]
        // add param and value to URL
        url.searchParams.append(param, val)
        // if requiredValue exists for this filter add it to the URL
        if (config.requiredValues[attr] !== undefined) {
            url.searchParams.append(config.requiredValues[attr].param, config.requiredValues[attr].val)
        }
    }
    // iterate through every param in obj.arrays
    for (attr in obj.arrays) {
        // set val and param for URL
        var param = config.identifier[attr]
        var val
        // iterate through the provided array and add all elements
        obj.arrays[attr].forEach(e => {
            val = config.values[attr][e]
            url.searchParams.append(param, val)
        })
        // if requiredValue exists for this filter add it to the URL
        if (config.requiredValues[attr] !== undefined) {
            url.searchParams.append(config.requiredValues[attr].param, config.requiredValues[attr].val)
        }
    }
    var filtervalue = ""
    // iterate through each element in the filter obj
    for (filter in filters) {
        // go through the array and set every filtervalue
        filters[filter].forEach (f => {
            filtervalue = filtervalue + filtersobj[filter][f] + '~'
        })
    }
    // remove last ~ from filtervalue
    filtervalue = filtervalue.slice(0, -1)
    url.searchParams.append('xf', filtervalue)

    return decodeURIComponent(url)
}


console.log(getURL({
    "url": "https://geizhals.de/",
    "values": {
        "category": "amd",
        "minPrice": "20",
        "includeDescription": false
    },
    "arrays": {
        "country": ["ger", "uk", "pl"]
    },
},
{
//    "chipsets": ["a320", "b350"],
    "segments": ["mainstream"]
}))
