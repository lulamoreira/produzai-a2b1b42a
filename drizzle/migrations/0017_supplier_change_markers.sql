-- Manual markers telling suppliers which pieces/kits changed in a renegotiation
-- compared with the spreadsheet they quoted.
CREATE TABLE public.campaign_supplier_change_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES public.campaign_pieces(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.campaign_kits(id) ON DELETE CASCADE,
  removed_kind text CHECK (removed_kind IN ('piece','kit')),
  removed_code integer,
  removed_name text CHECK (removed_name IS NULL OR char_length(removed_name) <= 300),
  change_type text NOT NULL CHECK (change_type IN ('new','changed','removed')),
  aspects text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (aspects <@ ARRAY['quantities','measures_material','image','components']::text[]),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_supplier_change_markers_target_chk CHECK (
    (change_type <> 'removed'
      AND removed_kind IS NULL AND removed_code IS NULL AND removed_name IS NULL
      AND ((piece_id IS NOT NULL)::int + (kit_id IS NOT NULL)::int) = 1)
    OR
    (change_type = 'removed'
      AND piece_id IS NULL AND kit_id IS NULL
      AND removed_kind IS NOT NULL AND removed_code IS NOT NULL AND removed_name IS NOT NULL)
  ),
  CONSTRAINT campaign_supplier_change_markers_aspects_chk CHECK (
    (change_type = 'changed' AND cardinality(aspects) >= 1)
    OR (change_type <> 'changed' AND cardinality(aspects) = 0)
  )
);

CREATE INDEX idx_cscm_campaign ON public.campaign_supplier_change_markers(campaign_id);
CREATE UNIQUE INDEX uq_cscm_piece ON public.campaign_supplier_change_markers(piece_id) WHERE piece_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cscm_kit ON public.campaign_supplier_change_markers(kit_id) WHERE kit_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cscm_removed ON public.campaign_supplier_change_markers(campaign_id, removed_kind, removed_code)
  WHERE change_type = 'removed';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_supplier_change_markers TO authenticated;
GRANT ALL ON public.campaign_supplier_change_markers TO service_role;

ALTER TABLE public.campaign_supplier_change_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View supplier change markers"
  ON public.campaign_supplier_change_markers FOR SELECT TO authenticated
  USING (public.has_campaign_category_permission(auth.uid(), campaign_id, 'view_pieces'::text));

CREATE POLICY "Insert supplier change markers"
  ON public.campaign_supplier_change_markers FOR INSERT TO authenticated
  WITH CHECK (public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'::text));

CREATE POLICY "Update supplier change markers"
  ON public.campaign_supplier_change_markers FOR UPDATE TO authenticated
  USING (public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'::text))
  WITH CHECK (public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'::text));

CREATE POLICY "Delete supplier change markers"
  ON public.campaign_supplier_change_markers FOR DELETE TO authenticated
  USING (public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'::text));

-- Integrity: the referenced piece/kit must belong to the same campaign; stamp author.
CREATE OR REPLACE FUNCTION public.validate_supplier_change_marker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.piece_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campaign_pieces p WHERE p.id = NEW.piece_id AND p.campaign_id = NEW.campaign_id
  ) THEN
    RAISE EXCEPTION 'Peça não pertence a esta campanha';
  END IF;
  IF NEW.kit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campaign_kits k WHERE k.id = NEW.kit_id AND k.campaign_id = NEW.campaign_id
  ) THEN
    RAISE EXCEPTION 'Kit não pertence a esta campanha';
  END IF;
  IF NEW.aspects @> ARRAY['components']::text[] AND NEW.kit_id IS NULL THEN
    RAISE EXCEPTION 'Componentes só se aplicam a kits';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_supplier_change_marker
  BEFORE INSERT OR UPDATE ON public.campaign_supplier_change_markers
  FOR EACH ROW EXECUTE FUNCTION public.validate_supplier_change_marker();

CREATE TRIGGER trg_supplier_change_markers_updated_at
  BEFORE UPDATE ON public.campaign_supplier_change_markers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anonymous supplier portal read: resolved markers for the token's campaign only.
CREATE OR REPLACE FUNCTION public.get_supplier_portal_change_markers(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF _token IS NULL OR _token = '' THEN RETURN '[]'::jsonb; END IF;
  SELECT campaign_id INTO v_campaign_id FROM public.budget_suppliers WHERE access_token = _token LIMIT 1;
  IF v_campaign_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id,
      'change_type', m.change_type,
      'aspects', to_jsonb(m.aspects),
      'note', m.note,
      'kind', CASE WHEN m.change_type = 'removed' THEN m.removed_kind
                   WHEN m.kit_id IS NOT NULL THEN 'kit' ELSE 'piece' END,
      'code', CASE WHEN m.change_type = 'removed' THEN m.removed_code
                   WHEN m.kit_id IS NOT NULL THEN k.code ELSE p.code END,
      'name', CASE WHEN m.change_type = 'removed' THEN m.removed_name
                   WHEN m.kit_id IS NOT NULL THEN k.name ELSE p.name END,
      'piece_id', m.piece_id,
      'kit_id', m.kit_id
    ) ORDER BY m.created_at)
    FROM public.campaign_supplier_change_markers m
    LEFT JOIN public.campaign_pieces p ON p.id = m.piece_id
    LEFT JOIN public.campaign_kits k ON k.id = m.kit_id
    WHERE m.campaign_id = v_campaign_id
      AND (m.change_type = 'removed'
           OR (m.piece_id IS NOT NULL AND COALESCE(p.is_deleted, false) = false)
           OR (m.kit_id IS NOT NULL AND COALESCE(k.is_deleted, false) = false))
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_portal_change_markers(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_portal_change_markers(text) TO anon, authenticated;