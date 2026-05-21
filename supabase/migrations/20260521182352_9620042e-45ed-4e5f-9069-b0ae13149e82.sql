-- Create missing schedule rows for all campaign stores so the inherited
-- preference is populated. The BEFORE INSERT trigger
-- copy_installation_preference_from_previous will fill installation_preference
-- automatically from the most recent previous campaign of the same client.
INSERT INTO public.campaign_schedules (campaign_id, store_id)
SELECT DISTINCT csp.campaign_id, csp.store_id
FROM public.campaign_store_pieces csp
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_schedules cs
  WHERE cs.campaign_id = csp.campaign_id
    AND cs.store_id = csp.store_id
    AND COALESCE(cs.reinstall_seq, 0) = 0
);

-- Also re-run the backfill for any existing rows still empty (idempotent).
UPDATE public.campaign_schedules cs_new
SET installation_preference = sub.installation_preference
FROM (
  SELECT DISTINCT ON (cs.store_id, c_new.id)
    c_new.id AS new_campaign_id,
    cs.store_id,
    cs.installation_preference
  FROM public.campaigns c_new
  JOIN public.campaigns c_prev
    ON c_prev.client_id = c_new.client_id
   AND c_prev.id <> c_new.id
   AND c_prev.created_at < c_new.created_at
  JOIN public.campaign_schedules cs
    ON cs.campaign_id = c_prev.id
  WHERE cs.installation_preference IS NOT NULL
    AND cs.installation_preference <> ''
    AND cs.installation_preference <> 'not_informed'
  ORDER BY cs.store_id, c_new.id, c_prev.created_at DESC
) sub
WHERE cs_new.campaign_id = sub.new_campaign_id
  AND cs_new.store_id = sub.store_id
  AND (cs_new.installation_preference IS NULL
       OR cs_new.installation_preference = ''
       OR cs_new.installation_preference = 'not_informed');