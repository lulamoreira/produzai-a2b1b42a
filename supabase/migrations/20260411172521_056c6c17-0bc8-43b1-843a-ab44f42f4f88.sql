
-- Create sub-locations table
CREATE TABLE public.campaign_piece_sub_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.campaign_piece_locations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_piece_sub_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies (same open pattern as campaign_piece_locations)
CREATE POLICY "Authenticated users can view sub-locations"
  ON public.campaign_piece_sub_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sub-locations"
  ON public.campaign_piece_sub_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sub-locations"
  ON public.campaign_piece_sub_locations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sub-locations"
  ON public.campaign_piece_sub_locations FOR DELETE TO authenticated USING (true);

-- Add sub_location column to campaign_pieces
ALTER TABLE public.campaign_pieces ADD COLUMN sub_location TEXT DEFAULT NULL;

-- Index for fast lookups
CREATE INDEX idx_sub_locations_location_id ON public.campaign_piece_sub_locations(location_id);
CREATE INDEX idx_sub_locations_campaign_id ON public.campaign_piece_sub_locations(campaign_id);
