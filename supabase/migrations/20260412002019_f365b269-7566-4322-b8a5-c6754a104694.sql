
ALTER TABLE public.profiles
  ADD COLUMN agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_agency_id ON public.profiles(agency_id);
CREATE INDEX idx_profiles_client_id ON public.profiles(client_id);
