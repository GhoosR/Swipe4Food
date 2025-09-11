/*
  # Fix Notification RLS Policies for Booking System

  1. Security Changes
    - Update notification policies to allow system-generated notifications
    - Allow authenticated users to create notifications for other users (for booking notifications)
    - Maintain read/update restrictions to own notifications only

  2. Notes
    - This fixes the RLS violation when creating booking notifications
    - Restaurant owners will receive notifications when bookings are made
    - Users will receive notifications when booking status changes
*/

-- Drop existing notification policies
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Create new policies that allow system notifications
CREATE POLICY "Users can read their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to create notifications (for booking system)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure the booking creation function works properly
-- Update the createBooking function to handle notifications correctly
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_owner_id uuid;
  restaurant_name text;
BEGIN
  -- Get restaurant owner and name
  SELECT owner_id, name INTO restaurant_owner_id, restaurant_name
  FROM restaurants 
  WHERE id = NEW.restaurant_id;
  
  -- Create notification for restaurant owner
  IF restaurant_owner_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      restaurant_owner_id,
      'booking_request',
      'New Booking Request',
      'New booking request for ' || NEW.booking_date || ' at ' || NEW.booking_time,
      jsonb_build_object('booking_id', NEW.id, 'restaurant_name', restaurant_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking notifications
DROP TRIGGER IF EXISTS create_booking_notification_trigger ON bookings;
CREATE TRIGGER create_booking_notification_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_booking_notification();

-- Create function for booking status change notifications
CREATE OR REPLACE FUNCTION create_booking_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_name text;
BEGIN
  -- Only create notification if status actually changed
  IF OLD.status != NEW.status THEN
    -- Get restaurant name
    SELECT name INTO restaurant_name
    FROM restaurants 
    WHERE id = NEW.restaurant_id;
    
    -- Create notification for user
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'confirmed' THEN 'booking_confirmed'
        WHEN NEW.status = 'cancelled' THEN 'booking_cancelled'
        ELSE 'booking_request'
      END,
      CASE 
        WHEN NEW.status = 'confirmed' THEN 'Booking Confirmed!'
        WHEN NEW.status = 'cancelled' THEN 'Booking Cancelled'
        ELSE 'Booking Updated'
      END,
      'Your booking at ' || COALESCE(restaurant_name, 'the restaurant') || ' has been ' || NEW.status,
      jsonb_build_object('booking_id', NEW.id, 'restaurant_name', restaurant_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking status change notifications
DROP TRIGGER IF EXISTS create_booking_status_notification_trigger ON bookings;
CREATE TRIGGER create_booking_status_notification_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_booking_status_notification();