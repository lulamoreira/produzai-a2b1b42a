CREATE TABLE public.installer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.installation_team_members(id) ON DELETE CASCADE,
  label text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  created_at timestamptz DEFAULT now(),
  uploaded_by uuid
);
CREATE INDEX idx_installer_documents_member_id ON public.installer_documents(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installer_documents TO authenticated;
GRANT ALL ON public.installer_documents TO service_role;
ALTER TABLE public.installer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View installer documents" ON public.installer_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_team_members m JOIN public.installation_teams t ON t.id = m.team_id
  WHERE m.id = installer_documents.member_id AND public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'view_schedules')));
CREATE POLICY "Insert installer documents" ON public.installer_documents FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.installation_team_members m JOIN public.installation_teams t ON t.id = m.team_id
  WHERE m.id = installer_documents.member_id AND public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));
CREATE POLICY "Update installer documents" ON public.installer_documents FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_team_members m JOIN public.installation_teams t ON t.id = m.team_id
  WHERE m.id = installer_documents.member_id AND public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));
CREATE POLICY "Delete installer documents" ON public.installer_documents FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_team_members m JOIN public.installation_teams t ON t.id = m.team_id
  WHERE m.id = installer_documents.member_id AND (public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules') OR public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'delete_schedules'))));

CREATE POLICY "Installer docs read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'installer-documents' AND EXISTS (SELECT 1 FROM public.installation_teams t
  WHERE t.id::text = (storage.foldername(name))[1] AND public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'view_schedules')));
CREATE POLICY "Installer docs insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'installer-documents' AND EXISTS (SELECT 1 FROM public.installation_teams t
  WHERE t.id::text = (storage.foldername(name))[1] AND public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));
CREATE POLICY "Installer docs delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'installer-documents' AND EXISTS (SELECT 1 FROM public.installation_teams t
  WHERE t.id::text = (storage.foldername(name))[1] AND (public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules') OR public.has_campaign_category_permission(auth.uid(), t.campaign_id, 'delete_schedules'))));