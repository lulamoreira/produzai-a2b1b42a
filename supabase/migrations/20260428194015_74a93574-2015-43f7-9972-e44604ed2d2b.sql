
ALTER TABLE public.campaign_support_materials
  ADD COLUMN IF NOT EXISTS share_with_supplier boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_supplier_support_materials(p_token text)
RETURNS TABLE (
  id uuid,
  title text,
  file_url text,
  file_name text,
  file_type text,
  display_order integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT csm.id, csm.title, csm.file_url, csm.file_name, csm.file_type, csm.display_order, csm.created_at
  FROM public.campaign_support_materials csm
  JOIN public.budget_suppliers bs ON bs.campaign_id = csm.campaign_id
  WHERE bs.access_token = p_token
    AND csm.share_with_supplier = true
    AND csm.file_url IS NOT NULL
  ORDER BY csm.display_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_support_materials(text) TO anon, authenticated;
