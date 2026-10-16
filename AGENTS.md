# Architecture rules

- Individual team exports use a shared labeled-field model for Excel and both clipboard formats so installer documents and vehicle details stay consistent.
- Copy team details as HTML plus plain text, falling back to plain text when rich clipboard is unavailable, because destination applications support different formatting.
- Team duplication reads fresh source records, preserves all member/vehicle fields and support coverage, and removes incomplete copies on failure; original teams and schedule assignments stay untouched.
- Loja a Loja overdue KPIs, drill-downs, and list/card highlights use one shared predicate honoring configured status closure and local-day deadlines, so visual counts stay consistent.