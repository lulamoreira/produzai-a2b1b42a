UPDATE campaign_pieces 
SET is_deleted = false 
WHERE is_deleted IS NULL;

UPDATE campaign_pieces 
SET display_order = 0 
WHERE display_order IS NULL;