/*
  # Fix profile insertion policy

  1. Security Changes
    - Add policy to allow users to insert their own profile during signup
    - Ensure users can create their profile record when auth.uid() matches the profile id

  2. Notes
    - This fixes the RLS violation error during signup
    - Users can only insert profiles for their own authenticated user ID
*/

-- Drop existing insert policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;

-- Create a new policy that allows users to insert their own profile
CREATE POLICY "Users can insert own profile during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);