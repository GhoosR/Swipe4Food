/*
  # Create Restaurant Images Storage Bucket

  1. Storage Bucket
    - Create 'restaurant-images' bucket for storing restaurant banner images
    - Set 5MB file size limit
    - Allow common image formats (JPEG, PNG, WebP)
    - Enable public read access

  2. Storage Policies
    - Allow authenticated users to upload images
    - Allow public read access to images
    - Allow authenticated users to update/delete their images

  3. Notes
    - Handles existing policies by dropping them first
    - Uses conflict resolution for bucket creation
*/

-- Create the restaurant-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete restaurant images" ON storage.objects;

-- Create policy to allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'restaurant-images');

-- Create policy to allow public read access to restaurant images
CREATE POLICY "Public can view restaurant images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'restaurant-images');

-- Create policy to allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update restaurant images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'restaurant-images')
WITH CHECK (bucket_id = 'restaurant-images');

-- Create policy to allow authenticated users to delete their uploaded images
CREATE POLICY "Authenticated users can delete restaurant images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'restaurant-images');