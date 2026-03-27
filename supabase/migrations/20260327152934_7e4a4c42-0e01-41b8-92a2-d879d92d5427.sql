ALTER TABLE public.profiles
  ADD COLUMN phone text DEFAULT NULL,
  ADD COLUMN job_title text DEFAULT NULL,
  ADD COLUMN nickname text DEFAULT NULL;