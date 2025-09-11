/*
  # Fix Duplicate Like Notifications

  1. Changes
    - Improve the like notification function to better prevent duplicates
    - Add more robust duplicate checking
    - Better error handling and logging

  2. Notes
    - This fixes the issue where users were getting duplicate like notifications
    - The API no longer manually creates notifications since the trigger handles it
*/

-- Update the like notification function with better duplicate prevention
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  video_title text;
  restaurant_name text;
  restaurant_owner_id uuid;
  liker_name text;
  existing_notification_count integer;
BEGIN
  -- Get video, restaurant, and liker information
  SELECT 
    v.title,
    r.name,
    r.owner_id,
    p.name
  INTO video_title, restaurant_name, restaurant_owner_id, liker_name
  FROM videos v
  JOIN restaurants r ON v.restaurant_id = r.id
  JOIN profiles p ON p.id = NEW.user_id
  WHERE v.id = NEW.video_id;
  
  -- Only create notification if:
  -- 1. We found all the required information
  -- 2. The liker is not the restaurant owner (don't notify yourself)
  -- 3. No recent duplicate notification exists
  IF restaurant_owner_id IS NOT NULL AND restaurant_owner_id != NEW.user_id THEN
    -- Check for recent duplicate notifications (more comprehensive check)
    SELECT COUNT(*) INTO existing_notification_count
    FROM notifications 
    WHERE user_id = restaurant_owner_id
    AND type = 'new_like'
    AND data->>'video_id' = NEW.video_id::text
    AND data->>'liker_id' = NEW.user_id::text
    AND created_at > (now() - interval '5 minutes'); -- Increased window to prevent any rapid duplicates
    
    -- Only create if no recent duplicate exists
    IF existing_notification_count = 0 THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        restaurant_owner_id,
        'new_like',
        'Someone liked your video!',
        COALESCE(liker_name, 'Someone') || ' liked your video "' || COALESCE(video_title, 'Untitled') || '" from ' || COALESCE(restaurant_name, 'your restaurant'),
        jsonb_build_object(
          'video_id', NEW.video_id,
          'video_title', video_title,
          'liker_id', NEW.user_id,
          'liker_name', liker_name,
          'restaurant_name', restaurant_name
        )
      );
      
      RAISE NOTICE 'Created like notification for video % liked by %', NEW.video_id, NEW.user_id;
    ELSE
      RAISE NOTICE 'Skipped duplicate like notification for video % (found % existing)', NEW.video_id, existing_notification_count;
    END IF;
  ELSE
    RAISE NOTICE 'Skipped like notification: owner_id=%, liker_id=%', restaurant_owner_id, NEW.user_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the like operation
    RAISE WARNING 'Failed to create like notification for video %: %', NEW.video_id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;