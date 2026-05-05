UPDATE budget_suppliers SET negotiation_status = NULL WHERE id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e';
DELETE FROM budget_negotiation_store_pieces WHERE supplier_id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e';
UPDATE budget_prices SET adjusted_unit_price = NULL WHERE supplier_id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e';
UPDATE budget_extra_costs SET adjusted_installation_value = NULL, adjusted_freight_value = NULL WHERE supplier_id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e';