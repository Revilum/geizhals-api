# Verification status — 2026-11-03

This maintenance integration combines PR #3 head `f34427928036ab41ff71629cb37182fe11c69058` with PR #2 commit `11c1f17c7bd382bfca3b0a9e8510ffb788a32605`. Review and merge #2 before #3. If #2 is squash-merged or rebased, reconcile #3's remaining diff and test the resulting merge candidate again.

## Local integration checks

Executed on Windows, Node 24.14.1 / npm 11.11.0:

| Check | Observed result |
| --- | --- |
| Locked install without lifecycle scripts | Passed; 50 packages installed using an initially empty isolated cache |
| Combined API + maintenance suite | 85 passed, 0 failed |
| Full JavaScript syntax check | Passed, 25 files |
| Offline synthetic API demo | Passed; no network requests |
| Real tarball and offline consumer | Passed; public API and `refreshFilters` exports, maintenance files, bin metadata/link, installed CLI help |
| Production dependency audit | 0 vulnerabilities reported |
| Independent combined code/security review | No actionable findings; 31 focused offline tests passed independently |
| Git whitespace checks | Passed |

The maintenance CLI remains the guarded, bounded implementation from PR #3. Its import does not initiate a refresh. Tests use fixtures, help, and invalid options; none executes the bare CLI or a live crawl. PR #2's disabled legacy-updater tests were adapted to these integrated semantics.

The consumer package check now reuses the locked dependency graph instead of resolving dependency ranges offline. It retains PR #2's browser-policy/category regressions and package fix together with PR #3's maintenance export, files, and binary checks. The manifest and lockfile root `bin` metadata are checked for agreement.

## External gates and limitations

- The latest inspected PR #3 GitHub Actions run, `41690063008` at `f344279`, did not execute its jobs. Its check annotations explicitly report an account-level billing lock. This is an external prerequisite, not evidence of a failing test. A successful local run does not replace Linux Node 22/24/26 and Windows Node 24 CI results for the updated head.
- Earlier permitted live filter requests returned HTTP 403. No new live crawler request was made for this integration. Current filter extraction remains unverified; only legacy `.xf_tr` filter markup and the documented navigation patterns have fixture coverage. Unknown or empty layouts cannot establish complete catalog coverage.
- Browser-policy tests use mocked Puppeteer requests, not real Chromium network isolation. The documented publisher/CDN trust boundary remains.
- Category-specific top-10 availability, asynchronous reviews and pagination remain limited by available markup and permitted access.
- No npm package was published, no upstream PR was merged, and no schedule, account billing or repository policy setting was changed by this integration.

Keep PR #3 draft until its live extraction limitation is resolved or explicitly accepted as a release limitation. The source fork's Actions variable list was checked during delivery: no repository variables were configured, so `ENABLE_FILTER_REFRESH` was unset. No refresh was dispatched. After review/merge, a maintainer must deliberately opt into scheduled refresh with `ENABLE_FILTER_REFRESH=true` and permit `GITHUB_TOKEN` PR creation. The command never merges automatically or pushes directly to the default branch.

See `README.md`, `docs/audit.md`, `docs/filter-updates.md`, and `docs/ai-assistance.md` for API coverage, maintenance safeguards, historical audit evidence and attribution.
