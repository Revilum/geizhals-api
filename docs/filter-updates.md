# Filter catalog maintenance

This maintenance change is stacked on the public API PR: **review/merge #2 before #3**. Its Node 22.12+ runtime, locked dependency tree and test tools match the client package. It does not merge anything or enable repository policy settings itself.

## Usage

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run filters:update -- --help
npm run filters:update -- --dry-run --rotate --category-limit 1 --subcategory-limit 1 --final-category-limit 1 --max-pages 4 --delay-ms 3000 --output filters
```

Omit `--dry-run` only after checking access, coverage and the intended destination. `--output` is relative to the process working directory unless it is absolute. For an installed tarball, the `geizhals-update-filters` binary and `require('geizhals-api').refreshFilters` expose the same implementation.

No Chromium, credentials or live requests are needed for unit tests. Live crawling is explicit. HTTP 401, 403 or 429 causes an immediate stop after that request; do not attempt to bypass the site's restriction.

## Safeguards

- Validate request budget (1..300), live delay (1000..60000 ms), offsets, limits and timestamps before any fetch. NaN, infinity, fractions and unsafe integers are rejected.
- Fetch only HTTPS on `geizhals.de`/`www.geizhals.de`, without embedded credentials or nonstandard ports. Maintenance fetches do not follow redirects.
- Bound HTTP response bytes and timeouts.
- Deduplicate navigation, skip services links and normalize filenames; rotate main categories, subcategories **and leaf categories**. Explicit offsets/limits are available at every level.
- Stage parsed data in memory until crawling completes. On HTTP 401/403/429, no staged catalog is written, even if earlier pages parsed successfully.
- Reject ambiguous normalized filter labels instead of silently choosing the wrong value.
- Validate **all existing catalog JSON** before the first write. A corrupt catalog does not allow an earlier prepared catalog to be partially updated.
- Preserve old groups and choices absent from returned HTML. This prevents truncated filter pages from erasing known data. It also deliberately retains possibly stale entries, which need manual review.
- Write changed files using a unique temporary file and rename, cleaning temporary files on failure. Each file replacement is atomic; the full multi-file batch is **not** a transactional filesystem operation. Disk failure can leave earlier files committed and later files untouched.
- Dry runs parse, merge and report changes without creating the output directory or modifying files.
- Return `partial` and sorted `partialReasons` (budget, category/subcategory/leaf limits, empty pages/navigation, request errors), not merely a deceptively complete success flag.
- Never delete a catalog or automatically merge a PR.

A file currently has this layout:

```text
filters/<main-label>-m<id>/<sub-label>-o<id>/<leaf-label>-<cat>.json
```

The API's `filterDir` lookup can discover these generated files by explicit leaf `cat`. More than one matching catalog is an error; specify `filterFile` to disambiguate. Label changes can create a second path, so review duplicate/stale catalogs manually.

## Weekly/manual GitHub workflow

`.github/workflows/update-filters.yml` contains:

1. A locked install on Node 24 and the full syntax/test suite.
2. A budget of 40 requests, 4 seconds between requests, one main category, three subcategories, at most ten leaf pages per selected subcategory.
3. A JSON coverage report in the workflow summary.
4. A proposed PR on `automation/geizhals-filter-refresh`, restricted to `filters/**/*.json`; no direct default-branch update or automatic merge.

### Required maintainer actions

After review and merge, set repository variable **`ENABLE_FILTER_REFRESH=true`** to opt into the weekly Monday 06:20 UTC schedule, or explicitly run `workflow_dispatch`. Scheduled runs are skipped without opt-in. Fork workflows may also require enabling Actions. The repository must permit `GITHUB_TOKEN` to create pull requests, with the workflow job's `contents: write` and `pull-requests: write` permissions. No personal access token is required or requested by this patch.

The workflow serializes refreshes with a concurrency group and retains its automation branch. A denied or rate-limited request fails the fetch step; the PR-creation step does not run. Normal API tests never invoke the live crawler.

## Verification and limits

The integrated API + updater tree passed **60 deterministic tests** on Windows, Node 24.14.1, including the original 7 updater tests and 15 additional updater-safety regressions. Cases cover HTTP 401/403/429 after a successfully parsed page, invalid budgets, corrupted on-disk JSON, non-destructive merging, rotation wraparound, leaf selection, CLI help and dry runs.

Live filter-page extraction still needs successful access and representative current fixtures; earlier live requests returned HTTP 403. This PR does not mark that limitation resolved by passing offline tests. Only legacy `.xf_tr` filter markup and the documented navigation patterns are supported. Unknown layouts must not be treated as a complete catalog.
