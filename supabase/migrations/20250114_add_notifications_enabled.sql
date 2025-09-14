-- Add notifications_enabled column to profiles table
ALTER TABLE profiles 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;

-- Update existing profiles to have notifications enabled by default
UPDATE profiles 
SET notifications_enabled = true 
WHERE notifications_enabled IS NULL;

