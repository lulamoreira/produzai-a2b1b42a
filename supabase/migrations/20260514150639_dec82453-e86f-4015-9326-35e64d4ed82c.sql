
-- New table: snapshot of stores at adjustment creation, with change tracking.
CREATE TABLE public.campaign_adjustment_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_id UUID NOT NULL REFERENCES public.campaign_adjustments(id) ON DELETE CASCADE,
  source_store_id UUID,
  name TEXT NOT NULL,
  nickname TEXT,
  city TEXT,
  state TEXT,
  store_code TEXT,
  showcase_count INTEGER NOT NULL DEFAULT 0,
  change_type TEXT NOT NULL DEFAULT 'unchanged',
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  original_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cas_adjustment ON public.campaign_adjustment_stores(adjustment_id);
CREATE UNIQUE INDEX idx_cas_unique_source ON public.campaign_adjustment_stores(adjustment_id, source_store_id) WHERE source_store_id IS NOT NULL;

ALTER TABLE public.campaign_adjustment_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adjustment stores readable by campaign members"
  ON public.campaign_adjustment_stores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_adjustments a WHERE a.id = adjustment_id AND public.has_campaign_access(auth.uid(), a.campaign_id)));

CREATE POLICY "Adjustment stores writable by campaign editors"
  ON public.campaign_adjustment_stores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_adjustments a WHERE a.id = adjustment_id AND public.has_campaign_access(auth.uid(), a.campaign_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_adjustments a WHERE a.id = adjustment_id AND public.has_campaign_access(auth.uid(), a.campaign_id)));

-- Backfill: for every existing adjustment, snapshot its campaign's current client_stores
-- and add an entry for any orphan store_id referenced in the baseline rateio.
DO $$
DECLARE
  adj RECORD;
  client_uuid UUID;
  winner_uuid UUID;
BEGIN
  FOR adj IN SELECT id, campaign_id FROM public.campaign_adjustments LOOP
    SELECT client_id INTO client_uuid FROM public.campaigns WHERE id = adj.campaign_id;
    IF client_uuid IS NULL THEN CONTINUE; END IF;

    -- snapshot current stores
    INSERT INTO public.campaign_adjustment_stores
      (adjustment_id, source_store_id, name, nickname, city, state, store_code, showcase_count, change_type, original_snapshot)
    SELECT adj.id, cs.id, cs.name, cs.nickname, cs.city, cs.state, cs.store_code, cs.showcase_count, 'unchanged',
           jsonb_build_object('id', cs.id, 'name', cs.name, 'nickname', cs.nickname, 'city', cs.city, 'state', cs.state, 'store_code', cs.store_code, 'showcase_count', cs.showcase_count)
    FROM public.client_stores cs
    WHERE cs.client_id = client_uuid
    ON CONFLICT DO NOTHING;

    -- insert orphan store_ids (referenced in baseline rateio but no longer in client_stores)
    SELECT id INTO winner_uuid FROM public.budget_suppliers WHERE campaign_id = adj.campaign_id AND is_winner = true LIMIT 1;

    INSERT INTO public.campaign_adjustment_stores
      (adjustment_id, source_store_id, name, change_type, is_deleted, original_snapshot)
    SELECT DISTINCT adj.id, t.store_id, 'Loja removida', 'unchanged', false,
           jsonb_build_object('id', t.store_id, 'name', 'Loja removida')
    FROM (
      SELECT store_id FROM public.campaign_store_pieces WHERE campaign_id = adj.campaign_id
      UNION
      SELECT store_id FROM public.budget_negotiation_store_pieces WHERE supplier_id = winner_uuid
    ) t
    WHERE NOT EXISTS (SELECT 1 FROM public.client_stores cs WHERE cs.id = t.store_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Special-case backfill: Quiosque Vitória name for the known orphan in the user's campaign.
UPDATE public.campaign_adjustment_stores
SET name = 'Quiosque Vitória',
    original_snapshot = jsonb_set(COALESCE(original_snapshot, '{}'::jsonb), '{name}', '"Quiosque Vitória"'::jsonb)
WHERE source_store_id = '135028c8-bd2d-49d4-882f-7929018ab6a6';
