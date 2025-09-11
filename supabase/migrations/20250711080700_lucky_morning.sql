/*
  # Expand Language Options for Profiles

  1. Changes
    - Update language field constraint to include more languages
    - Add Dutch, German, and Italian to supported languages
    - Maintain existing language field functionality

  2. Security
    - Keep existing RLS policies
    - No changes to access patterns
*/

-- Update language constraint to include more languages
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_language_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_language_check
CHECK (language IN ('en', 'nl', 'es', 'fr', 'de', 'it'));

-- Add comment to explain supported languages
COMMENT ON COLUMN profiles.language IS 'User preferred language: en (English), nl (Dutch), es (Spanish), fr (French), de (German), it (Italian)';