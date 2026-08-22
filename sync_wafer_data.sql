-- Syncing data from Wafer (bcc93773-daca-4db6-8ca1-9bf13dbe0f4d) to Wafer — Renegociação Inicial (14590155-6392-4eed-8e75-faa2304e0e13)

-- 1. Sync budget_settings (Winner Links)
UPDATE budget_settings 
SET 
  winner_mockup_url = src.winner_mockup_url,
  winner_book_url = src.winner_book_url,
  winner_cc_email = src.winner_cc_email
FROM budget_settings src
WHERE src.campaign_id = 'bcc93773-daca-4db6-8ca1-9bf13dbe0f4d'
  AND budget_settings.campaign_id = '14590155-6392-4eed-8e75-faa2304e0e13';

-- 2. Sync budget_timeline_entries
DELETE FROM budget_timeline_entries WHERE campaign_id = '14590155-6392-4eed-8e75-faa2304e0e13';

INSERT INTO budget_timeline_entries (id, campaign_id, description, display_order, entry_date)
SELECT gen_random_uuid(), '14590155-6392-4eed-8e75-faa2304e0e13', description, display_order, entry_date
FROM budget_timeline_entries
WHERE campaign_id = 'bcc93773-daca-4db6-8ca1-9bf13dbe0f4d';

-- 3. Sync budget_extra_costs (specifically discount_value if it differs)
-- We need to map suppliers first. Let's assume suppliers were cloned in order or by name/email match.
-- Based on the previously retrieved data, we have 4 suppliers in each.
-- Original: 
-- 5d29e121-3977-4f47-bf2c-e462c79ae71a (0 discount)
-- eb7c11b2-f559-4356-aa3b-ca72df11fe52 (0 discount)
-- 77cf05bd-fcb6-4bc7-aa2d-804380c60330 (0 discount)
-- 0abd2411-6dcc-4d8a-90f8-8528c44804f2 (0 discount)
-- Actually, wait. I saw "79527be1-447d-4488-9988-4e76d1d7d6ed" had 8168.91 discount.
-- Let's check which campaign that supplier belongs to.
