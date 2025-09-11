/*
  # Grant Platinum Reviewer Badge to User

  1. Changes
    - Directly grants the Platinum Reviewer badge to a specific user
    - Bypasses the normal review count requirement for demonstration
    - Provides detailed logging of the process

  2. Notes
    - This is a one-time operation for a specific user
    - Does not modify any triggers or functions
    - Uses direct SQL operations instead of calling trigger functions
*/

-- Directly grant Platinum Reviewer badge to the specified user
DO $$
DECLARE
  target_user_id uuid := 'ebecf594-3885-4559-a3c4-a86c71a5b23e';
  platinum_badge_id uuid;
  user_exists boolean;
  already_has_badge boolean;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE 'User with ID % does not exist', target_user_id;
    RETURN;
  END IF;
  
  -- Find the Platinum Reviewer badge ID
  SELECT id INTO platinum_badge_id
  FROM badge_definitions
  WHERE name = 'Platinum Reviewer' AND type = 'reviewer';
  
  IF platinum_badge_id IS NULL THEN
    RAISE NOTICE 'Platinum Reviewer badge not found in badge_definitions';
    RETURN;
  END IF;
  
  -- Check if user already has this badge
  SELECT EXISTS(
    SELECT 1 FROM user_badges 
    WHERE user_id = target_user_id AND badge_id = platinum_badge_id
  ) INTO already_has_badge;
  
  IF already_has_badge THEN
    RAISE NOTICE 'User already has the Platinum Reviewer badge';
    RETURN;
  END IF;
  
  -- Grant the badge directly
  INSERT INTO user_badges (user_id, badge_id)
  VALUES (target_user_id, platinum_badge_id);
  
  RAISE NOTICE 'Successfully granted Platinum Reviewer badge to user %', target_user_id;
END $$;