ALTER TABLE public.store_occurrence_reports
  ADD COLUMN IF NOT EXISTS campaign_piece_id uuid NULL REFERENCES public.campaign_pieces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_kit_id uuid NULL REFERENCES public.campaign_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_item_code integer NULL,
  ADD COLUMN IF NOT EXISTS campaign_item_name text NULL;

ALTER TABLE public.store_occurrence_reports
  ADD CONSTRAINT store_occurrence_reports_one_rateio_item
  CHECK (campaign_piece_id IS NULL OR campaign_kit_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_store_occurrence_reports_campaign_piece ON public.store_occurrence_reports(campaign_piece_id);
CREATE INDEX IF NOT EXISTS idx_store_occurrence_reports_campaign_kit ON public.store_occurrence_reports(campaign_kit_id);

COMMENT ON COLUMN public.store_occurrence_reports.campaign_piece_id IS 'Peça do rateio citada (registro interno). Exclusivo com campaign_kit_id.';
COMMENT ON COLUMN public.store_occurrence_reports.campaign_kit_id IS 'Kit do rateio citado (registro interno). Exclusivo com campaign_piece_id.';
COMMENT ON COLUMN public.store_occurrence_reports.campaign_item_code IS 'Código da peça/kit do rateio no momento do registro (mantém exibição após renegociação/exclusão).';
COMMENT ON COLUMN public.store_occurrence_reports.campaign_item_name IS 'Nome da peça/kit do rateio no momento do registro.';