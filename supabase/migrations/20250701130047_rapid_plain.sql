/*
  # Fix Booking Notification System

  1. Updates
    - Improve booking notification functions to handle customer cancellations
    - Ensure restaurant owners get notified when customers cancel
    - Fix notification message formatting
    - Add better error handling

  2. Security
    - Maintain existing RLS policies
    - Ensure proper notification delivery
*/

-- Update booking status notification function to handle customer cancellations
CREATE OR REPLACE FUNCTION create_booking_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_name text;
  restaurant_owner_id uuid;
  customer_name text;
  existing_notification_count integer;
  notification_title text;
  notification_message text;
  notification_type text;
  target_user_id uuid;
BEGIN
  -- Only create notification if status actually changed
  IF OLD.status != NEW.status THEN
    -- Get restaurant and customer information
    SELECT r.name, r.owner_id, p.name 
    INTO restaurant_name, restaurant_owner_id, customer_name
    FROM restaurants r, profiles p
    WHERE r.id = NEW.restaurant_id AND p.id = NEW.user_id;
    
    -- Determine notification details based on who made the change and what the change was
    IF NEW.status = 'confirmed' THEN
      -- Restaurant confirmed the booking - notify customer
      target_user_id := NEW.user_id;
      notification_type := 'booking_confirmed';
      notification_title := 'Booking Confirmed!';
      notification_message := 'Your booking at ' || COALESCE(restaurant_name, 'the restaurant') || ' has been confirmed';
    ELSIF NEW.status = 'cancelled' THEN
      -- Booking was cancelled - determine who to notify
      -- If restaurant owner cancelled, notify customer
      -- If customer cancelled, notify restaurant owner
      
      -- For now, we'll notify both parties about cancellations
      -- First notify the customer if they didn't cancel it themselves
      target_user_id := NEW.user_id;
      notification_type := 'booking_cancelled';
      notification_title := 'Booking Cancelled';
      notification_message := 'Your booking at ' || COALESCE(restaurant_name, 'the restaurant') || ' has been cancelled';
      
      -- Check for existing notification to avoid duplicates
      SELECT COUNT(*) INTO existing_notification_count
      FROM notifications 
      WHERE data->>'booking_id' = NEW.id::text 
      AND type = notification_type
      AND user_id = target_user_id
      AND created_at > (now() - interval '1 minute');
      
      IF existing_notification_count = 0 THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data
        ) VALUES (
          target_user_id,
          notification_type,
          notification_title,
          notification_message,
          jsonb_build_object(
            'booking_id', NEW.id, 
            'restaurant_name', restaurant_name,
            'status', NEW.status
          )
        );
      END IF;
      
      -- Also notify restaurant owner about customer cancellation
      IF restaurant_owner_id IS NOT NULL AND restaurant_owner_id != NEW.user_id THEN
        target_user_id := restaurant_owner_id;
        notification_title := 'Booking Cancelled by Customer';
        notification_message := COALESCE(customer_name, 'A customer') || ' cancelled their booking for ' || NEW.booking_date || ' at ' || NEW.booking_time;
        
        -- Check for existing notification
        SELECT COUNT(*) INTO existing_notification_count
        FROM notifications 
        WHERE data->>'booking_id' = NEW.id::text 
        AND type = notification_type
        AND user_id = target_user_id
        AND created_at > (now() - interval '1 minute');
        
        IF existing_notification_count = 0 THEN
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            data
          ) VALUES (
            target_user_id,
            notification_type,
            notification_title,
            notification_message,
            jsonb_build_object(
              'booking_id', NEW.id, 
              'restaurant_name', restaurant_name,
              'customer_name', customer_name,
              'status', NEW.status
            )
          );
        END IF;
      END IF;
      
      -- Return early since we handled cancellation notifications above
      RETURN NEW;
    ELSE
      -- Other status changes - notify customer
      target_user_id := NEW.user_id;
      notification_type := 'booking_request';
      notification_title := 'Booking Updated';
      notification_message := 'Your booking at ' || COALESCE(restaurant_name, 'the restaurant') || ' has been updated to ' || NEW.status;
    END IF;
    
    -- Check for existing status notification (for non-cancellation cases)
    SELECT COUNT(*) INTO existing_notification_count
    FROM notifications 
    WHERE data->>'booking_id' = NEW.id::text 
    AND type = notification_type
    AND user_id = target_user_id
    AND created_at > (now() - interval '1 minute');
    
    -- Only create if no recent duplicate exists
    IF existing_notification_count = 0 THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        target_user_id,
        notification_type,
        notification_title,
        notification_message,
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