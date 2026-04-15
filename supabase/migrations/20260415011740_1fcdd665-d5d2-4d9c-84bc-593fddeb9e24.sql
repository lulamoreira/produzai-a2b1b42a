DO $$ DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'supplier_spec_suggestions'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON supplier_spec_suggestions';
  END LOOP;
END $$;

ALTER TABLE public.supplier_spec_suggestions DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supplier_spec_suggestions TO anon, authenticated;