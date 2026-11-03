# Filter catalog refresh workflow

The original `update-filters.js` had non-awaited writes, incorrect directory cleanup and no reliable automation. This implementation is a **bounded, non-destructive** crawler. It updates only JSON files containing nonempty parsed filters and never deletes existing filter files.

## Run locally

```sh
npm install --ignore-scripts
node --test test/filter-update.test.js
node update-filters.js --dry-run --max-pages 12 --delay-ms 4000 --output filters
node update-filters.js --max-pages 40 --delay-ms 4000 --output filters
```

To focus on a category, pass `--category-offset 0 --category-limit 1`. Optionally use `--subcategory-offset` and `--subcategory-limit`. `--rotate` selects a different category and subcategory over calendar weeks, allowing bounded updates instead of unbounded scraping. The updater stops at the request budget and explicitly marks partial runs.

Each successfully parsed filter JSON file contains a mapping such as:

```json
{"manufacturer": {"amd": "7781_AMD", "intel": "7781_Intel"}}
```

Files are stored under `filters/<main>-m<ID>/<subcategory>-o<ID>/<listing>-<cat>.json`. Use the generated file directly as `filterFile` for the URL builder in the API PR.

## Automation

The `update-filters.yml` GitHub Actions workflow can be triggered manually and schedules a weekly bounded run. It runs the offline unit tests first, attempts a small catalog refresh, then creates a **pull request** containing only changed files under `filters/`. It does not push directly to `main` or auto-merge. The maintainer must enable GitHub Actions to create PRs and grant `contents: write` / `pull-requests: write` for this workflow.

## Fail-closed behavior

- Any 403/429/blocked response or parser mismatch is recorded as an error.
- If no nonempty filter section was parsed, the job **fails**; it does not replace valid catalogs with empty objects.
- The updater does not delete stale entries automatically; they require review.
- The HTTP client accepts only `https://geizhals.de` requests, uses finite timeouts, and does not follow redirects.
- `--dry-run` reads but does not create or overwrite files.
- A limited partial refresh is **not** a guarantee of full category coverage.

## Known limitation

Live verification on 2026-11-03 showed that some Geizhals category/search pages returned HTTP 403. The scheduled workflow may therefore fail until the upstream site's access rules or structure permit parsing. Do not bypass access controls or claim complete coverage.

## Tests

`node --test test/filter-update.test.js` validates navigation extraction, JSON output, no-op updates, dry runs, request budgets, host validation and preservation of existing data on errors. Fixtures are offline and make no requests to Geizhals.