/*
  # Fix Review Submission and Rating Calculation

  1. Database Fixes
    - Improve the update_restaurant_rating() function with better error handling
    - Add proper constraints for rating validation and comment validation
    - Fix any existing incorrect counts in the database
    - Add better indexing for performance

  2. Security
    - Maintain existing RLS policies
    - Add SECURITY DEFINER to rating function for proper execution

  3. Performance
    - Add indexes for better query performance on reviews
    - Optimize rating calculation queries
*/

-- Drop and recreate the rating update function with better error handling
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating numeric;
  review_count integer;
  target_restaurant_id uuid;
BEGIN
  -- Determine which restaurant to update
  IF TG_OP = 'DELETE' THEN
    target_restaurant_id := OLD.restaurant_id;
  ELSE
    target_restaurant_id := NEW.restaurant_id;
  END IF;

  -- Calculate new average rating and count with proper error handling
  BEGIN
    SELECT 
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
      COUNT(*)::integer
    INTO avg_rating, review_count
    FROM reviews 
    WHERE restaurant_id = target_restaurant_id;

    -- Ensure we have valid values
    IF avg_rating IS NULL THEN
      avg_rating := 0;
    END IF;
    
    IF review_count IS NULL THEN
      review_count := 0;
    END IF;

    -- Update restaurant with proper error handling
    UPDATE restaurants 
    SET 
      rating = avg_rating,
      review_count = review_count,
      updated_at = now()
    WHERE id = target_restaurant_id;

    -- Log successful update
    RAISE NOTICE 'Updated restaurant % with rating % and count %', target_restaurant_id, avg_rating, review_count;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to update restaurant rating for %: %', target_restaurant_id, SQLERRM;
  END;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers with proper error handling
DROP TRIGGER IF EXISTS update_restaurant_rating_on_insert ON reviews;
DROP TRIGGER IF EXISTS update_restaurant_rating_on_update ON reviews;
DROP TRIGGER IF EXISTS update_restaurant_rating_on_delete ON reviews;

CREATE TRIGGER update_restaurant_rating_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

CREATE TRIGGER update_restaurant_rating_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

CREATE TRIGGER update_restaurant_rating_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

-- Ensure proper constraints exist using correct information_schema queries
DO $$
BEGIN
  -- Check if rating constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_name = 'reviews_rating_check'
    AND tc.table_name = 'reviews'
    AND tc.table_schema = 'public'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_rating_check 
    CHECK (rating >= 1 AND rating <= 5);
  END IF;

  -- Check if comment constraint exists (ensure it's not empty)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_name = 'reviews_comment_not_empty'
    AND tc.table_name = 'reviews'
    AND tc.table_schema = 'public'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_comment_not_empty 
    CHECK (length(trim(comment)) > 0);
  END IF;
END $$;

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_rating ON reviews(restaurant_id, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_user_restaurant ON reviews(user_id, restaurant_id);

-- Fix any existing restaurants with incorrect counts
DO $$
DECLARE
  restaurant_record RECORD;
  calculated_rating numeric;
  calculated_count integer;
BEGIN
  FOR restaurant_record IN 
    SELECT id FROM restaurants WHERE is_active = true
  LOOP
    -- Calculate correct values
    SELECT 
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
      COUNT(*)::integer
    INTO calculated_rating, calculated_count
    FROM reviews 
    WHERE restaurant_id = restaurant_record.id;

    -- Update if values are different
    UPDATE restaurants 
    SET 
      rating = calculated_rating,
      review_count = calculated_count,
      updated_at = now()
    WHERE id = restaurant_record.id 
    AND (rating != calculated_rating OR review_count != calculated_count);
  END LOOP;
  
  RAISE NOTICE 'Fixed restaurant rating and review counts';
END $$;