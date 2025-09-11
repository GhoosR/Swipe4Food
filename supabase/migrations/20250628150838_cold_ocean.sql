/*
  # Fix Profile Update Policies

  1. Security Changes
    - Update profile policies to allow users to update their own profiles
    - Ensure account_type can be updated by the profile owner
    - Add proper RLS policies for profile updates

  2. Notes
    - This fixes the issue where users cannot switch account types
    - Users can only update their own profile data
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create comprehensive update policy for profiles
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure the profiles table has the correct structure
DO $$
BEGIN
  -- Check if account_type column exists and has correct constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_account_type_check'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_account_type_check 
    CHECK (account_type IN ('user', 'business'));
  END IF;
END $$;

-- Create index for better performance on account_type queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);

-- Ensure updated_at trigger is working
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();