/*
  # Fix Phone Column in Profiles Table

  1. Critical Fix
    - Ensure phone and phone_confirmed columns exist in profiles table
    - Add proper constraints and indexes
    - Sync phone data from auth.users to profiles
    - Create proper triggers for phone authentication

  2. Database Structure
    - phone (text) - stores the phone number with country code
    - phone_confirmed (boolean) - tracks if phone is verified
    - Unique constraint on phone to prevent duplicates

  3. Data Integrity
    - Sync existing phone data from auth.users
    - Create missing profiles for any auth.users without profiles
    - Update triggers to handle phone verification properly
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
  ELSE
    RAISE NOTICE 'Phone column already exists in profiles table';
  END IF;
  
  -- Add phone_confirmed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_confirmed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_confirmed boolean DEFAULT false;
    RAISE NOTICE 'Added phone_confirmed column to profiles table';
  ELSE
    RAISE NOTICE 'Phone_confirmed column already exists in profiles table';
  END IF;
END $$;

-- Create unique index on phone (allowing nulls)
DROP INDEX IF EXISTS profiles_phone_unique;
CREATE UNIQUE INDEX profiles_phone_unique ON profiles(phone) WHERE phone IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_confirmed ON profiles(phone_confirmed);

-- Sync phone data from auth.users to profiles and create missing profiles
DO $$
DECLARE
  user_record RECORD;
  profile_exists boolean;
BEGIN
  FOR user_record IN 
    SELECT id, email, phone, phone_confirmed_at, raw_user_meta_data
    FROM auth.users
  LOOP
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = user_record.id) INTO profile_exists;
    
    IF NOT profile_exists THEN
      -- Create missing profile
      BEGIN
        INSERT INTO profiles (
          id, 
          email, 
          name, 
          phone, 
          phone_confirmed, 
          account_type
        ) VALUES (
          user_record.id,
          COALESCE(user_record.email, ''),
          COALESCE(user_record.raw_user_meta_data->>'name', 'User'),
          user_record.phone,
          CASE WHEN user_record.phone_confirmed_at IS NOT NULL THEN true ELSE false END,
          COALESCE(user_record.raw_user_meta_data->>'account_type', 'user')
        );
        
        RAISE NOTICE 'Created missing profile for user %', user_record.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to create profile for user %: %', user_record.id, SQLERRM;
      END;
    ELSE
      -- Update existing profile with phone data
      UPDATE profiles 
      SET 
        phone = user_record.phone,
        phone_confirmed = CASE WHEN user_record.phone_confirmed_at IS NOT NULL THEN true ELSE false END,
        updated_at = now()
      WHERE id = user_record.id 
        AND (phone IS DISTINCT FROM user_record.phone OR phone_confirmed IS DISTINCT FROM (user_record.phone_confirmed_at IS NOT NULL));
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed syncing phone data from auth.users to profiles';
END $$;

-- Create comprehensive user creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'Creating profile for new user: %, phone: %, email: %', 
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

-- Recreate triggers to ensure they work properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_phone_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_phone_confirmed
  AFTER UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_phone_verification();

-- Create function to check if user exists by phone
CREATE OR REPLACE FUNCTION get_user_by_phone(phone_param text)
RETURNS TABLE(user_id uuid, user_email text, user_name text, account_type text, phone_confirmed boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.name, p.account_type, p.phone_confirmed
  FROM profiles p
  WHERE p.phone = phone_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Display final status
DO $$
DECLARE
  column_count integer;
  phone_count integer;
  user_count integer;
  has_phone_column boolean;
  has_phone_confirmed_column boolean;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) INTO has_phone_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_confirmed'
  ) INTO has_phone_confirmed_column;
  
  -- Count profiles with phone numbers
  IF has_phone_column THEN
    SELECT COUNT(*) INTO phone_count FROM profiles WHERE phone IS NOT NULL;
  ELSE
    phone_count := 0;
  END IF;
  
  -- Count total users
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  RAISE NOTICE '=== PHONE AUTHENTICATION STATUS ===';
  RAISE NOTICE 'Phone column exists: %', has_phone_column;
  RAISE NOTICE 'Phone_confirmed column exists: %', has_phone_confirmed_column;
  RAISE NOTICE 'Profiles with phone numbers: %', phone_count;
  RAISE NOTICE 'Total profiles: %', user_count;
  RAISE NOTICE '=== PHONE AUTHENTICATION READY ===';
END $$;