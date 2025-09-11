/*
  # Disable Email Verification and Improve User Experience

  1. Changes
    - Update auth settings to disable email confirmation
    - Ensure smooth signup flow without email verification
    - Handle duplicate email checking

  2. Notes
    - This is for development/testing purposes
    - In production, you may want to re-enable email verification
*/

-- Update auth configuration to disable email confirmation
-- Note: This needs to be done in Supabase Dashboard under Authentication > Settings
-- Set "Enable email confirmations" to OFF
-- Set "Enable email change confirmations" to OFF

-- Ensure the handle_new_user function works correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user')
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

-- Recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();