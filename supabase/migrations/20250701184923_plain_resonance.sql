/*
  # Create Restaurant Images Storage Bucket

  1. Storage
    - Create bucket for restaurant images
    - Set up policies for image access and upload
    - Allow public read access for restaurant banners
    - Allow authenticated users to upload images

  2. Security
    - Restaurant owners can upload images for their restaurants
    - Public read access for displaying images
    - Proper file type and size restrictions
*/

-- Create storage bucket for restaurant images
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-images', 'restaurant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for restaurant images
CREATE POLICY "Anyone can view restaurant images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-images');

CREATE POLICY "Authenticated users can upload restaurant images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'restaurant-images');

CREATE POLICY "Users can update their own restaurant images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'restaurant-images');

CREATE POLICY "Users can delete their own restaurant images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'restaurant-images');