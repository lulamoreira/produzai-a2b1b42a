
-- Add display_order column to campaign_pieces for drag-and-drop reordering
ALTER TABLE public.campaign_pieces ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Add display_order column to campaign_kits for drag-and-drop reordering
ALTER TABLE public.campaign_kits ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Initialize display_order based on current code order for existing pieces
UPDATE public.campaign_pieces SET display_order = code;

-- Initialize display_order based on current code order for existing kits
UPDATE public.campaign_kits SET display_order = code;
