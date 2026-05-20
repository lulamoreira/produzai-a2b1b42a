-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public access to the assets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access for campaign-assets'
    ) THEN
        CREATE POLICY "Public Access for campaign-assets"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'campaign-assets');
    END IF;
END
$$;

-- Policy to allow authenticated users to upload
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can upload to campaign-assets'
    ) THEN
        CREATE POLICY "Authenticated users can upload to campaign-assets"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'campaign-assets' 
            AND auth.role() = 'authenticated'
        );
    END IF;
END
$$;
