/*
  # Create phone lookup function for authentication

  This function allows checking if a phone number exists in the profiles table
  without being blocked by Row Level Security policies. This is needed for
  the login flow where we need to check phone number existence before authentication.
*/

-- Create function to check if phone number exists (bypasses RLS)
CREATE OR REPLACE FUNCTION check_phone_exists(phone_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  phone_exists boolean := false;
  normalized_input text;
  profile_record record;
BEGIN
  -- Normalize input phone (remove all non-digit characters except +)
  normalized_input := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- Try exact matches first
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE phone = phone_input 
    OR phone = normalized_input
    OR phone = '+' || regexp_replace(phone_input, '[^0-9]', '', 'g')
    OR phone = regexp_replace(phone_input, '[^0-9]', '', 'g')
  ) INTO phone_exists;
  
  -- If no exact match, try digit-only comparison
  IF NOT phone_exists THEN
    FOR profile_record IN 
      SELECT phone FROM profiles WHERE phone IS NOT NULL
    LOOP
      -- Compare digits only
      IF regexp_replace(profile_record.phone, '[^0-9]', '', 'g') = 
         regexp_replace(phone_input, '[^0-9]', '', 'g') THEN
        phone_exists := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN phone_exists;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION check_phone_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION check_phone_exists(text) TO authenticated;