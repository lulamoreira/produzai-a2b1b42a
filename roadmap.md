# Performance without functional changes
- [x] Optimize the verified campaign quantity query plan without changing records or permissions: covering campaign/order index, measured late page 194 ms → 6.8 ms.
- [x] Remove redundant summary request and parallelize independent counts; 33 tests passed, authenticated Loja a Loja unchanged and Rateio loaded all 9,278 unique rows (21,957 quantity).

# Loja a Loja letter copying
- [x] Add iterative selective copying with editable names and independent destination rows.
- [x] Six rule tests passed; authenticated Natal copy saved/read back, stayed open and reset selection; temporary test row removed.

# Rateio prefill source campaigns
- [x] Show only the vigente campaign of each renegotiation chain in the "Campanha de origem" picker (chain leaves by parent_campaign_id), keeping never-renegotiated campaigns.
- [x] Test the rule and confirm the real chain structure read-only, without changing campaign records.

# Capacity-aware Rateio review
- [x] Pass client capacity labels into the read-only review and add eligible-store/proportional checks, preserving checks 2–4.
- [x] Verify 17 tests and the authenticated Natal review: capacity group displays 20 findings; no campaign data changed.

# Team export formatting
- [x] Add automatic matrix associations, missing-reference warning and empty-cell-only import; verify component coverage and 15 tests. No active caller exists for this dialog, so live end-to-end verification is unavailable without expanding scope.
- [x] Import Flow KIT rows as kits with one component, preserve enrichment/images, and verify shared numbering with tests and authenticated review; no real campaign records changed.

- [x] Format individual Excel and clipboard exports as labeled person and vehicle blocks.
- [x] Support rich clipboard with a plain-text fallback.
- [x] Verify the real team export and clipboard flow.

# Duplicate occurrence KPI correction
- [x] Exclude duplicate statuses consistently from overdue KPI, drill-down, and highlighting.
- [x] Test the rule and verify the current screen without changing saved occurrences.

# Import campaign scheduling and installations
- [x] Add transactional, permission-checked execution import preserving source and existing target records.
- [x] Add scheduling dialog with root default, options and import summary.
- [x] Verify rules in isolated PostgreSQL (including rollback); check authenticated dialog and UI summary with isolated writes, leaving real campaigns unchanged.