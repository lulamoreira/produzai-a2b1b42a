UPDATE public.budget_suppliers bs
SET submitted_at = first_events.first_sent_at,
    status = 'enviado',
    locked = true
FROM (
  SELECT bs_inner.id AS supplier_id, MIN(n.created_at) AS first_sent_at
  FROM public.budget_suppliers bs_inner
  JOIN public.notifications n
    ON n.campaign_id = bs_inner.campaign_id
   AND n.type = 'orcamento_enviado'
   AND n.body ILIKE (bs_inner.company_name || ' enviou o orçamento%')
  GROUP BY bs_inner.id
) AS first_events
WHERE bs.id = first_events.supplier_id
  AND (
    bs.submitted_at IS NULL
    OR bs.submitted_at > first_events.first_sent_at
  );