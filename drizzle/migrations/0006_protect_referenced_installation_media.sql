CREATE OR REPLACE FUNCTION public.installation_media_is_referenced(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.installation_photos WHERE split_part(photo_url,'/storage/v1/object/public/installation-photos/',2)=p_path);
$$;
REVOKE ALL ON FUNCTION public.installation_media_is_referenced(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.installation_media_is_referenced(text) TO authenticated, service_role;
CREATE POLICY "Preserve referenced installation media" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'installation-photos' OR NOT public.installation_media_is_referenced(name));