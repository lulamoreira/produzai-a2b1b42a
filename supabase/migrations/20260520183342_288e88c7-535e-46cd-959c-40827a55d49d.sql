-- Create app_ui_settings table
CREATE TABLE IF NOT EXISTS public.app_ui_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    ui_version text NOT NULL DEFAULT 'v1' CHECK (ui_version IN ('v1', 'v2')),
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_ui_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone authenticated can read UI settings"
ON public.app_ui_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins and masters can update UI settings"
ON public.app_ui_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'master')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'master')
    )
);

-- Insert initial row if not exists
INSERT INTO public.app_ui_settings (id, ui_version)
VALUES (1, 'v1')
ON CONFLICT (id) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at_app_ui_settings()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_app_ui_settings
BEFORE UPDATE ON public.app_ui_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at_app_ui_settings();
