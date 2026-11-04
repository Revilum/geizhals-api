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
- Bound HTTP response bytes and timeouts. Accept only `text/html`, `application/xhtml+xml`, `text/plain` or a missing Content-Type; optional parameters are allowed, different MIME subtypes are rejected.
- Deduplicate navigation, skip services links and normalize filenames; rotate main categories, subcategories **and leaf categories**. Explicit offsets/limits are available at every level.
- Stage parsed data in memory until crawling completes. On HTTP 401/403/429, no staged catalog is written, even if earlier pages parsed successfully.
- Normalize newly parsed filter group/choice labels with the same Unicode-aware function as the public API, without filename truncation. Repeated groups and repeated `xf` parameters retain their values; conflicting normalized labels reject instead of choosing one.
- Validate **all existing destination catalogs in the current batch** before the first write, including token syntax and normalized group/choice uniqueness. Equivalent incoming labels match existing spellings without renaming those keys. A corrupt destination catalog does not allow an earlier prepared catalog to be partially updated.
- Scan filenames (not unrelated JSON contents) within the output tree to detect exact-ID duplicates and ambiguous legacy candidates before writing. The scan skips directory symlinks and directories deeper than depth 4, matching public discovery. Exceeding 10,000 entries or encountering an identity conflict aborts before the write phase. A category mapped to multiple staged paths also rejects rather than creating an ambiguous catalog set.
- Reject destination names or directory components differing only by case, both within the staged batch and against existing paths, before writing. This keeps Linux-generated catalogs safe to use on case-insensitive filesystems. Resolve ambiguous legacy paths manually; no file is renamed or deleted automatically.
- Preserve old groups and choices absent from returned HTML. This prevents truncated filter pages from erasing known data. It also deliberately retains possibly stale entries, which need manual review.
- Write changed files using a unique temporary file and rename, cleaning temporary files on failure. Each file replacement is atomic; the full multi-file batch is **not** a transactional filesystem operation. Disk failure can leave earlier files committed and later files untouched.
- Dry runs parse, merge and report changes without creating the output directory or modifying files.
- Return `partial` and sorted `partialReasons` (budget, category/subcategory/leaf limits, empty pages/navigation, request errors, `invalid-navigation`, `invalid-filter-page` and `retained-existing-choices`), not merely a deceptively complete success flag. Rejected navigation/filter candidates and retained old choices signal incomplete observed coverage even when all selected pages were fetched. Known expansion controls, unrelated navigation and duplicate identical links do not imply partial coverage.
- Never delete a catalog or automatically merge a PR.

A file currently has this layout:

```text
filters/<main-label>-m<id>/<sub-label>-o<id>/cat.<cat>.json
```

The API's `filterDir` lookup matches the complete identity filename `cat.<cat>.json` or an explicit ID-only `<cat>.json`. It no longer infers an ID from a human-readable filename suffix: `shared-a-foo.json` cannot establish whether the category is `foo` or `a-foo`. Exact category spelling and full length are preserved. The fixed leaf filename also remains stable when the leaf's human label changes. More than one identity-safe match is an error; specify `filterFile` to select a known catalog.

### Compatibility with existing catalogs

This is an intentional compatibility change for automatic `filterDir` discovery. Legacy `<label>-<cat>.json` files still work with an explicit `filterFile`, which leaves category/path selection with the caller. Without a new identity-safe match, automatic lookup rejects ambiguous legacy suffix matches with an actionable error.

If refresh would create a new target while a legacy candidate exists, or an exact-ID catalog already exists at another path, it aborts before writing any file. This includes ID-only files and catalogs under renamed parent directories. Manually verify the category identity and reconcile retained choices before migrating a file to the documented layout. Do not infer an ambiguous ID solely from its old suffix. When the intended new target exists, ambiguous legacy suffix files remain untouched and the new target is authoritative; additional exact-ID files still reject. No automatic rename, deletion or migration is performed.

## Weekly/manual GitHub workflow

`.github/workflows/update-filters.yml` contains:

1. A locked install on Node 24 and the full syntax/test suite.
2. A budget of 40 requests, 4 seconds between requests, one main category, three subcategories, at most ten leaf pages per selected subcategory.
3. A JSON coverage report in the workflow summary.
4. A proposed draft PR on `automation/geizhals-filter-refresh`, restricted to `filters/**/*.json`; no direct default-branch update or automatic merge.

### Required maintainer actions

After review and merge, set repository variable **`ENABLE_FILTER_REFRESH=true`** to opt into the weekly Monday 06:20 UTC schedule, or explicitly run `workflow_dispatch` with the default branch selected. Other manually selected branches/tags are skipped, keeping a consistent proposal base. Scheduled runs are skipped without opt-in. Fork workflows may also require enabling Actions. The repository must permit `GITHUB_TOKEN` to create pull requests, with the workflow job's `contents: write` and `pull-requests: write` permissions. No personal access token is required or requested by this patch.

`GITHUB_TOKEN`-created/updated PRs do not automatically trigger the usual push/PR checks. The workflow creates drafts and re-drafts bot updates. A maintainer must mark the catalog PR **Ready for review**; the `ready_for_review` event starts Node.js checks on that revision. Wait for successful checks before merging. This uses the [documented v7 draft workflow](https://github.com/peter-evans/create-pull-request/blob/v7/docs/concepts-guidelines.md#triggering-further-workflow-runs).

The workflow serializes refreshes with a concurrency group and retains its automation branch. A denied or rate-limited request fails the fetch step; the PR-creation step does not run. Normal API tests never invoke the live crawler.

## Verification and limits

The integration of maintenance head `f344279` with API commit `11c1f17` passed **85 deterministic tests** on Windows, Node 24.14.1, including the original 7 updater tests, 15 updater-safety regressions, and adapted maintenance-entry checks. Cases cover HTTP 401/403/429 after a successfully parsed page, invalid budgets, corrupted on-disk JSON, non-destructive merging, rotation wraparound, leaf selection, safe import, CLI help/invalid options and dry runs. The full syntax check passed for 25 JavaScript files; the offline demo also passed.

Package verification uses the repository's locked dependency graph, installs a real tarball into a temporary consumer offline, checks the `refreshFilters` export and packaged maintenance files, and runs the installed `geizhals-update-filters --help` binary through npm. The isolated cache was initially empty and seeded only by `npm ci`. These checks make no live crawler requests. See [verification status](verification-status.md) for the remaining external gates.

Live filter-page extraction still needs successful access and representative current fixtures; earlier live requests returned HTTP 403. This PR does not mark that limitation resolved by passing offline tests. Only legacy `.xf_tr` filter markup and the documented navigation patterns are supported. Unknown layouts must not be treated as a complete catalog.
