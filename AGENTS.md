# Architecture rules

- Rateio review keeps capacity matching and findings in one read-only pure engine shared by the dialog and PDF; client field labels are passed from Rateio so capacities do not depend on fixed custom-field indices.

- Matrix quantity prefill reuses Flow name tokens and shared pure matching/filter helpers; reread paginated current quantities before confirmation so existing positive cells are preserved without changing the parent importer.
- Matrix prefill uses one unified transfer (sourceQuantityPerStore + applyQuantityToTarget) for any source→target type combination: kits count as min floor of component qty ÷ qty-per-kit, kit targets expand to each component × qty-per-kit; kit components are never mapped individually, so differing kit structures stay consistent.
- Renegotiation "vigente" campaign is the chain leaf (no other campaign of the client has parent_campaign_id pointing at it); import-source pickers show leaves only, so originals and intermediates can never be picked.


- Flow creation uses a shared record builder for kit/component payloads and one code/order counter; kit naming is shared with New Kit to prevent convention drift.

- Individual team exports use a shared labeled-field model for Excel and both clipboard formats so installer documents and vehicle details stay consistent.
- Copy team details as HTML plus plain text, falling back to plain text when rich clipboard is unavailable, because destination applications support different formatting.
- Team duplication reads fresh source records, preserves all member/vehicle fields and support coverage, and removes incomplete copies on failure; original teams and schedule assignments stay untouched.
- Loja a Loja overdue KPIs, drill-downs, and list/card highlights use one shared predicate honoring configured status closure and local-day deadlines, so visual counts stay consistent.
- Execution imports use one transactional, permission-checked RPC with same-client validation, name-based team remapping and skip-existing schedules; copied media rows share immutable files, so deletion must check all references before removing storage objects.