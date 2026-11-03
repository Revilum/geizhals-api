# Follow-up audit and verification — 2026-11-03

Baseline: upstream main `63890bfa502ac982076b793dbe35578cecb3b1a4`, public API proposal `92fddb67973c5e38f5a9040e598a43ceaadd3399`.

The existing API proposal passed 14 tests. The follow-up reproduced additional failures rather than assuming the green suite covered all inputs.

| Finding | Reproduction / fix | Regression coverage |
| --- | --- | --- |
| Grouped whole-euro prices were interpreted as decimals | `parsePrice('EUR 1.299')` returned `€1.30`; now `€1299.00`. Handles million separators, spaces and malformed/negative values. | 11 price cases |
| Fetch URL policy accepted embedded credentials and arbitrary ports | Previously `https://user:pass@geizhals.de:8443/product-a1.html` was accepted. HTTPS, origin, credentials and port are now checked at entry and HTTP redirects. | fetch URL and redirect tests |
| Browser rendering could follow off-site navigation and parse error pages as successes | Request interception, final URL and HTTP status checks; publisher resource allowlist; guaranteed cleanup retaining the original error. | mocked browser failure, interception and bounds tests |
| HTTP responses/timeouts had no safe validated bounds | Added validated timeout and response byte limits; non-HTML and failed statuses rejected. | injected HTTP client tests |
| Search prices accepted negative values and NaN | Finite nonnegative validation and minimum/maximum ordering. | invalid bounds tests |
| Unknown URL paths were called top-10 pages | Unknown paths now stay unknown; listing requires a category. | URL classification tests |
| Numeric filter labels bypassed their catalog | Named filters always resolve through a supplied catalog, including labels like `16`. | numeric mapping and malformed catalog tests |
| Filter catalog selection remained manual | Optional unique category-based lookup in `filterDir`; ambiguous/missing matches fail. | temporary-directory catalog tests |
| Raw filter validation rejected real model-name spaces or accepted malformed types | Typed filter handling and URL-encoded, deduplicated composite `xf` values. | token composition tests |
| Relative result links always became `.de` URLs | Endpoint parsers now receive the requested source URL. | Austrian search/listing/item fixtures |
| Listing URLs had no dedicated exported client | Added `getListing` using the shared listing parser. | offline listing and installed package smoke tests |
| Syntax check omitted helpers, test files and maintenance code | Recursive platform-independent check script. | `npm run check` |
| Package verification only listed hypothetical files | Real pack, offline consumer install and public API smoke test. | `npm run packcheck` |
| Node 20 was the default despite being EOL at review time | Minimum Node 22.12; Linux CI 22/24/26 and Windows 24. | CI configuration; local Windows Node 24.14.1 run |

## Executed locally

- Windows / Node 24.14.1: 38 tests passed, 0 failed (14 original + 24 regressions).
- Full JavaScript syntax check passed (16 files at this API-only stage).
- Actual tarball, offline consumer installation and exported API smoke test passed.
- CI results must be inspected on the PR head; the matrix configuration is not itself a successful run.

## Deliberately not claimed as complete

- Category-specific top-10 when the source page has no matching section.
- Asynchronous reviews, authenticated data and review pagination.
- Live search availability under Geizhals access restrictions.
- npm publication, repository security-setting changes or merging the PRs.
- Browser interception is not a general-purpose network sandbox; use isolated browser infrastructure for untrusted pages.

The filter updater and scheduled update-PR workflow are tracked in the separate maintenance PR. That branch should be tested together with the API branch before merge. See the README roadmap for coverage of each original TODO.

## Primary technical references

- Node test runner: https://nodejs.org/api/test.html
- Supported Node releases: https://nodejs.org/en/about/previous-releases
- Axios request configuration: https://axios-http.com/docs/req_config
- Puppeteer interception: https://pptr.dev/guides/request-interception/

No production deployment, scheduled task or application server was created for this audit. Source changes are limited to the repository checkout and PR branches; tests use fixtures rather than a live scraping loop.
