drop policy if exists "installer_docs_auth_insert" on storage.objects;
drop policy if exists "installer_docs_auth_select" on storage.objects;
drop policy if exists "installer_docs_auth_update" on storage.objects;
drop policy if exists "installer_docs_auth_delete" on storage.objects;

create policy "installer_docs_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'installer-documents');

create policy "installer_docs_auth_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'installer-documents');

create policy "installer_docs_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'installer-documents')
  with check (bucket_id = 'installer-documents');

create policy "installer_docs_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'installer-documents');