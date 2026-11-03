# Coordinated PR work plan — 2026-11-03

## Goal and agreed result

Deliver a runnable, verified Node.js library through PR #2, integrate its repairs with the bounded maintenance implementation in PR #3, and provide transparent Codex co-authorship for both contributions. PR #3 remains a validated draft while live filter extraction is unverified. Scheduled crawling stays disabled unless a maintainer deliberately opts in.

## Phases and evidence

| Phase | Owner | Dependency | Acceptance and current evidence |
| --- | --- | --- | --- |
| Preserve/reconcile | Main contributor | None | Preserve prior work and public history; recheck current source heads before normal updates. API starting head `3a05d8c`; maintenance starting head `f344279`. |
| Repair API, PR #2 | API contributor and independent reviewer | Preserve/reconcile | Published commit `11c1f17`: URL operation/category checks, rendered response validation, offline demo and obsolete updater containment. Windows / Node 24.14.1: 63 tests, 22 syntax files, demo, package consumer and audit passed. |
| Integrate maintenance, PR #3 | Maintenance contributor | Tested PR #2 | Merge API history while retaining functional guarded updater, bounds, existing catalog choices, exports and npm binary. Combined tree: 85 tests, 25 syntax files, demo and real offline package/installed CLI checks passed. |
| Independent review and attribution | Separate reviewer and main contributor | Integrated tree | Independent reviewer passed 31 focused offline tests and found no actionable code/security findings. Preserve human authorship and credit OpenAI Codex in the PR descriptions, documentation and new commit trailers. |
| Delivery/readiness | Main contributor; maintainer for external gates | Verified branches | Publish reviewed source updates without rewriting history. Keep PR #3 draft and report actual checks. Upstream merging, npm publication, billing changes and crawler activation are separate actions. |

## Integration rules

- PR #2 temporarily disables the obsolete updater; PR #3 replaces that stub with its bounded functional CLI.
- Keep the API signatures and regional parser behavior. Preserve URL validation, browser request policy, media checks and cleanup.
- Test maintenance import, help and invalid arguments without crawling. The real no-argument CLI initiates a refresh and is never used in deterministic tests.
- Preserve the lockfile-based offline consumer installation and verify updater exports, packaged files, bin metadata and actual installed command help.
- Reconcile package and lockfile metadata; retain the offline demo alongside maintenance commands.
- Preserve existing catalogs on blocked, malformed or incomplete input. Keep request budgets, delays, dry-run behavior and staged validation.
- New commits include `Co-authored-by: Codex <noreply@openai.com>`. Preserve existing public commit history and use normal branch updates.

## Validation and external gates

The integrated revision passes locked installation, all 85 deterministic tests, all 25 JavaScript syntax checks, the offline demo, package/consumer verification and whitespace checks. The isolated npm cache was seeded by locked installation; package and CLI checks ran offline afterward. See `verification-status.md` for exact results and limitations.

GitHub-hosted jobs currently stop before execution because of an account billing lock. Remote CI is not claimed green. Recheck the account condition before rerunning; a source change cannot resolve it.

Prior live requests for search, category listings and filter pages returned HTTP 403. No access-control bypass is implemented. Current filter markup and permitted live extraction remain unverified. The refresh workflow requires explicit manual dispatch or `ENABLE_FILTER_REFRESH=true`; no schedule opt-in was set and no refresh was dispatched by this work.

Recommended maintainer merge order: **PR #2, then PR #3**. Recheck the remaining PR #3 diff if PR #2 is squash-merged or rebased. Keep PR #3 draft until its live extraction prerequisites are verified.
