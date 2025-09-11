/*
  # Recreate Storage System

  1. Clean Slate
    - Drop all existing storage buckets and policies
    - Remove any conflicting storage configurations

  2. New Storage Buckets
    - `images` - Single bucket for all images (avatars, restaurants, etc.)
    - Simple, unified structure for all platforms

  3. Security
    - Public read access for serving images
    - Authenticated users can upload/update their own images
    - Simple RLS policies without complex conditions
*/

-- Drop existing buckets if they exist
DELETE FROM storage.objects WHERE bucket_id IN ('avatars', 'restaurant-images', 'videos');
DELETE FROM storage.buckets WHERE id IN ('avatars', 'restaurant-images', 'videos');

-- Create a single images bucket for simplicity
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Create simple storage policies
CREATE POLICY "Anyone can view images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Users can update their own images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);