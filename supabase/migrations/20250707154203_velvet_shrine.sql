/*
  # Add Verified Pro Badge and Award to Restaurants

  1. New Badge Definition
    - 'Verified Pro' badge for restaurants reviewed by 3+ professional reviewers
    - Award function to check and grant the badge
    - Initial award to specific restaurant and checking all restaurants

  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER functions for proper execution
*/

-- Insert new badge definition
INSERT INTO badge_definitions (name, type, description, icon, color, requirement_type, requirement_value, sort_order) VALUES
  ('Verified Pro', 'restaurant', 'Reviewed by 3 or more professional verified reviewers', '🏅', '#4F46E5', 'multiple_special_reviews', 3, 3)
ON CONFLICT (name) DO NOTHING;

-- Function to check and award the Verified Pro badge
CREATE OR REPLACE FUNCTION check_and_award_verified_pro_badge(restaurant_uuid uuid)
RETURNS void AS $$
DECLARE
  verified_pro_badge_uuid uuid;
  pro_reviewer_count integer;
BEGIN
  -- Get the badge ID
  SELECT id INTO verified_pro_badge_uuid
  FROM badge_definitions 
  WHERE name = 'Verified Pro';
  
  IF verified_pro_badge_uuid IS NULL THEN
    RAISE NOTICE 'Verified Pro badge not found in badge definitions';
    RETURN;
  END IF;
  
  -- Count professional reviewers (users with Silver+ badges) who reviewed this restaurant
  SELECT COUNT(DISTINCT r.user_id) INTO pro_reviewer_count
  FROM reviews r
  JOIN user_badges ub ON r.user_id = ub.user_id
  JOIN badge_definitions bd ON ub.badge_id = bd.id
  WHERE r.restaurant_id = restaurant_uuid
  AND bd.type = 'reviewer'
  AND bd.name IN ('Silver Reviewer', 'Gold Reviewer', 'Platinum Reviewer');
  
  -- Award badge if 3+ professional reviewers
  IF pro_reviewer_count >= 3 THEN
    INSERT INTO restaurant_badges (restaurant_id, badge_id)
    VALUES (restaurant_uuid, verified_pro_badge_uuid)
    ON CONFLICT (restaurant_id, badge_id) DO NOTHING;
    
    RAISE NOTICE 'Awarded Verified Pro badge to restaurant %', restaurant_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award the badge to the specific restaurant
DO $$
DECLARE
  target_restaurant_uuid uuid := '20883f2b-8ae2-4f71-b424-88c0b82e014e';
  restaurant_exists boolean;
  verified_pro_badge_uuid uuid;
BEGIN
  -- Check if restaurant exists
  SELECT EXISTS(SELECT 1 FROM restaurants WHERE id = target_restaurant_uuid) INTO restaurant_exists;
  
  IF NOT restaurant_exists THEN
    RAISE NOTICE 'Restaurant with ID % does not exist', target_restaurant_uuid;
    RETURN;
  END IF;
  
  -- Get the badge ID
  SELECT id INTO verified_pro_badge_uuid
  FROM badge_definitions 
  WHERE name = 'Verified Pro';
  
  IF verified_pro_badge_uuid IS NULL THEN
    RAISE NOTICE 'Verified Pro badge not found in badge definitions';
    RETURN;
  END IF;
  
  -- Award the badge directly
  INSERT INTO restaurant_badges (restaurant_id, badge_id)
  VALUES (target_restaurant_uuid, verified_pro_badge_uuid)
  ON CONFLICT (restaurant_id, badge_id) DO NOTHING;
  
  RAISE NOTICE 'Successfully granted Verified Pro badge to restaurant %', target_restaurant_uuid;
END $$;

-- Check all restaurants and award badges where appropriate
DO $$
DECLARE
  restaurant_record RECORD;
  pro_reviewer_count integer;
  verified_pro_badge_uuid uuid;
BEGIN
  -- Get the badge ID
  SELECT id INTO verified_pro_badge_uuid
  FROM badge_definitions 
  WHERE name = 'Verified Pro';
  
  IF verified_pro_badge_uuid IS NULL THEN
    RAISE NOTICE 'Verified Pro badge not found in badge definitions';
    RETURN;
  END IF;
  
  -- Process all restaurants
  FOR restaurant_record IN 
    SELECT id, name FROM restaurants
  LOOP
    -- Count professional reviewers (users with Silver+ badges) for this restaurant
    SELECT COUNT(DISTINCT r.user_id) INTO pro_reviewer_count
    FROM reviews r
    JOIN user_badges ub ON r.user_id = ub.user_id
    JOIN badge_definitions bd ON ub.badge_id = bd.id
    WHERE r.restaurant_id = restaurant_record.id
    AND bd.type = 'reviewer'
    AND bd.name IN ('Silver Reviewer', 'Gold Reviewer', 'Platinum Reviewer');
    
    -- Award badge if 3+ professional reviewers
    IF pro_reviewer_count >= 3 THEN
      INSERT INTO restaurant_badges (restaurant_id, badge_id)
      VALUES (restaurant_record.id, verified_pro_badge_uuid)
      ON CONFLICT (restaurant_id, badge_id) DO NOTHING;
      
      RAISE NOTICE 'Awarded Verified Pro badge to restaurant % (%)', restaurant_record.id, restaurant_record.name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed checking all restaurants for Verified Pro badge';
END $$;