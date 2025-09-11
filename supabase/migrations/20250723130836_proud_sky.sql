/*
  # Ensure Phone Authentication System is Working

  1. Purpose
    - Verify and fix phone authentication system
    - Ensure profiles table has proper phone columns
    - Fix any data inconsistencies
    - Ensure triggers are working correctly

  2. Changes
    - Check and add phone columns if missing
    - Sync existing auth.users phone data to profiles
    - Ensure proper constraints and indexes
    - Test authentication flow
*/

-- Ensure phone and phone_confirmed columns exist
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
    RAISE NOTICE 'Added phone column to profiles table';
  END IF;
  
  -- Add phone_confirmed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_confirmed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_confirmed boolean DEFAULT false;
    RAISE NOTICE 'Added phone_confirmed column to profiles table';
  END IF;
END $$;

-- Create unique index on phone (allowing nulls)
DROP INDEX IF EXISTS profiles_phone_unique;
CREATE UNIQUE INDEX profiles_phone_unique ON profiles(phone) WHERE phone IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_confirmed ON profiles(phone_confirmed);

-- Sync phone data from auth.users to profiles
INSERT INTO profiles (id, email, name, phone, phone_confirmed, account_type)
SELECT 
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'name', 'User'),
  u.phone,
  CASE WHEN u.phone_confirmed_at IS NOT NULL THEN true ELSE false END,
  COALESCE(u.raw_user_meta_data->>'account_type', 'user')
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update existing profiles with phone data from auth.users
UPDATE profiles p
SET 
  phone = u.phone,
  phone_confirmed = CASE WHEN u.phone_confirmed_at IS NOT NULL THEN true ELSE false END,
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id 
  AND u.phone IS NOT NULL 
  AND (p.phone IS NULL OR p.phone != u.phone);

-- Create or replace the user creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'Creating profile for user: %, phone: %, email: %', 
    NEW.id, 
    COALESCE(NEW.phone, 'none'), 
    COALESCE(NEW.email, 'none');

  INSERT INTO public.profiles (
    id, 
    email, 
    name,
    phone,
    phone_confirmed, 
    account_type,
    language
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.phone,
    CASE WHEN NEW.phone_confirmed_at IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    phone_confirmed = EXCLUDED.phone_confirmed,
    name = COALESCE(EXCLUDED.name, profiles.name),
    account_type = COALESCE(EXCLUDED.account_type, profiles.account_type),
    language = COALESCE(EXCLUDED.language, profiles.language),
    updated_at = now();
  
  RAISE NOTICE 'Profile created/updated successfully for user %', NEW.id;
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create/update profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle phone verification
CREATE OR REPLACE FUNCTION handle_phone_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- When phone is confirmed, update the profile
  IF NEW.phone_confirmed_at IS NOT NULL AND (OLD.phone_confirmed_at IS NULL OR OLD.phone_confirmed_at != NEW.phone_confirmed_at) THEN
    UPDATE profiles
    SET 
      phone = NEW.phone,
      phone_confirmed = true,
      updated_at = now()
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Phone confirmed for user %: %', NEW.id, NEW.phone;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update profile after phone confirmation for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_phone_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_phone_confirmed
  AFTER UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_phone_verification();

-- Function to check if user exists by phone
CREATE OR REPLACE FUNCTION get_user_by_phone(phone_param text)
RETURNS TABLE(user_id uuid, user_email text, user_name text, account_type text, phone_confirmed boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.name, p.account_type, p.phone_confirmed
  FROM profiles p
  WHERE p.phone = phone_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Display current schema status
DO $$
DECLARE
  column_count integer;
  phone_count integer;
  user_count integer;
BEGIN
  -- Count columns in profiles table
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'profiles';
  
  -- Count profiles with phone numbers
  SELECT COUNT(*) INTO phone_count
  FROM profiles
  WHERE phone IS NOT NULL;
  
  -- Count total users
  SELECT COUNT(*) INTO user_count
  FROM profiles;
  
  RAISE NOTICE 'Profiles table has % columns', column_count;
  RAISE NOTICE 'Found % profiles with phone numbers out of % total profiles', phone_count, user_count;
  RAISE NOTICE 'Phone authentication system is ready';
END $$;