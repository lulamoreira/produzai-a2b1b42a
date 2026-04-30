UPDATE budget_suppliers
SET status = 'enviado', submitted_at = COALESCE(submitted_at, now())
WHERE id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e' AND locked = true AND status <> 'enviado';