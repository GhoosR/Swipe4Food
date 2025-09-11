/*
  # Add Language Field to Profiles

  1. New Column
    - Add `language` field to profiles table to store user language preference
    - Default to 'en' (English)
    - Restrict values to supported languages only

  2. Security
    - Maintain existing RLS policies 
    - Users can update their own language preference
*/

-- Add language column to profiles table with constraints
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS language text 
DEFAULT 'en'
CHECK (language IN ('en', 'es', 'fr'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Update the handle_new_user function to set the default language
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, account_type, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;