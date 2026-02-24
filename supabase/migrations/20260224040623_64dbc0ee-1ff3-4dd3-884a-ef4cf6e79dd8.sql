
-- Create permission categories table
CREATE TABLE public.permission_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  -- Clients module
  can_view_clients boolean NOT NULL DEFAULT true,
  can_edit_clients boolean NOT NULL DEFAULT false,
  can_delete_clients boolean NOT NULL DEFAULT false,
  -- Campaigns module
  can_view_campaigns boolean NOT NULL DEFAULT true,
  can_edit_campaigns boolean NOT NULL DEFAULT false,
  can_delete_campaigns boolean NOT NULL DEFAULT false,
  -- Stores module
  can_view_stores boolean NOT NULL DEFAULT true,
  can_edit_stores boolean NOT NULL DEFAULT false,
  can_delete_stores boolean NOT NULL DEFAULT false,
  -- Pieces module
  can_view_pieces boolean NOT NULL DEFAULT true,
  can_edit_pieces boolean NOT NULL DEFAULT false,
  can_delete_pieces boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permission_categories ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view categories
CREATE POLICY "Authenticated users can view categories"
ON public.permission_categories FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can insert categories"
ON public.permission_categories FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
ON public.permission_categories FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
ON public.permission_categories FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add category_id to user_client_access
ALTER TABLE public.user_client_access
ADD COLUMN category_id uuid REFERENCES public.permission_categories(id) ON DELETE SET NULL;

-- Insert default categories matching current behavior
INSERT INTO public.permission_categories (name, can_view_clients, can_edit_clients, can_delete_clients, can_view_campaigns, can_edit_campaigns, can_delete_campaigns, can_view_stores, can_edit_stores, can_delete_stores, can_view_pieces, can_edit_pieces, can_delete_pieces)
VALUES 
  ('Visualizador', true, false, false, true, false, false, true, false, false, true, false, false),
  ('Editor', true, true, false, true, true, false, true, true, false, true, true, false);

-- Create function to check module-level permission for a user on a client
CREATE OR REPLACE FUNCTION public.has_category_permission(_user_id uuid, _client_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_client_access uca
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id 
      AND uca.client_id = _client_id
      AND (
        (_permission = 'view_clients' AND pc.can_view_clients) OR
        (_permission = 'edit_clients' AND pc.can_edit_clients) OR
        (_permission = 'delete_clients' AND pc.can_delete_clients) OR
        (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR
        (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR
        (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
        (_permission = 'view_stores' AND pc.can_view_stores) OR
        (_permission = 'edit_stores' AND pc.can_edit_stores) OR
        (_permission = 'delete_stores' AND pc.can_delete_stores) OR
        (_permission = 'view_pieces' AND pc.can_view_pieces) OR
        (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR
        (_permission = 'delete_pieces' AND pc.can_delete_pieces)
      )
  ) OR public.has_role(_user_id, 'admin')
$$;
