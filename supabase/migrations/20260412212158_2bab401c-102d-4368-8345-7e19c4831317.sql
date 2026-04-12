CREATE OR REPLACE FUNCTION public.shift_display_orders(
  p_campaign_id uuid,
  p_after_order integer,
  p_slots integer
) RETURNS void AS $$
BEGIN
  UPDATE campaign_pieces 
  SET display_order = display_order + p_slots
  WHERE campaign_id = p_campaign_id 
  AND display_order > p_after_order;
  
  UPDATE campaign_kits 
  SET display_order = display_order + p_slots
  WHERE campaign_id = p_campaign_id 
  AND display_order > p_after_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;