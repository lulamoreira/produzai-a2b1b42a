-- Restore SELECT/UPDATE policies for supplier_invitations that were dropped
-- in migration 20260623211640. Without a SELECT policy, the .insert().select()
-- pattern from the agency suppliers page fails returning the new row, which
-- PostgREST surfaces as "new row violates row-level security policy".

CREATE POLICY "agency_select_own_invitations"
  ON public.supplier_invitations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "agency_update_own_invitations"
  ON public.supplier_invitations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);