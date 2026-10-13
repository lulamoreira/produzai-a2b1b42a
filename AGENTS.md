# Architecture rules

- Individual team exports use a shared labeled-field model for Excel and both clipboard formats so installer documents and vehicle details stay consistent.
- Copy team details as HTML plus plain text, falling back to plain text when rich clipboard is unavailable, because destination applications support different formatting.