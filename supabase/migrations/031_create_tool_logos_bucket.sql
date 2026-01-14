-- Create tool-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tool-logos',
  'tool-logos',
  true,
  1048576, -- 1MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for tool logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tool-logos');

-- Allow authenticated admin users to upload
CREATE POLICY "Admin upload access for tool logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tool-logos' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE clerk_id = auth.uid()::text AND is_admin = true
  )
);

-- Allow admin users to delete
CREATE POLICY "Admin delete access for tool logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tool-logos' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE clerk_id = auth.uid()::text AND is_admin = true
  )
);
