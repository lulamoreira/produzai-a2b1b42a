CREATE OR REPLACE FUNCTION campaigns_set_active() RETURNS void AS $$
BEGIN
  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT campaigns_set_active();

-- RLS: non-admin/master users can only SELECT active campaigns
-- We use a policy that allows access if (is_active = true) OR (user is admin/master)
DROP POLICY IF EXISTS "users_read_active_campaigns" ON campaigns;
CREATE POLICY "users_read_active_campaigns"
ON campaigns FOR SELECT
TO authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

-- Only admins and masters can UPDATE is_active
DROP POLICY IF EXISTS "admins_toggle_campaign_active" ON campaigns;
CREATE POLICY "admins_toggle_campaign_active"
ON campaigns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
)
WITH CHECK (true);