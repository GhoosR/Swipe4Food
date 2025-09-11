/*
  # Fix Language Column Schema Cache Issue

  1. Changes
    - Ensure language column exists in profiles table
    - Force PostgREST to refresh its schema cache
    - Reset schema cache to fix PGRST204 error
    - Upgrade cache refresh mechanism with stronger signals

  2. Notes
    - This migration addresses the "Could not find the 'language' column of 'profiles' in the schema cache" error
    - Uses multiple cache refresh techniques for better reliability
*/

-- First ensure the column actually exists with proper constraints
DO $$
BEGIN
  -- Check if column exists, add it if it doesn't
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'language'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN language text 
    DEFAULT 'en'
    CHECK (language IN ('en', 'nl', 'es', 'fr', 'de', 'it'));
  ELSE
    -- Drop and recreate constraint to ensure it's correct
    ALTER TABLE profiles 
    DROP CONSTRAINT IF EXISTS profiles_language_check;
    
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_language_check
    CHECK (language IN ('en', 'nl', 'es', 'fr', 'de', 'it'));
  END IF;
END $$;

-- Force schema cache refresh with multiple mechanisms

-- Notify PostgREST to reload schema (standard method)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- Stronger method: slightly alter and restore the table structure
-- to force a schema recalculation
DO $$
BEGIN
  -- Add a temporary column to force schema reload
  ALTER TABLE profiles ADD COLUMN _temp_trigger_refresh BOOLEAN;
  
  -- Remove the temporary column
  ALTER TABLE profiles DROP COLUMN _temp_trigger_refresh;
  
  -- Log success
  RAISE NOTICE 'Schema cache refresh operations completed. The language column should now be recognized.';
END $$;

-- Forcefully update all NULL language values to 'en'
UPDATE profiles 
SET language = 'en' 
WHERE language IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN profiles.language IS 'User preferred language: en (English), nl (Dutch), es (Spanish), fr (French), de (German), it (Italian)';