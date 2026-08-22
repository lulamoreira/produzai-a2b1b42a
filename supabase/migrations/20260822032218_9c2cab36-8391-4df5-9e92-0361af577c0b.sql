-- 1. Sync budget_settings (Winner Links)
UPDATE budget_settings 
SET 
  winner_mockup_url = src.winner_mockup_url,
  winner_book_url = src.winner_book_url,
  winner_cc_email = src.winner_cc_email
FROM budget_settings src
WHERE src.campaign_id = 'd3699404-0631-454c-affc-cc7bee18e146'
  AND budget_settings.campaign_id = '14590155-6392-4eed-8e75-faa2304e0e13';

-- 2. Sync budget_timeline_entries (Timeline)
DELETE FROM budget_timeline_entries WHERE campaign_id = '14590155-6392-4eed-8e75-faa2304e0e13';

INSERT INTO budget_timeline_entries (campaign_id, description, display_order, entry_date)
SELECT '14590155-6392-4eed-8e75-faa2304e0e13', description, display_order, entry_date
FROM budget_timeline_entries
WHERE campaign_id = 'bcc93773-daca-4db6-8ca1-9bf13dbe0f4d';