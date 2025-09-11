/*
  # Enhanced Phone Auth Logging

  1. Changes
    - Add detailed logging for phone authentication attempts
    - Create view for monitoring auth success rates
    - Add helpful functions to debug Twilio integration
    
  2. Notes
    - This helps diagnose why SMS verification codes aren't being received
    - Check the auth_phone_attempts table after login attempts to see errors
*/

-- Create logging table for phone authentication attempts
CREATE TABLE IF NOT EXISTS auth_phone_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  success boolean,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_auth_phone_attempts_phone ON auth_phone_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_auth_phone_attempts_created_at ON auth_phone_attempts(created_at);

-- Create function to log phone authentication attempts
CREATE OR REPLACE FUNCTION log_phone_auth_attempt(
  phone_param text,
  success_param boolean,
  error_message_param text DEFAULT NULL,
  ip_address_param text DEFAULT NULL,
  user_agent_param text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO auth_phone_attempts (
    phone,
    success,
    error_message,
    ip_address,
    user_agent
  ) VALUES (
    phone_param,
    success_param,
    error_message_param,
    ip_address_param,
    user_agent_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for phone authentication statistics
CREATE OR REPLACE VIEW phone_auth_stats AS
SELECT
  phone,
  COUNT(*) as attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
  MAX(CASE WHEN success THEN created_at ELSE NULL END) as last_success,
  MAX(CASE WHEN NOT success THEN created_at ELSE NULL END) as last_failure,
  MAX(CASE WHEN NOT success THEN error_message ELSE NULL END) as last_error
FROM auth_phone_attempts
GROUP BY phone
ORDER BY MAX(created_at) DESC;

-- Grant access to functions
GRANT EXECUTE ON FUNCTION log_phone_auth_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION log_phone_auth_attempt TO anon;

-- Note: To check why you're not receiving SMS codes, check the auth_phone_attempts table:
-- SELECT * FROM auth_phone_attempts ORDER BY created_at DESC LIMIT 10;
--
-- Common issues:
-- 1. Twilio account not properly configured in Supabase settings
-- 2. Trial Twilio accounts can only send to verified numbers
-- 3. Rate limiting (too many attempts)
-- 4. Incorrect phone number format (must include country code with +)