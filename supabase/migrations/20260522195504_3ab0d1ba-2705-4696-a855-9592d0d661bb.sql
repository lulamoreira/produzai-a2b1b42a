-- Create a compatibility view to avoid breaking existing code that still expects 'system_messages'
CREATE OR REPLACE VIEW public.system_messages AS
SELECT 
  id,
  key,
  category,
  content_pt_br AS content,
  NULL::uuid AS agency_id, -- system_messages previously had agency_id, but it's not in the new schema seed
  created_at,
  updated_at
FROM public.messages;

-- Ensure RLS is handled for the view (views don't have RLS themselves, they inherit from the base table)
-- But we might need to grant permissions
GRANT SELECT ON public.system_messages TO authenticated;
GRANT SELECT ON public.system_messages TO anon;
