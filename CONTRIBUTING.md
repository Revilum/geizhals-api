# Contributing

This is an early Node.js CommonJS HTML client. Preserve its public exports, regional origins, request restrictions and catalog retention. Prefer focused repairs over broad formatting or dependency churn.

## Local checks

Use Node.js 22.12 or later; the configured CI matrix covers supported Node 22, 24 and 26 on Linux, plus Node 24 on Windows. Use the lockfile:

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run demo
npm run packcheck
npm audit --omit=dev --audit-level=high
git diff --check
```

Tests and the demo use synthetic fixtures and do not crawl. `packcheck` builds a real tarball, installs it offline, and checks its public API and installed maintenance command. Its installed consumer exercises parser-to-catalog-to-URL and injected refresh-to-discovery-to-URL round trips, including long/Unicode names, repeated `xf` values and an unchanged second refresh. Seed the same npm cache with `npm ci`; do not substitute an existing checkout import for an installed consumer. Dependency installation and audit contact the package registry. Optional Puppeteer installation and live website checks are separate.

For behavioral repairs, record a failing regression before the fix, then run the affected tests and the full suite. Include a normal input and the failure/preservation case. Style-only changes do not need invented tests. Report the environment, tested revision and actual results; fixtures do not establish current website compatibility. Optimize only against a concrete problem and record measurements before claiming a speed or resource improvement.

## Workflow review

Keep CI permissions read-only and do not persist checkout credentials there. Pin action dependencies to verified commits from their upstream repositories; review release notes and source when updating pins. The refresh job alone needs write access, remains opt-in, and runs only from the default branch. Its output is a draft PR restricted to catalog files.

PRs created with `GITHUB_TOKEN` do not automatically run the normal push/PR checks. Mark the proposed catalog PR **Ready for review** to trigger `ready_for_review` checks. Bot updates make it draft again. Wait for successful checks on the latest revision before merging; closing/reopening or changing credentials is unnecessary for this configured path.

## Proposed maintainer standards

These are proposals, not settings enabled by this change:

- Protect the default branch with review and required latest-revision CI checks after the workflow has passed on the hosting account. Resolve the account's billing lock before treating hosted validation as available.
- Evaluate GitHub workflow dependency lockfiles if the account supports them (currently documented for GitHub Enterprise Cloud). GitHub recommends them over SHA pinning where available; current workflows use explicit verified SHAs.
- Consider reviewed dependency/Actions update PRs (for example Dependabot), without automatic merging. Do not activate an update service merely as a side effect of a source repair.
- Resolve permitted live access and capture representative, sanitized filter fixtures before declaring the updater ready for unattended use. Keep partial coverage and real browser isolation limitations visible.

## References

- [Node.js release lifecycle](https://nodejs.org/en/about/previous-releases)
- [npm ci and lockfile behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [create-pull-request v7: workflow triggers and draft review](https://github.com/peter-evans/create-pull-request/blob/v7/docs/concepts-guidelines.md#triggering-further-workflow-runs)
