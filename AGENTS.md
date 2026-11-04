# Repository contribution instructions

These instructions apply to this repository only. See CONTRIBUTING.md for the development workflow and proposed maintainer settings.

- Inspect the current PR head and affected callers before changing behavior. Fix reproduced correctness/security defects; keep unrelated redesigns separate.
- For a behavior fix, add an offline regression that fails before the change and passes afterward. Cover the normal case and the relevant rejection or preservation case. Use fixtures or injected clients; never run the bare maintenance CLI as a test.
- Preserve valid identifiers exactly across generation, filenames and lookup. Normalize human-readable labels separately; use unambiguous identifier boundaries, not label suffixes. Prove that distinct identifiers remain distinct. Reject case-only destination collisions before writes so Linux and Windows retain the same data.
- Accept only documented response media types, including their optional parameters. Missing or partial input must not become a complete catalog result or erase existing choices.
- Run the checks in CONTRIBUTING.md, including a real installed tarball when changing package/public/CLI behavior. Use the lockfile and the same npm cache for installation and offline consumer checks.
- Keep local test evidence, hosted CI results and live-site compatibility separate. A billing lock or HTTP access restriction is external evidence, not a reason to bypass safeguards or claim tests passed remotely.
- Keep live refresh opt-in, request bounds and draft review intact. Never introduce credentials, schedule activation, merge/publication or repository settings changes as an incidental repair.
- Learn from verified defects or successful methods: update the smallest relevant rule only after checking a normal case and a case where its safeguard still applies. Store incident evidence in review documents. Do not add global rules, background tasks or performance claims without measured evidence.
- Before staging, verify the Git top-level and stage only intended paths. Preserve concurrent work and existing public history; never force-push to resolve a review.
