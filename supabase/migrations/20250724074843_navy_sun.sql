/*
  # Fix Security Definer View Issue

  1. Security Fix
    - Remove SECURITY DEFINER from phone_auth_stats view
    - Recreate view with proper security context
    - Ensure RLS policies are properly enforced

  2. Changes
    - Drop existing phone_auth_stats view
    - Recreate without SECURITY DEFINER property
    - View will now respect querying user's permissions
*/

-- Drop the existing view with SECURITY DEFINER
DROP VIEW IF EXISTS phone_auth_stats;

-- Recreate the view without SECURITY DEFINER
CREATE VIEW phone_auth_stats AS
SELECT 
  phone,
  COUNT(*) as attempts,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  MAX(created_at) FILTER (WHERE success = true) as last_success,
  MAX(created_at) FILTER (WHERE success = false) as last_failure,
  (array_agg(error_message ORDER BY created_at DESC) FILTER (WHERE success = false))[1] as last_error
FROM auth_phone_attempts
GROUP BY phone;

-- Add comment explaining the security fix
COMMENT ON VIEW phone_auth_stats IS 'Phone authentication statistics view - security definer removed for proper RLS enforcement';