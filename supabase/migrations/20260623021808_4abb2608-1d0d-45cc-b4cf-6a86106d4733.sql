ALTER TABLE budget_qty_requotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_users_manage_budget_qty_requotes" ON budget_qty_requotes;

CREATE POLICY "agency_users_manage_budget_qty_requotes"
ON budget_qty_requotes
FOR ALL
TO authenticated
USING (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id
    JOIN user_agency_access uaa ON uaa.agency_id = cl.agency_id
    WHERE uaa.user_id = auth.uid() AND uaa.suspended = false
  )
)
WITH CHECK (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id
    JOIN user_agency_access uaa ON uaa.agency_id = cl.agency_id
    WHERE uaa.user_id = auth.uid() AND uaa.suspended = false
  )
);