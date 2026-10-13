CREATE OR REPLACE FUNCTION public.copy_support_materials_from_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_campaign_id IS NOT NULL THEN
    INSERT INTO campaign_support_materials (id, campaign_id, title, file_url, file_name, file_type, display_order, created_at, share_with_supplier)
    SELECT gen_random_uuid(), NEW.id, sm.title, sm.file_url, sm.file_name, sm.file_type, sm.display_order, sm.created_at, sm.share_with_supplier
    FROM campaign_support_materials sm WHERE sm.campaign_id = NEW.parent_campaign_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_zz_copy_support_materials ON public.campaigns;
CREATE TRIGGER trg_zz_copy_support_materials AFTER INSERT ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.copy_support_materials_from_parent();