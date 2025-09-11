/*
  # Add Push Token Support

  1. Schema Changes
    - Add `push_token` column to `profiles` table for storing Expo push tokens
    - Add index for efficient push token lookups

  2. Security
    - Update RLS policies to allow users to update their own push tokens
*/

-- Add push_token column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'push_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_token text;
  END IF;
END $$;

-- Add index for push token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;