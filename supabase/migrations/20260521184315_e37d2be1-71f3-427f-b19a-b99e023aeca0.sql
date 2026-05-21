-- Update existing records in campaign_pieces
UPDATE public.campaign_pieces SET store_category = UPPER(store_category);

-- Create or update the trigger function for campaign_pieces
CREATE OR REPLACE FUNCTION public.uppercase_campaign_pieces_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.store_category IS NOT NULL THEN
    NEW.store_category := UPPER(NEW.store_category);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger for campaign_pieces
DROP TRIGGER IF EXISTS trg_uppercase_campaign_pieces_fields ON public.campaign_pieces;
CREATE TRIGGER trg_uppercase_campaign_pieces_fields
BEFORE INSERT OR UPDATE ON public.campaign_pieces
FOR EACH ROW EXECUTE FUNCTION public.uppercase_campaign_pieces_fields();