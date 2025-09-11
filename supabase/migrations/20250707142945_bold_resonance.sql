/*
  # Badge System for Reviewers and Restaurants

  1. New Tables
    - `user_badges` - Track badges earned by users
    - `restaurant_badges` - Track badges earned by restaurants
    - `badge_definitions` - Define available badge types and requirements

  2. Badge Types
    - Reviewer badges: Bronze (10 reviews), Silver (25 reviews), Gold (50 reviews), Platinum (100 reviews)
    - Restaurant badges: Verified Excellence (5-star from Gold+ reviewer), Critics' Choice (multiple badged reviewer 5-stars)

  3. Automation
    - Triggers to automatically award badges when conditions are met
    - Functions to calculate badge eligibility

  4. Security
    - Enable RLS on all badge tables
    - Proper policies for badge visibility and management
*/

-- Create badge definitions table
CREATE TABLE IF NOT EXISTS badge_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('reviewer', 'restaurant')),
  description text NOT NULL,
  icon text NOT NULL, -- emoji or icon name
  color text NOT NULL, -- hex color for badge display
  requirement_type text NOT NULL CHECK (requirement_type IN ('review_count', 'special_review', 'multiple_special_reviews')),
  requirement_value integer, -- number of reviews needed, etc.
  sort_order integer DEFAULT 0, -- for display ordering
  created_at timestamptz DEFAULT now()
);

-- Create user badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES badge_definitions(id) ON DELETE CASCADE NOT NULL,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id) -- One badge per user
);

-- Create restaurant badges table
CREATE TABLE IF NOT EXISTS restaurant_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES badge_definitions(id) ON DELETE CASCADE NOT NULL,
  awarded_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL, -- who triggered this badge
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, badge_id) -- One badge per restaurant
);

-- Enable RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_badges ENABLE ROW LEVEL SECURITY;

-- Badge definitions policies (public read)
CREATE POLICY "Anyone can read badge definitions"
  ON badge_definitions FOR SELECT
  TO authenticated
  USING (true);

-- User badges policies
CREATE POLICY "Anyone can read user badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (true);

-- Restaurant badges policies
CREATE POLICY "Anyone can read restaurant badges"
  ON restaurant_badges FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_badges_restaurant_id ON restaurant_badges(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_badges_badge_id ON restaurant_badges(badge_id);

-- Insert badge definitions
INSERT INTO badge_definitions (name, type, description, icon, color, requirement_type, requirement_value, sort_order) VALUES
  ('Bronze Reviewer', 'reviewer', 'Written 10 thoughtful reviews', '🥉', '#CD7F32', 'review_count', 10, 1),
  ('Silver Reviewer', 'reviewer', 'Written 25 detailed reviews', '🥈', '#C0C0C0', 'review_count', 25, 2),
  ('Gold Reviewer', 'reviewer', 'Written 50 comprehensive reviews', '🥇', '#FFD700', 'review_count', 50, 3),
  ('Platinum Reviewer', 'reviewer', 'Written 100+ exceptional reviews', '💎', '#E5E4E2', 'review_count', 100, 4),
  ('Verified Excellence', 'restaurant', 'Received 5-star review from Gold+ reviewer', '✨', '#FFD700', 'special_review', 1, 1),
  ('Critics Choice', 'restaurant', 'Received multiple 5-star reviews from badged reviewers', '🌟', '#FF6B35', 'multiple_special_reviews', 3, 2)
ON CONFLICT (name) DO NOTHING;

-- Function to calculate and award reviewer badges
CREATE OR REPLACE FUNCTION check_and_award_reviewer_badges()
RETURNS TRIGGER AS $$
DECLARE
  review_count integer;
  badge_record RECORD;
BEGIN
  -- Get total review count for the user
  SELECT COUNT(*) INTO review_count
  FROM reviews 
  WHERE user_id = NEW.user_id;
  
  -- Check each reviewer badge level
  FOR badge_record IN 
    SELECT * FROM badge_definitions 
    WHERE type = 'reviewer' 
    AND requirement_type = 'review_count' 
    AND requirement_value <= review_count
    ORDER BY requirement_value DESC
  LOOP
    -- Award the highest eligible badge if not already awarded
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, badge_record.id)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    
    -- Only award the highest badge
    EXIT;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and award restaurant badges
