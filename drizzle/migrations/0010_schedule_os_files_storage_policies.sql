DROP POLICY IF EXISTS schedule_os_files_auth_select ON storage.objects;
DROP POLICY IF EXISTS schedule_os_files_auth_insert ON storage.objects;
DROP POLICY IF EXISTS schedule_os_files_auth_update ON storage.objects;
DROP POLICY IF EXISTS schedule_os_files_auth_delete ON storage.objects;

CREATE POLICY schedule_os_files_auth_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'schedule-os-files');
CREATE POLICY schedule_os_files_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'schedule-os-files');
CREATE POLICY schedule_os_files_auth_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'schedule-os-files') WITH CHECK (bucket_id = 'schedule-os-files');
CREATE POLICY schedule_os_files_auth_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'schedule-os-files');