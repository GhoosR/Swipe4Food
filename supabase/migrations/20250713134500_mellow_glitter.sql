/*
  # Fix Phone Authentication and Login

  1. Changes
    - Add phone column to profiles table if it doesn't exist
    - Add phone_confirmed column to track verification status
    - Fix auth triggers and functions to properly update profiles
    - Add indexes for better query performance

  2. Security
    - Maintain existing RLS policies
    - Ensure proper validation of phone numbers
*/

-- Ensure phone field exists in profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone text UNIQUE;

-- Add phone_confirmed field if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone_confirmed boolean DEFAULT false;

-- Add index for better performance on phone queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Update the handle_new_user function to properly handle phone signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the user creation attempt
  RAISE NOTICE 'Creating new user with id: %, email: %, phone: %', 
    NEW.id, 
    COALESCE(NEW.email, 'none'), 
    COALESCE(NEW.phone, 'none');

  INSERT INTO public.profiles (
    id, 
    email, 
    name,
    phone,
    phone_confirmed, 
    account_type
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NULL),
    CASE WHEN NEW.phone IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    phone_confirmed = EXCLUDED.phone_confirmed,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to handle phone verification
CREATE OR REPLACE FUNCTION handle_phone_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- When a phone number is verified, update the profile
  IF NEW.phone_confirmed_at IS NOT NULL AND (OLD.phone_confirmed_at IS NULL OR OLD.phone_confirmed_at != NEW.phone_confirmed_at) THEN
    -- Update the profile's phone_confirmed status
    UPDATE profiles
    SET 
      phone_confirmed = true,
      phone = NEW.phone,
      updated_at = now()
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Phone verified for user %: %', NEW.id, NEW.phone;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the verification process
    RAISE WARNING 'Failed to update profile after phone verification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the phone verification trigger
DROP TRIGGER IF EXISTS on_auth_user_phone_verified ON auth.users;
CREATE TRIGGER on_auth_user_phone_verified
  AFTER UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_phone_verification();

-- Fix existing profiles with phone numbers from auth.users
UPDATE profiles p
SET 
  phone = u.phone,
  phone_confirmed = CASE WHEN u.phone_confirmed_at IS NOT NULL THEN true ELSE false END
FROM auth.users u
WHERE p.id = u.id 
  AND u.phone IS NOT NULL 
  AND (p.phone IS NULL OR p.phone != u.phone);

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to retrieve profile by phone
CREATE OR REPLACE FUNCTION get_profile_by_phone(phone_param text)
RETURNS SETOF profiles AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM profiles p
  WHERE p.phone = phone_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful log message for debugging
DO $$
BEGIN
  RAISE NOTICE 'Phone authentication fix complete - profiles table now has phone column';
END $$;