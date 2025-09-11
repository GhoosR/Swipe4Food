/*
  # Fix Language Column Issue

  1. Changes
    - Ensure language column exists in profiles table
    - Reset schema cache to fix PGRST204 error
    - Add missing constraints and defaults

  2. Notes
    - This migration fixes the issue with saving language preferences
    - Keeps existing language data intact
*/

-- Ensure language column exists with proper constraints
DO $$
BEGIN
  -- First check if the column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'language'
  ) THEN
    -- Add the language column
    ALTER TABLE profiles 
    ADD COLUMN language text 
    DEFAULT 'en'
    CHECK (language IN ('en', 'nl', 'es', 'fr', 'de', 'it'));
  ELSE
    -- Update constraints if needed
    ALTER TABLE profiles 
    DROP CONSTRAINT IF EXISTS profiles_language_check;
    
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_language_check
    CHECK (language IN ('en', 'nl', 'es', 'fr', 'de', 'it'));
  END IF;
END $$;

-- Create index for better performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Reset PostgREST schema cache by calling pg_notify
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- Add comment to explain supported languages
COMMENT ON COLUMN profiles.language IS 'User preferred language: en (English), nl (Dutch), es (Spanish), fr (French), de (German), it (Italian)';