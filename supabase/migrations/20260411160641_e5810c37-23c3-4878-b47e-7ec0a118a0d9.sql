
-- Add new columns to campaign_schedules for per-store install codes
ALTER TABLE public.campaign_schedules
  ADD COLUMN IF NOT EXISTS install_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS install_code_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS install_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS code_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkin_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkin_accuracy DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS checkin_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_device_info JSONB;

-- Create unique index for install_code per campaign (only for non-null codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_schedules_install_code
  ON public.campaign_schedules (campaign_id, install_code)
  WHERE install_code IS NOT NULL;

-- Create install access log table
CREATE TABLE IF NOT EXISTS public.install_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  install_code VARCHAR(5) NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.client_stores(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  action VARCHAR(50)
);

-- Enable RLS on install_access_log
ALTER TABLE public.install_access_log ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from public installer portal)
CREATE POLICY "Anyone can insert access logs"
  ON public.install_access_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read logs
CREATE POLICY "Authenticated users can read access logs"
  ON public.install_access_log FOR SELECT
  TO authenticated
  USING (true);

-- Drop the old team codes table
DROP TABLE IF EXISTS public.installation_team_codes;
