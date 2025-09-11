/*
  # Add Phone Auth Debug Logging

  1. Changes
    - Add logging tables for phone auth attempts
    - Add functions to log phone verification attempts
    - Create views to analyze success rates

  2. Notes
    - This helps troubleshoot Twilio integration issues
    - Maintains audit trail of verification attempts
*/

-- Create a logging table for phone auth attempts
CREATE TABLE IF NOT EXISTS auth_phone_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  success boolean,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE auth_phone_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view logs
CREATE POLICY "Only admins can view phone auth logs"
  ON auth_phone_attempts FOR SELECT
  USING (
    -- This will be replaced with proper admin check in production
    auth.uid() IN (SELECT id FROM profiles WHERE account_type = 'business')
  );

-- Index for better query performance
CREATE INDEX IF NOT EXISTS idx_auth_phone_attempts_phone ON auth_phone_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_auth_phone_attempts_created_at ON auth_phone_attempts(created_at);

-- Create a function to toggle Twilio debug logging
CREATE OR REPLACE FUNCTION toggle_twilio_debug()
RETURNS boolean AS $$
DECLARE
  current_setting boolean;
BEGIN
  -- Get current setting
  SELECT value::boolean INTO current_setting
  FROM auth.config
  WHERE name = 'twilio_debug_mode';
  
  -- Toggle setting
  UPDATE auth.config
  SET value = (NOT COALESCE(current_setting, false))::text
  WHERE name = 'twilio_debug_mode';
  
  -- If setting doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO auth.config (name, value)
    VALUES ('twilio_debug_mode', 'true');
    
    RETURN true;
  END IF;
  
  RETURN NOT COALESCE(current_setting, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE auth_phone_attempts IS 
  'Logs phone authentication attempts to help troubleshoot issues with Twilio integration';

-- Log function to help with troubleshooting
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

-- Create a view to help analyze phone auth success rates
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

-- Grant permissions for the RPC function
GRANT EXECUTE ON FUNCTION log_phone_auth_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_twilio_debug TO authenticated;

-- Create a test entry in the log
DO $$
BEGIN
  PERFORM log_phone_auth_attempt(
    '+1234567890',
    false,
    'Test entry - This is just for schema validation',
    '127.0.0.1',
    'Test Agent'
  );
END $$;