
-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Add approval_status column to profiles
ALTER TABLE public.profiles
ADD COLUMN approval_status public.approval_status NOT NULL DEFAULT 'pending';

-- Mark existing users as approved (they were already using the system)
UPDATE public.profiles SET approval_status = 'approved';

-- Update the handle_new_user function to set pending status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, approval_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'pending');
  RETURN NEW;
END;
$function$;
