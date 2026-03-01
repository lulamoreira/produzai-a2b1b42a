
ALTER TABLE public.profiles ADD COLUMN name_confirmed boolean NOT NULL DEFAULT false;

-- Mark existing users as confirmed so they don't see the dialog
UPDATE public.profiles SET name_confirmed = true;
