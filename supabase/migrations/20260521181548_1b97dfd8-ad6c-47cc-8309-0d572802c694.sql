
-- Backfill: copy installation_preference from most recent previous campaign of the same client
-- for any campaign_schedules rows that have a null/not_informed preference.
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

-- Attach the existing helper as a BEFORE INSERT trigger so all future
-- campaign_schedules inherit the preference automatically.
DROP TRIGGER IF EXISTS trg_inherit_scheduling_preference ON public.campaign_schedules;
CREATE TRIGGER trg_inherit_scheduling_preference
BEFORE INSERT ON public.campaign_schedules
FOR EACH ROW
EXECUTE FUNCTION public.copy_installation_preference_from_previous();
