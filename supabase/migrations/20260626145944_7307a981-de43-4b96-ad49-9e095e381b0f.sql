CREATE POLICY "tmp_delete_test_file" ON storage.objects FOR DELETE TO anon
USING (
  bucket_id = 'supplier_files'
  AND name = 'suppliers/12b779b6-8226-4800-be90-bc6eb5d682be/test-4acf57a5-arquivo_sanitizado.txt'
);