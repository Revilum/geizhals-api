# Second review: catalog and consumer contracts — 2026-11-04

Starting revision: `383d959b2064f3b2340fa5cfc1202c02a362b8db`. The additional review focused on the transitions from parsed HTML to saved catalogs, from catalog identities/labels to public URL construction, and from the source tree to an installed package. The previous work and tests were preserved. No live crawler, merge or npm publication is part of this review.

## Reproduced defects and resulting behavior

| Area | Reproduction | Repair |
| --- | --- | --- |
| Category identity | A lookup for `foo` could use `shared-a-foo.json`, although the file may belong to `a-foo`. Two label/ID combinations could also generate the same path. | Generate `cat.<exact-id>.json`; automatic lookup matches complete identity filenames. Detect existing/staged exact-ID duplicates before writing. Ambiguous legacy suffix filenames require explicit selection or reviewed migration. |
| Parser/consumer label agreement | Long labels were truncated by maintenance; Unicode/underscore labels were normalized differently from public lookup. | Use the public label normalization for new catalog keys. Preserve original spelling of matching prior keys and retain absent choices. |
| Ambiguous named choices | Catalog keys such as `DDR 5` and `DDR-5` silently selected the first value after normalization. | Reject normalized group/choice ambiguity. Repeated identical source links remain valid; conflicting parsed values reject. |
| Repeated source values | The public parser lost earlier rows of a repeated group and all but the first repeated `xf` parameter. | Merge repeated rows and preserve combined filter tokens. |
| Incomplete observation | Invalid candidates could be dropped alongside valid links while reporting `partial=false`, including malformed href-selected navigation. | Report `invalid-navigation` / `invalid-filter-page`; keep unrelated controls, services and duplicate valid links from causing false partial reports. |
| Stored data validity | A nonempty but invalid prior token could survive a rewrite as though the catalog were valid. | Validate prior token syntax and normalized names across the batch before writes. Reject malformed/ambiguous catalogs while preserving original bytes. |
| Inherited URL parameters | Copied URLs bypassed filter-token budgets or contained conflicting repeated price/category parameters; lookup and the emitted URL could disagree. | Validate inherited values; reject conflicting repeats. Equal repeats and explicit replacements remain supported. |

Tests also verify correct existing behavior: failed atomic rename preserves the original and cleans the temporary file. That cleanup behavior did not need a source repair.

## Compatibility and preservation

Automatic discovery intentionally stops interpreting `<label>-<cat>.json` suffixes as a category identity. Existing files remain usable through `filterFile`. No legacy file is automatically renamed or deleted. The updater checks filenames within the same depth/entry bounds as public discovery, including renamed parents, and refuses to create a new authoritative catalog while ambiguous historical choices may be overlooked. Multiple exact-ID catalogs reject even when one is already at the planned destination.

The public API signatures and result shapes remain intact. New errors apply to ambiguous/invalid input; `partialReasons` has two additional values. The new fixed leaf filename remains stable when only its human-readable label changes. See [maintenance compatibility details](filter-updates.md#compatibility-with-existing-catalogs).

## Verification

The fresh baseline passed 94 tests. The repaired full suite passes **131 tests**, with **28 JavaScript files** passing syntax checks. The synthetic demo, production dependency audit and both workflows' actionlint validation also pass. Thirty-seven tests were added, with failure-before/fix-after evidence for confirmed defects and explicit preservation/normal cases. Individual red runs are scoped evidence, not a claim that every added test failed before the changes.

The actual installed tarball consumer now runs both `parseFilters -> saved catalog -> getURL` and injected `refreshFilters -> filterDir -> getURL`, including combined `xf` values, long Unicode labels and an unchanged repeated refresh. It still checks installed CLI help. It never starts a live refresh or Chromium. An initially missing shared npm cache tarball was an environment prerequisite; a task-local cache was seeded with locked `npm ci` (50 packages, no lifecycle scripts), then reused for the successful offline consumer check.

External hosted CI remains distinct from these local Windows/Node24 checks. The previously inspected exact-source run was blocked before jobs by account billing. Current live-site compatibility and real Chromium-wide isolation remain unverified. No account policy, workflow opt-in or publication setting was changed.

## Scoped learning

The existing repository instruction about preserving identifiers now also requires unambiguous identifier boundaries rather than label suffixes. Normal cases (`foo` and `a-foo` independently resolvable) and safeguard cases (ambiguous legacy files unchanged, no staged writes on conflicts) were exercised. The Operator-approved five-field `PROJECT-CONTEXT.md` was added for future reviews. No global instructions or always-on background process were changed, and no performance improvement is claimed.
