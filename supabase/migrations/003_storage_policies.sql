-- Storage Bucket Configuration for Parking Assets
-- Secure storage rules for offline-first camera uploads

-- 1. Create the bucket if it doesn't exist (assuming Supabase Storage is initialized)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'parking_assets',
    'parking_assets',
    false, -- Private bucket
    5242880, -- 5MB limit
    '{image/jpeg, image/png, image/webp}'
)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Policies for tenant isolation

-- Allow users to upload assets only to their company's folder structure
-- Path format: {company_id}/{site_id}/{filename}
CREATE POLICY "Allow authenticated uploads to tenant folder" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'parking_assets' AND
        (storage.foldername(name))[1] = (
            SELECT company_id::text 
            FROM public.employees 
            WHERE auth_user_id = auth.uid() 
            LIMIT 1
        )
    );

-- Allow users to read assets only from their company's folder
CREATE POLICY "Allow authenticated reads from tenant folder" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'parking_assets' AND
        (storage.foldername(name))[1] = (
            SELECT company_id::text 
            FROM public.employees 
            WHERE auth_user_id = auth.uid() 
            LIMIT 1
        )
    );

-- Allow users to delete their own company's assets (e.g., sync rollback)
CREATE POLICY "Allow authenticated deletes from tenant folder" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'parking_assets' AND
        (storage.foldername(name))[1] = (
            SELECT company_id::text 
            FROM public.employees 
            WHERE auth_user_id = auth.uid() 
            LIMIT 1
        )
    );
