
-- Table for managing store models per client
CREATE TABLE public.client_store_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, name)
);

-- Enable RLS
ALTER TABLE public.client_store_models ENABLE ROW LEVEL SECURITY;

-- Users with client access can view
CREATE POLICY "Users can view store models"
ON public.client_store_models
FOR SELECT
USING (has_client_access(auth.uid(), client_id));

-- Editors can insert
CREATE POLICY "Editors can insert store models"
ON public.client_store_models
FOR INSERT
WITH CHECK (has_category_permission(auth.uid(), client_id, 'edit_stores'));

-- Editors can update
CREATE POLICY "Editors can update store models"
ON public.client_store_models
FOR UPDATE
USING (has_category_permission(auth.uid(), client_id, 'edit_stores'));

-- Editors can delete
CREATE POLICY "Editors can delete store models"
ON public.client_store_models
FOR DELETE
USING (has_category_permission(auth.uid(), client_id, 'delete_stores'));
