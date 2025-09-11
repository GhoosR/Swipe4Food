/*
  # Fix Duplicate Booking Notifications

  1. Changes
    - Update booking notification function to prevent duplicates
    - Add better error handling and logging
    - Ensure notifications are only created once per booking

  2. Security
    - Maintain existing RLS policies
    - Add proper validation
*/

-- Drop existing function and recreate with duplicate prevention
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_owner_id uuid;
  restaurant_name text;
  existing_notification_count integer;
BEGIN
  -- Get restaurant owner and name
  SELECT owner_id, name INTO restaurant_owner_id, restaurant_name
  FROM restaurants 
  WHERE id = NEW.restaurant_id;
  
  -- Check if notification already exists for this booking
  SELECT COUNT(*) INTO existing_notification_count
  FROM notifications 
  WHERE data->>'booking_id' = NEW.id::text 
  AND type = 'booking_request';
  
  -- Only create notification if restaurant owner exists and no duplicate exists
  IF restaurant_owner_id IS NOT NULL AND existing_notification_count = 0 THEN
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
      jsonb_build_object(
        'booking_id', NEW.id, 
        'restaurant_name', restaurant_name,
        'customer_name', (SELECT name FROM profiles WHERE id = NEW.user_id),
        'guests', NEW.guests
      )
    );
    
    RAISE NOTICE 'Created booking notification for booking %', NEW.id;
  ELSE
    RAISE NOTICE 'Skipped duplicate notification for booking %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the booking creation
    RAISE WARNING 'Failed to create booking notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update booking status notification function with duplicate prevention
CREATE OR REPLACE FUNCTION create_booking_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_name text;
  existing_notification_count integer;
BEGIN
  -- Only create notification if status actually changed
  IF OLD.status != NEW.status THEN
    -- Get restaurant name
    SELECT name INTO restaurant_name
    FROM restaurants 
    WHERE id = NEW.restaurant_id;
    
    -- Check for existing status notification
    SELECT COUNT(*) INTO existing_notification_count
    FROM notifications 
    WHERE data->>'booking_id' = NEW.id::text 
    AND type = CASE 
      WHEN NEW.status = 'confirmed' THEN 'booking_confirmed'
      WHEN NEW.status = 'cancelled' THEN 'booking_cancelled'
      ELSE 'booking_request'
    END
    AND created_at > (now() - interval '1 minute'); -- Only check recent notifications
    
    -- Only create if no recent duplicate exists
    IF existing_notification_count = 0 THEN
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
        jsonb_build_object(
          'booking_id', NEW.id, 
          'restaurant_name', restaurant_name,
          'status', NEW.status
        )
      );
      
      RAISE NOTICE 'Created status notification for booking % with status %', NEW.id, NEW.status;
    ELSE
      RAISE NOTICE 'Skipped duplicate status notification for booking %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the booking update
    RAISE WARNING 'Failed to create status notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;