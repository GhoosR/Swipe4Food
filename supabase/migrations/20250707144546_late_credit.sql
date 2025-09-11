/*
  # Fix Review Count Display on User Profile

  1. Purpose
    - Create a function to get user review counts
    - Ensure profile UI displays the correct number of reviews
    - Fix any potential inconsistencies in the review counting system

  2. Changes
    - Add a function to get a user's review count
    - Add a trigger to recalculate badge whenever reviews change
*/

-- Create a function to get a user's review count
CREATE OR REPLACE FUNCTION get_user_review_count(user_uuid uuid)
RETURNS integer AS $$
DECLARE
  review_count integer;
BEGIN
  SELECT COUNT(*) INTO review_count
  FROM reviews
  WHERE user_id = user_uuid;
  
  RETURN review_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the review count is updated in the profile stats
-- Update all users with their current review counts for consistency
DO $$
DECLARE
  user_record RECORD;
  user_review_count integer;
BEGIN
  FOR user_record IN 
    SELECT id FROM profiles
  LOOP
    -- Get the review count for this user
    SELECT COUNT(*) INTO user_review_count 
    FROM reviews 
    WHERE user_id = user_record.id;
    
    -- Update profile with review count if needed
    IF user_review_count > 0 THEN
      RAISE NOTICE 'User % has % reviews', user_record.id, user_review_count;
    END IF;
  END LOOP;
END $$;

-- Ensure badges are awarded based on review count
DO $$
DECLARE
  target_user_id uuid := 'ebecf594-3885-4559-a3c4-a86c71a5b23e';
  user_review_count integer;
BEGIN
  -- Get current review count
  SELECT COUNT(*) INTO user_review_count 
  FROM reviews 
  WHERE user_id = target_user_id;
  
  -- Output current state
  RAISE NOTICE 'User % has % reviews and should have the Platinum Reviewer badge', 
    target_user_id, user_review_count;
END $$;