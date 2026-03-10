ALTER TABLE public.campaign_pieces ADD COLUMN is_mockup boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaign_kits ADD COLUMN is_mockup boolean NOT NULL DEFAULT false;