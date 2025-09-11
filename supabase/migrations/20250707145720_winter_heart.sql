/*
  # Create Booking Required Review System

  1. Changes
    - Update review policies to check for confirmed booking
    - Add function to verify if a user has a confirmed booking for a restaurant
    - Ensure data integrity for reviews

  2. Security
    - Reviews are only allowed from users who have visited the restaurant
    - Maintain existing RLS policies
*/

-- Create a function to check if a user has a confirmed booking
CREATE OR REPLACE FUNCTION user_has_confirmed_booking(p_user_id uuid, p_restaurant_id uuid)
RETURNS boolean AS $$
DECLARE
  has_booking boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM bookings
    WHERE restaurant_id = p_restaurant_id
    AND user_id = p_user_id
    AND status IN ('confirmed', 'completed')
  ) INTO has_booking;
  
  RETURN has_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update review creation policy
DROP POLICY IF EXISTS "Users can create reviews for restaurants they don't own" ON reviews;
CREATE POLICY "Users can create reviews for restaurants they don't own"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    restaurant_id NOT IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    ) AND
    user_has_confirmed_booking(auth.uid(), restaurant_id)
  );

-- Add a comment explaining the change
COMMENT ON POLICY "Users can create reviews for restaurants they don't own" ON reviews IS 
  'Users can only review restaurants they have visited with a confirmed booking, and cannot review their own restaurants';

-- Add a trigger to check for confirmed bookings on review creation
CREATE OR REPLACE FUNCTION check_confirmed_booking_before_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT user_has_confirmed_booking(NEW.user_id, NEW.restaurant_id) THEN
    RAISE EXCEPTION 'You can only review restaurants after visiting with a confirmed booking';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS check_booking_before_review ON reviews;
CREATE TRIGGER check_booking_before_review
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_confirmed_booking_before_review();