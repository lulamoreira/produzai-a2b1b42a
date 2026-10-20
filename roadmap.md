# Team export formatting
- [ ] Import Flow KIT rows as kits with one component, preserve enrichment/images, and verify shared numbering.

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