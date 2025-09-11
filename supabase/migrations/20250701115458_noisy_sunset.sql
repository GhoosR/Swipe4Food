/*
  # Fix Restaurant Rating and Review Count Synchronization

  1. Database Fixes
    - Improve the update_restaurant_rating() function with better error handling
    - Ensure triggers fire correctly on all review operations
    - Fix any existing incorrect counts in the database
    - Add proper validation and logging

  2. Performance
    - Optimize rating calculation queries
    - Add better indexing for performance

  3. Data Integrity
    - Recalculate all existing restaurant ratings and counts
    - Ensure consistency between reviews table and restaurants table
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

    -- Log successful update for debugging
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

-- Drop existing triggers and recreate them
DROP TRIGGER IF EXISTS update_restaurant_rating_on_insert ON reviews;
DROP TRIGGER IF EXISTS update_restaurant_rating_on_update ON reviews;
DROP TRIGGER IF EXISTS update_restaurant_rating_on_delete ON reviews;

-- Create triggers with proper naming and configuration
CREATE TRIGGER update_restaurant_rating_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

CREATE TRIGGER update_restaurant_rating_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

CREATE TRIGGER update_restaurant_rating_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

-- Fix any existing restaurants with incorrect counts
DO $$
DECLARE
  restaurant_record RECORD;
  calculated_rating numeric;
  calculated_count integer;
BEGIN
  -- Process all restaurants
  FOR restaurant_record IN 
    SELECT id FROM restaurants
  LOOP
    -- Calculate correct values for this restaurant
    SELECT 
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
      COUNT(*)::integer
    INTO calculated_rating, calculated_count
    FROM reviews 
    WHERE restaurant_id = restaurant_record.id;

    -- Update restaurant with correct values
    UPDATE restaurants 
    SET 
      rating = calculated_rating,
      review_count = calculated_count,
      updated_at = now()
    WHERE id = restaurant_record.id;
    
    -- Log the update
    RAISE NOTICE 'Fixed restaurant %: rating=%, count=%', restaurant_record.id, calculated_rating, calculated_count;
  END LOOP;
  
  RAISE NOTICE 'Completed fixing all restaurant ratings and review counts';
END $$;

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_rating ON reviews(restaurant_id, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_user_restaurant ON reviews(user_id, restaurant_id);

-- Ensure proper constraints exist
DO $$
BEGIN
  -- Check if rating constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
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
    WHERE tc.constraint_name = 'reviews_comment_not_empty'
    AND tc.table_name = 'reviews'
    AND tc.table_schema = 'public'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_comment_not_empty 
    CHECK (length(trim(comment)) > 0);
  END IF;
END $$;