CREATE OR REPLACE FUNCTION check_and_award_restaurant_badges()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_badge_count integer;
  special_review_count integer;
  badge_record RECORD;
  verified_excellence_badge_id uuid;
  critics_choice_badge_id uuid;
BEGIN
  -- Only process 5-star reviews
  IF NEW.rating = 5 THEN
    -- Check if the reviewer has any badges
    SELECT COUNT(*) INTO reviewer_badge_count
    FROM user_badges ub
    JOIN badge_definitions bd ON ub.badge_id = bd.id
    WHERE ub.user_id = NEW.user_id 
    AND bd.type = 'reviewer'
    AND bd.name IN ('Gold Reviewer', 'Platinum Reviewer');
    
    -- If reviewer has Gold+ badge, award Verified Excellence
    IF reviewer_badge_count > 0 THEN
      SELECT id INTO verified_excellence_badge_id
      FROM badge_definitions 
      WHERE name = 'Verified Excellence';
      
      INSERT INTO restaurant_badges (restaurant_id, badge_id, awarded_by_user_id)
      VALUES (NEW.restaurant_id, verified_excellence_badge_id, NEW.user_id)
      ON CONFLICT (restaurant_id, badge_id) DO NOTHING;
    END IF;
    
    -- Check for Critics Choice (3+ 5-star reviews from any badged reviewers)
    SELECT COUNT(DISTINCT r.user_id) INTO special_review_count
    FROM reviews r
    JOIN user_badges ub ON r.user_id = ub.user_id
    JOIN badge_definitions bd ON ub.badge_id = bd.id
    WHERE r.restaurant_id = NEW.restaurant_id
    AND r.rating = 5
    AND bd.type = 'reviewer';
    
    IF special_review_count >= 3 THEN
      SELECT id INTO critics_choice_badge_id
      FROM badge_definitions 
      WHERE name = 'Critics Choice';
      
      INSERT INTO restaurant_badges (restaurant_id, badge_id, awarded_by_user_id)
      VALUES (NEW.restaurant_id, critics_choice_badge_id, NEW.user_id)
      ON CONFLICT (restaurant_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER award_reviewer_badges_trigger
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_and_award_reviewer_badges();

CREATE TRIGGER award_restaurant_badges_trigger
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_and_award_restaurant_badges();

-- Also check when reviews are updated (in case rating changes)
CREATE TRIGGER update_restaurant_badges_trigger
  AFTER UPDATE ON reviews
  FOR EACH ROW
  WHEN (OLD.rating != NEW.rating)
  EXECUTE FUNCTION check_and_award_restaurant_badges();

-- Function to get user's highest badge
CREATE OR REPLACE FUNCTION get_user_highest_badge(user_uuid uuid)
RETURNS TABLE(badge_name text, badge_icon text, badge_color text) AS $$
BEGIN
  RETURN QUERY
  SELECT bd.name, bd.icon, bd.color
  FROM user_badges ub
  JOIN badge_definitions bd ON ub.badge_id = bd.id
  WHERE ub.user_id = user_uuid
  AND bd.type = 'reviewer'
  ORDER BY bd.sort_order DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award badges to existing users based on their current review count
DO $$
DECLARE
  user_record RECORD;
  review_count integer;
  badge_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles LOOP
    -- Get review count for this user
    SELECT COUNT(*) INTO review_count
    FROM reviews 
    WHERE user_id = user_record.id;
    
    -- Award appropriate badge
    FOR badge_record IN 
      SELECT * FROM badge_definitions 
      WHERE type = 'reviewer' 
      AND requirement_type = 'review_count' 
      AND requirement_value <= review_count
      ORDER BY requirement_value DESC
      LIMIT 1
    LOOP
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (user_record.id, badge_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Awarded badges to existing users based on review history';
END $$;