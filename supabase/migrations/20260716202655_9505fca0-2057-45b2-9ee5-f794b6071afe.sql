-- Sync kit.category from its component pieces when they all share a category.
CREATE OR REPLACE FUNCTION public.sync_kit_category_from_pieces(p_kit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat text;
  v_sub text;
  v_cat_count int;
  v_sub_count int;
BEGIN
  SELECT COUNT(DISTINCT p.category), MIN(p.category)
    INTO v_cat_count, v_cat
  FROM campaign_kit_pieces kp
  JOIN campaign_pieces p ON p.id = kp.piece_id
  WHERE kp.kit_id = p_kit_id AND p.category IS NOT NULL AND p.category <> '';

  SELECT COUNT(DISTINCT COALESCE(p.sub_location, '')), MIN(p.sub_location)
    INTO v_sub_count, v_sub
  FROM campaign_kit_pieces kp
  JOIN campaign_pieces p ON p.id = kp.piece_id
  WHERE kp.kit_id = p_kit_id;

  IF v_cat_count = 1 THEN
    UPDATE campaign_kits
    SET category = v_cat,
        sub_location = CASE WHEN v_sub_count = 1 THEN v_sub ELSE sub_location END
    WHERE id = p_kit_id;
  END IF;
END;
$$;

-- Trigger on campaign_pieces update: resync all kits containing that piece
CREATE OR REPLACE FUNCTION public.trg_sync_kits_on_piece_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.category IS NOT DISTINCT FROM OLD.category)
     AND (NEW.sub_location IS NOT DISTINCT FROM OLD.sub_location) THEN
    RETURN NEW;
  END IF;
  FOR r IN SELECT DISTINCT kit_id FROM campaign_kit_pieces WHERE piece_id = NEW.id LOOP
    PERFORM public.sync_kit_category_from_pieces(r.kit_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_kits_on_piece_change ON public.campaign_pieces;
CREATE TRIGGER trg_sync_kits_on_piece_change
AFTER UPDATE OF category, sub_location ON public.campaign_pieces
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_kits_on_piece_change();

-- Trigger on campaign_kit_pieces changes (add/remove) to keep kit in sync
CREATE OR REPLACE FUNCTION public.trg_sync_kit_on_kit_pieces_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_kit_category_from_pieces(OLD.kit_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_kit_category_from_pieces(NEW.kit_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_kit_on_kit_pieces_change ON public.campaign_kit_pieces;
CREATE TRIGGER trg_sync_kit_on_kit_pieces_change
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_kit_pieces
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_kit_on_kit_pieces_change();

-- Backfill existing rows
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM campaign_kits WHERE is_deleted = false LOOP
    PERFORM public.sync_kit_category_from_pieces(r.id);
  END LOOP;
END $$;