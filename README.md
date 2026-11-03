# geizhals-api

Unofficial Node.js client for public price and product information from [Geizhals](https://geizhals.de/). **Not affiliated with Geizhals.** This is an HTML-parsing library, not an official API or a hosted REST service. Respect the site's terms, robots policy and rate limits. Do not use it to bypass access controls.

## Status and installation

Early development. Use **Node.js 22.12 or later**, preferably a supported LTS release. The package is prepared for distribution but this change does **not** publish it to npm.

From a checkout containing these changes:

```sh
npm ci --ignore-scripts
npm run demo
npm test
npm run check
npm run packcheck
```

`packcheck` creates a real tarball, installs it into a temporary consumer **offline** using the dependency graph from `package-lock.json`, and verifies the public API. Run `npm ci` first so the locked dependency tarballs are cached; a previously populated registry metadata cache is not required. Temporary artifacts are removed. To build a distributable yourself, run `npm pack`; then install that `.tgz` in a consumer project. Do not assume the same-name npm registry package contains this implementation.

`npm run demo` exercises the public API with clearly labeled synthetic HTML and
builds a search URL. It makes no network requests and does not need Puppeteer.
This is a Node.js library; it does not start a web server. Live examples below
depend on access to Geizhals and can return HTTP 403.

## JavaScript API

```js
const gh = require('./'); // In this checkout; use require('geizhals-api') after installing its tarball.

async function main() {
  console.log(await gh.search('Ryzen'));
  console.log(await gh.getTop10());
  console.log(await gh.getTop10({m: '1', o: '4'}));
  console.log(await gh.getListing({cat: 'cpuamdam4'}));
}

main().catch(error => {
  console.error(error.message); // A blocked request is an error, not an empty success.
  process.exitCode = 1;
});
```

For an actual product URL ending in `-a<ID>.html` (or `/a<ID>.html`):

```js
// Inside an async function; productUrl must be a real public product URL.
const item = await gh.getItem(productUrl);
const reviews = await gh.getReviews(productUrl);
```

| Export | Purpose |
| --- | --- |
| `search(query, options)` | Search-result items |
| `getListing(options)` | Category listing; requires `m`, `o` or `cat` |
| `getTop10(options)` | Up to ten entries from a top-10 HTML section |
| `getItem(url, options)` | Name, specs, images and merchant offers |
| `getReviews(url, options)` | **Best-effort visible HTML reviews**, not a complete review service |
| `getCategories(options)` | Main navigation groups |
| `getSubCategories(url, options)` | Subcategory navigation |
| `getFinalCategories(url, options)` | Leaf-category navigation |
| `getFilters(url, options)` | Filter labels and `xf` values |
| `getURL(options)` / `detectPageType(url)` | URL construction and classification |
| `filterValues(filters, file)` / `resolveFilterFile(options)` | Filter catalog resolution |
| `refreshFilters(options)` | Explicit, bounded filter-catalog maintenance |

Pure parsers (`parseSearch`, `parseTop10`, `parseItem`, `parseReviews`, `parseCategories`, `parseSubCategories`, `parseFinalCategories`, `parseFilters`) require no network. `parseSearch`, `parseTop10`, `parseItem`, `parseCategories`, `parseSubCategories` and `parseFinalCategories` optionally take a base URL as their second argument. Fetching endpoints preserve the selected `.de`, `.at` or `.eu` origin in relative product, image and offer links, including subcategory and final-category images. `getCategories()` continues to fetch the configured homepage; use `parseCategories(html, baseURL)` for cached HTML from another region.

## URLs and filters

```js
const url = gh.getURL({
  type: 'search',
  query: 'RTX & OLED',
  m: '1',                 // Main navigation group
  o: '4',                 // Subgroup
  cat: 'cpuamdam4',        // Leaf category, where applicable
  minPrice: 100,
  maxPrice: 500,
  filters: ['7781_AMD', '132_16384']
});
```

`getURL('CPU')` is shorthand for a search URL. Supported types are `search`, `listing`, `top10`, `item` and `reviews`. `detectPageType` returns `top10` for a bare homepage (`/`, `/index.php` or `/index.html`); it does not return a separate `homepage` type. Explicit item URLs are validated. Unknown paths are not classified as the homepage. Prices must be finite and nonnegative; minimum cannot exceed maximum. Userinfo, nonstandard ports and non-Geizhals fetch origins are rejected. Query values are URL encoded; multiple filter tokens are combined into one `xf` value separated by `~`. A raw token may contain spaces, such as a GPU model name.

Search, listing and top-10 builders require a homepage or index path in `url`.
An explicit listing/top-10 operation removes inherited `fs`/`asuch` search
parameters, so a copied search URL cannot silently change the requested operation.
Category parameters inherited from `url` receive the same validation as explicit options.

For named filters, a JSON catalog maps labels to raw values:

```json
{"manufacturer":{"amd":"7781_AMD"},"memory":{"16":"132_16384"}}
```

```js
const url = gh.getURL({
  type: 'listing',
  cat: 'cpuamdam4',
  filters: {manufacturer: 'AMD', memory: '16'},
  filterFile: './filters/hardware/processors-cpuamdam4.json'
});
```

The file must exist. Alternatively set `filterDir: './filters'` and omit `filterFile`: a bounded, non-symlink-following scan selects exactly one `<cat>.json` or `*-<cat>.json` file. Missing or ambiguous catalogs raise an error; an explicit `filterFile` takes precedence. Numeric labels such as `16` are resolved through the catalog rather than silently becoming a raw filter ID. Unknown labels and malformed catalogs are rejected.

`parsePrice` preserves the original string return convention (`€1299.00`), recognizes German thousands separators, and returns `null` for unavailable or malformed prices. Missing numeric merchant ratings retain the legacy `0` convention; a missing price is never reported as zero.

## HTTP and optional rendering

HTTP via Axios is the default; importing the library does not fetch pages, start Chromium or write sample files. For fixtures/cached HTML, supply `{html: yourHtml}`.

- `timeout`: positive integer in milliseconds, at most 120000; defaults to 20000 for HTTP or 30000 for rendering.
- `maxBytes`: positive integer, at most 50 MiB; defaults to 5 MiB for returned HTML.
- `client`: optional Axios-compatible test client.
- `rendered: true`: use optional Puppeteer for `search`, `getListing`, `getItem`, `getReviews` or `getTop10`.

```sh
npm install puppeteer
```

Chromium always closes after success or failure. HTTP error statuses and non-HTML response media types are rejected in both fetching modes (plain text and absent media-type headers remain supported). Request interception is enabled before navigation; service workers are bypassed when the page supports that Puppeteer method. Each intercepted navigation or redirect must use HTTPS on `geizhals.de`, `geizhals.at` or `geizhals.eu` (with optional `www.`). HTTP subresources must use HTTPS on those domains, `gzhls.at` or their subdomains. Credentials and nonstandard ports are rejected; non-network `data:` and `blob:` resources are allowed. Off-policy requests are aborted, and the final page URL is checked before returning HTML.

The policy applies to intercepted requests on the created page; it is **not a browser-wide egress firewall or a replacement for network/process sandboxing**. The publisher/CDN domains and their subdomains are trusted for resources. Rendering waits for `domcontentloaded`, not every asynchronous widget. It does not bypass a 403, CAPTCHA, sign-in requirement or pagination. The HTML byte limit is not a memory limit on Chromium itself. Deterministic browser-policy tests use mocked Puppeteer requests, not a real Chromium network test.

## Filter maintenance

The bounded maintenance client is exported as `refreshFilters(options)`, available as `node update-filters.js` / `npm run filters:update -- ...`, and included in the tarball as `geizhals-update-filters`.

```sh
npm run filters:update -- --help
npm run filters:update -- --dry-run --rotate --category-limit 1 --subcategory-limit 1 --final-category-limit 1 --max-pages 4 --delay-ms 3000 --output filters
```

The updater stages results before writing, aborts the entire crawl on HTTP 401/403/429, preserves existing choices absent from a fetched page, and reports incomplete coverage explicitly. Each file is atomically replaced; this is not a multi-file filesystem transaction.

The weekly workflow is **opt-in**: after review/merge, a maintainer may set the repository variable `ENABLE_FILTER_REFRESH=true` or invoke it manually. It uses locked dependencies and proposes a review PR; it never publishes npm packages, merges PRs or pushes directly to the default branch. Repository policy must permit `GITHUB_TOKEN` to create pull requests. No workflow/policy setting was enabled by this patch. See [filter maintenance](docs/filter-updates.md).

## Development checks

- `npm test`: deterministic offline unit/regression tests using Node's test runner, without shell globs.
- `npm run check`: syntax-checks all JavaScript source, helpers, tests and maintenance scripts, not just the main endpoints.
- `npm run packcheck`: actual tarball + offline consumer installation + exported API smoke test.
- `npm audit --omit=dev --audit-level=high`: online dependency advisory check.

CI is configured for Linux on Node 22/24/26 and Windows on Node 24. Fork/external PR jobs may require maintainer approval. Configuring CI is not proof that the remote jobs have passed.

## Original README roadmap — honest coverage

| Original item | Coverage / remaining work |
| --- | --- |
| Top-10 for category/subcategory (`o`, `m`) | URL support and legacy/current section parsers implemented. **Partial:** category pages without a top-10 section cannot supply this data. No fabricated listing-as-top-10 fallback. |
| Automate filter updates | Implemented here with bounded requests and an opt-in workflow; live HTML access and permissions remain prerequisites. |
| Finalize `getURL` with the correct filter file | Implemented: explicit catalog or unique auto-selection by leaf category. |
| Distinguish item from listing | Implemented, with an exported listing client. |
| Add filters to search | Implemented: raw/named filters, composition, encoding and price checks. |
| Reviews endpoint | **Partial:** visible HTML parsing exists. Dynamically loaded reviews and pagination need verified markup/API access. |
| Rework `getURL` | Implemented and regression tested. |
| Make all functions accessible | Public library functions exported from `index.js`. |
| Create npm package | Tarball and consumer smoke test implemented. **Not published.** |
| Automated filter commits | Implemented opt-in workflow creates review PRs, not direct/default-branch pushes or merges; not enabled remotely. |

A previous live check returned HTTP 403 for search. Offline tests prove parser behavior against fixtures, not continued availability of the website. An empty parse result may indicate unsupported markup rather than genuinely absent products or reviews. See `docs/audit.md` for the follow-up regression findings.

License: GPL-3.0-only; original license retained.
