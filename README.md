# geizhals-api

Unofficial JavaScript client for public price and product information from [Geizhals](https://geizhals.de/). This project is **not affiliated with Geizhals**. It parses HTML, so layouts, bot protection and regional differences may break parsers. Respect the website's terms and rate limits. This is not an official or guaranteed commercial API.

**Status:** early development. It is an importable Node.js library, not a hosted HTTP REST server.

## Installation

Node.js 20+ is required.

```bash
npm install
npm test
npm run check
npm run packcheck
```

Optional browser rendering requires Puppeteer, not installed by default:

```bash
npm install puppeteer
```

## JavaScript API

```js
const gh = require('geizhals-api');

const products = await gh.search('Ryzen 7 9800X3D');
const top = await gh.getTop10();
const topCategory = await gh.getTop10({ m: '1', o: '4' });
const item = await gh.getItem('https://geizhals.de/example-a123456.html');
const reviews = await gh.getReviews('https://geizhals.de/example-a123456.html');

const url = gh.getURL({
  type: 'search',
  query: 'Ryzen',
  m: '1',         // subcategory
  o: '4',         // category
  minPrice: 100,
  maxPrice: 500,
  filters: ['7781_AMD'] // Geizhals xf token(s)
});
console.log(url);
```

Defaults use HTTP fetching through axios, without starting Chromium. For pages requiring browser rendering pass `{rendered: true}` to `search`, `getItem` or `getReviews` after installing Puppeteer.

### URLs, item detection and categories

`getURL({type:'item', item:'https://geizhals.de/example-a123456.html'})` validates the item URL. For product listings use `type:'listing'` plus any of `m`, `o`, or `cat`. `detectPageType(url)` classifies item, listing, search or homepage. All query parameters are URL encoded.

### Working with filter catalogs

A generated JSON filter file maps labels to `xf` query values, for example:

```json
{"manufacturer": {"amd": "7781_AMD", "intel": "7781_Intel"}}
```

```js
const url = gh.getURL({
  type: 'search', query: 'cpu',
  filters: {manufacturer: ['AMD', 'Intel']},
  filterFile: './tmp/computer/cpu/category.json'
});
```

Unknown labels throw a validation error rather than silently applying an unrelated filter. Missing prices return `null`, missing numeric ratings return `0`.

### Offline parsing (tests and cached HTML)

```js
const items = gh.parseSearch(searchHtml);
const top = gh.parseTop10(homepageHtml);
const details = gh.parseItem(itemHtml);
const reviews = gh.parseReviews(itemHtml);
const categories = gh.parseCategories(homepageHtml);
const filters = gh.parseFilters(categoryHtml);
```

`getCategories`, `getSubCategories`, `getFinalCategories`, and `getFilters` fetch and parse pages, while `parse*` helpers require no network. All public functions are exported via `index.js`.

## Current limitations

- The selectors remain subject to Geizhals HTML changes; an empty result may reflect unsupported markup, not an actually empty page.
- The review parser only covers visible review blocks. On current product pages, reviews can be loaded dynamically and require additional implementation; it does not bypass sign-in or pagination.
- In a live check on 2026-11-03, the homepage and a product page returned HTML; a search URL returned HTTP 403. CI deliberately does not make live requests.
- The `tmp` filter catalog is generated locally; inspect it before use. No credentials are necessary for the read-only library.
- Publishing to npm is a maintainer decision. The `package.json` and `npm pack --dry-run` only prepare a package; no npm release is performed by this PR.
- Avoid excessive automated requests and honour Geizhals rate limits.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run check
npm run packcheck
```

CI runs deterministic fixtures on Node 20, 22 and 24. Tests do not scrape the live site.

## README roadmap

- [ ] Fully support category-specific top-10 on current Geizhals pages (the URL accepts `m` / `o`, but some category pages have no top-10 block)
- [ ] Automate filter updates (separate proposed maintenance PR)
- [x] Add a URL builder with `filterFile` mapping
- [x] Detect item/listing/search URLs
- [x] Add filter tokens to the search URL
- [x] Add a best-effort reviews endpoint
- [x] Rework URL builder with validation
- [x] Export all documented client methods
- [x] Prepare an npm-installable package with tests and pack checks
- [ ] Schedule automatic filter update pull requests (separate proposed maintenance PR)

Contributions are welcome.
