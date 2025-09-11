/*
  # Update Images Bucket to Support Video MIME Types

  1. Storage Configuration
    - Update existing `images` bucket to accept video MIME types
    - Keep existing image MIME types for backward compatibility
    - Support video formats: mp4, quicktime, webm, avi

  2. MIME Types Supported
    - Images: jpeg, png, webp, gif, bmp, tiff
    - Videos: mp4, quicktime, x-msvideo, webm
*/

-- Update the images bucket to support both image and video MIME types
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ],
  file_size_limit = 104857600  -- 100MB limit for videos
WHERE id = 'images';