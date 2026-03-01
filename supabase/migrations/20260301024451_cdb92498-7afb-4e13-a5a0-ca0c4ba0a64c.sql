
-- Create occurrence_statuses table
CREATE TABLE public.occurrence_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  is_default boolean NOT NULL DEFAULT false,
  "order" integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.occurrence_statuses ENABLE ROW LEVEL SECURITY;

-- Anyone can read statuses
CREATE POLICY "Public read statuses" ON public.occurrence_statuses FOR SELECT USING (true);

-- Admins manage statuses
CREATE POLICY "Admins manage statuses" ON public.occurrence_statuses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default statuses
INSERT INTO public.occurrence_statuses (label, value, color, is_default, "order") VALUES
  ('Pendente', 'pending', '#f59e0b', true, 0),
  ('Resolvida', 'resolved', '#22c55e', false, 1),
  ('Rejeitada', 'rejected', '#ef4444', false, 2);
