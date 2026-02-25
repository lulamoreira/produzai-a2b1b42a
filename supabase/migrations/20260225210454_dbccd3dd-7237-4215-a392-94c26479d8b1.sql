
-- Create agencies table
CREATE TABLE public.agencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agencies" ON public.agencies FOR SELECT USING (true);
CREATE POLICY "Admins can insert agencies" ON public.agencies FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update agencies" ON public.agencies FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete agencies" ON public.agencies FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add agency_id to clients
ALTER TABLE public.clients ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- Create first agency
INSERT INTO public.agencies (id, name) VALUES (gen_random_uuid(), 'Vimer Retail Experience');

-- Link all existing clients to Vimer
UPDATE public.clients SET agency_id = (SELECT id FROM public.agencies WHERE name = 'Vimer Retail Experience' LIMIT 1);

-- Make agency_id NOT NULL after backfill
ALTER TABLE public.clients ALTER COLUMN agency_id SET NOT NULL;
