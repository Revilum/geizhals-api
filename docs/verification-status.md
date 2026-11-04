# Verification status — 2026-11-04

## Second review: catalog and installed-consumer contracts

Starting revision: `383d959b2064f3b2340fa5cfc1202c02a362b8db`. This follow-up fixes the independently reproduced catalog identity, normalization, parsing, stored-token, partial-coverage and inherited-parameter findings described in [the second review](review-2026-11-04-second-pass.md). The Operator approved the new `PROJECT-CONTEXT.md` baseline. Earlier results below remain historical evidence.

Windows / Node 24.14.1 / npm 11.11.0:

- Fresh starting suite: **94/94**; final repaired suite: **131/131** tests, including 37 new tests.
- Syntax: **28 JavaScript files**; synthetic offline demo passed.
- Locked install into an isolated seed directory: **50 packages**, lifecycle scripts disabled; task-local cache reused by the offline consumer.
- Actual installed tarball: parser/catalog/URL and injected-refresh/discovery/URL round trips, unchanged repeated refresh, exported API and installed CLI help all passed.
- Production dependency audit: **0 reported vulnerabilities**. Both unchanged workflows pass actionlint 1.7.12 (shellcheck/pyflakes integrations disabled).
- Independent review: **66 focused tests**, then **18 affected integrity tests** rerun after its final malformed-link finding was repaired; no remaining actionable finding. Root reran all 131 tests, syntax and package checks after that last repair.
- `git diff --check` passed. No performance benchmark or coverage percentage is claimed.

Automatic catalog discovery now requires exact `cat.<id>.json` or ID-only `<id>.json` names; ambiguous legacy suffix paths require explicit `filterFile` or reviewed migration. Existing files are not automatically renamed/deleted. The filename-only preflight scan follows public discovery's bounded depth/entry rules; it does not parse unrelated JSON files or provide filesystem sandboxing. Multi-file writes remain nontransactional.

The prior exact-source hosted run `41820640882` was rechecked and still reports a billing lock before jobs start. The final PR delivery record identifies any new run after this source change is pushed. No live request, refresh dispatch, opt-in, billing/policy change, merge or npm publication occurred during this follow-up. Live markup and real Chromium-wide isolation remain unverified.

## Review and repair of PR #3

Starting revision: `1018eab8092d281facf5b69ace9fc4609dce1dc8`. The follow-up change preserves the integration history and draft status. See [review findings](review-2026-11-04.md) for reproduced failures, scoped standards and remaining limitations.

Windows / Node 24.14.1 / npm 11.11.0:

| Check | Observed result |
| --- | --- |
| Locked install without lifecycle scripts | Passed; 50 packages |
| Baseline deterministic suite | 85 passed, 0 failed |
| Repaired deterministic suite | 94 passed, 0 failed |
| JavaScript syntax | 25 files passed |
| Synthetic offline demo | Passed |
| Actual tarball and offline installed consumer | Passed; public API, maintenance command help, new linked guidance files |
| Production dependency audit | 0 vulnerabilities reported |
| Both workflow files | actionlint 1.7.12 passed; shellcheck/pyflakes integrations disabled |
| Independent cross-review | MIME: 29 focused tests; final updater: 29 focused tests; no remaining actionable finding |
| Whitespace | `git diff --check` passed |

Nine tests were added and an existing partial-coverage assertion was strengthened. The behavioral defects were reproduced before their respective fixes; a normal complete/idempotent refresh and supported response media variants still pass. This establishes specific correctness improvements, not a measured performance gain or a coverage percentage.

The exact baseline's source-fork push run [41694964409](https://github.com/hxwxdmhd/geizhals-api/actions/runs/41694964409) was rechecked on 2026-11-04: GitHub check annotations report an account billing lock before job execution. Hosted checks are not claimed green. Source-fork repository variables were empty; no `ENABLE_FILTER_REFRESH` opt-in was configured. No live website request, workflow dispatch, schedule enablement, billing/policy change, merge or npm publication was performed in this review. New hosted-run status belongs in the PR delivery record; an offline pass cannot replace it.

Live extraction, real Chromium network isolation and multi-file transactional writes remain outside the demonstrated guarantees. Current-site fixtures and permitted access are still prerequisites for unattended use. Existing case-conflicting or previously truncated catalog paths require manual review; no migration/deletion is performed.

## Historical integration evidence — 2026-11-03

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
