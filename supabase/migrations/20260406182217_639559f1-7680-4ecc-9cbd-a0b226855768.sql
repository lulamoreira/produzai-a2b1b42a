
WITH ranked AS (
  SELECT DISTINCT ON (c.client_id, cs.store_id)
    c.client_id, cs.store_id, cs.installation_preference
  FROM campaign_schedules cs
  JOIN campaigns c ON c.id = cs.campaign_id
  WHERE cs.installation_preference IS NOT NULL
    AND cs.installation_preference <> 'not_informed'
  ORDER BY c.client_id, cs.store_id, c.created_at DESC
)
UPDATE campaign_schedules cs
SET installation_preference = r.installation_preference
FROM campaigns c, ranked r
WHERE cs.campaign_id = c.id
  AND c.client_id = r.client_id
  AND cs.store_id = r.store_id
  AND (cs.installation_preference IS NULL OR cs.installation_preference = 'not_informed');
