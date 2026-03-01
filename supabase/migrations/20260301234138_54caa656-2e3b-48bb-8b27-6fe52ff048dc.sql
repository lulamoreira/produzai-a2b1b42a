
-- 1) Add new fields to occurrences table
ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS location_in_store text,
  ADD COLUMN IF NOT EXISTS actions_taken text,
  ADD COLUMN IF NOT EXISTS needs_reinstallation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reinstallation_os text,
  ADD COLUMN IF NOT EXISTS reinstallation_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS agency_observation text,
  ADD COLUMN IF NOT EXISTS expected_resolution_date date,
  ADD COLUMN IF NOT EXISTS resolved_date date;

-- 2) Add category column to occurrence_photos (report vs resolution)
ALTER TABLE public.occurrence_photos
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'report';

-- 3) Create occurrence_comments table (chat-like observations)
CREATE TABLE public.occurrence_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.occurrences(id) ON DELETE CASCADE,
  user_id uuid,
  user_display_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.occurrence_comments ENABLE ROW LEVEL SECURITY;

-- Comments are viewable by anyone with client access
CREATE POLICY "Users can view occurrence comments"
  ON public.occurrence_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM occurrences o
      JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.id = occurrence_comments.occurrence_id
      AND has_client_access(auth.uid(), c.client_id)
    )
  );

-- Editors can insert comments
CREATE POLICY "Editors can insert occurrence comments"
  ON public.occurrence_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM occurrences o
      JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.id = occurrence_comments.occurrence_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_occurrences')
    )
  );

-- Comments cannot be updated or deleted (permanent as requested)
-- No UPDATE or DELETE policies
