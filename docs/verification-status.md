# Verification status — 2026-11-03

This file supplements the original pull-request descriptions, which may still describe the earlier proposals. It is **not** a claim that all release checks pass.

## Published changes

- API proposal: upstream PR #2, branch `fix/public-api-url-parsers-20261103`, functional audit commit `a66586089a0bf22b52ff03df3fb597a1ea84f10d` plus documentation-packaging commit `6c2282729d63134820f88c1a30abd50e0ee4a40b`.
- Maintenance proposal: upstream draft PR #3, branch `fix/filters-cron-20261103`, functional maintenance commit `5c5772480c4201dc52830c03ad789d115dcb567b`.
- PR #3 now contains the API changes for integrated testing. Review/merge #2 first. If #2 is squash-merged or rebased, reconcile #3's history and recheck its remaining diff before merging.

## Checks actually executed

| Check | Observed result |
| --- | --- |
| API regression suite | 38 passed, 0 failed on Windows / Node 24.14.1 |
| API-only full JavaScript syntax check | Passed, 16 files |
| API-only tarball and offline consumer installation/import | Passed |
| Production dependency audit | 0 vulnerabilities reported at the time checked |
| Integrated API + maintenance unit suite | 60 passed, 0 failed before the final maintenance export/packaging edits |
| Integrated full JavaScript syntax check | Passed, 19 files after maintenance export/packaging edits |
| Git staged whitespace checks | Passed before publishing each functional commit |
| Fresh bounded live filter dry run | HTTP 403; stopped without writing staged catalogs |
| Final integrated package/CLI consumer smoke | **Unresolved:** timed out, including a rerun with a 60-second child-process limit |
| Final post-packaging unit rerun | Did not execute: it followed the failed smoke check in an `&&` command chain |
| GitHub-hosted CI matrix | **Blocked before execution:** GitHub annotation reports an account-level billing lock |

The workstation subsequently timed out on basic read commands as well. This does not establish that the package is faulty or that it is correct: the final integrated consumer check needs another run on a responsive environment. Do not count the timeout as a passing check. The earlier green unit suite likewise does not replace verification of the final packaged entry points.

## Remaining gates

1. Restore a responsive test environment; run locked install, all tests, full syntax checks, and the real packaged consumer/CLI checks on the current heads.
2. Resolve the GitHub account issue and rerun Linux Node 22/24/26 and Windows Node 24 checks. No billing settings, runner registration or repository policy settings were changed by this work.
3. Obtain permitted live-site access and current fixtures before claiming complete category top-10, asynchronous review/pagination, or filter extraction support. No bypass of HTTP 403 or other access restrictions is implemented.
4. Review/merge the PRs in order; enable scheduled refresh only deliberately through `ENABLE_FILTER_REFRESH=true` and the required PR-creation permission. No npm package was published, no upstream PR was merged, and no production server was deployed.

See `README.md`, `docs/audit.md`, and `docs/filter-updates.md` for the original TODO coverage, implementation details and safety limits.
