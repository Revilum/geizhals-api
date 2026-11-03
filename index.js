'use strict';

const {search,getListing,parseSearch} = require('./endpoints/search');
const {getItem,parseItem} = require('./endpoints/item');
const {getTop10,parseTop10} = require('./endpoints/top10');
const {getReviews,parseReviews} = require('./endpoints/reviews');
const {getURL,detectPageType,filterValues,resolveFilterFile} = require('./getURL');
const {getCategories,parseCategories} = require('./helper/GetCategories');
const {getSubCategories,parseSubCategories} = require('./helper/getSubCategories');
const {getFinalCategories,parseFinalCategories} = require('./helper/getFinalCategories');
const {getFilters,parseFilters} = require('./helper/getFilters');
const utils = require('./utils');

module.exports = {
  search, getListing, getItem, getTop10, getReviews, getURL, detectPageType, filterValues, resolveFilterFile,
  parseSearch, parseItem, parseTop10, parseReviews,
  getCategories, getSubCategories, getFinalCategories, getFilters,
  parseCategories, parseSubCategories, parseFinalCategories, parseFilters,
  ...utils
};
