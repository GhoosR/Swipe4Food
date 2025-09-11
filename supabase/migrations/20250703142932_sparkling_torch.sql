/*
  # Add Like Notifications System

  1. Changes
    - Update notification types to include 'new_like'
    - Add function to create like notifications automatically
    - Add trigger to create notifications when someone likes a video

  2. Security
    - Maintain existing RLS policies
    - Ensure notifications are only sent to video owners
    - Don't send notifications if owners like their own videos
*/

-- Update notification type constraint to include 'new_like'
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add new constraint with 'new_like' included
  ALTER TABLE notifications 
  ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('booking_request', 'booking_confirmed', 'booking_cancelled', 'new_comment', 'new_like', 'new_follower'));
END $$;

-- Function to create like notifications
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
    -- Check for recent duplicate notifications (within last minute)
    SELECT COUNT(*) INTO existing_notification_count
    FROM notifications 
    WHERE user_id = restaurant_owner_id
    AND type = 'new_like'
    AND data->>'video_id' = NEW.video_id::text
    AND data->>'liker_id' = NEW.user_id::text
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
      RAISE NOTICE 'Skipped duplicate like notification for video %', NEW.video_id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the like operation
    RAISE WARNING 'Failed to create like notification for video %: %', NEW.video_id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for like notifications
DROP TRIGGER IF EXISTS create_like_notification_trigger ON likes;
CREATE TRIGGER create_like_notification_trigger
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

-- Ensure the likes count trigger is working correctly
CREATE OR REPLACE FUNCTION update_video_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes count
    UPDATE videos 
    SET likes_count = COALESCE(likes_count, 0) + 1, updated_at = now()
    WHERE id = NEW.video_id;
    
    RAISE NOTICE 'Incremented likes count for video %', NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes count (ensure it doesn't go below 0)
    UPDATE videos 
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0), updated_at = now()
    WHERE id = OLD.video_id;
    
    RAISE NOTICE 'Decremented likes count for video %', OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ensure the comments count trigger is working correctly
CREATE OR REPLACE FUNCTION update_video_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment comments count
    UPDATE videos 
    SET comments_count = COALESCE(comments_count, 0) + 1, updated_at = now()
    WHERE id = NEW.video_id;
    
    RAISE NOTICE 'Incremented comments count for video %', NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement comments count (ensure it doesn't go below 0)
    UPDATE videos 
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0), updated_at = now()
    WHERE id = OLD.video_id;
    
    RAISE NOTICE 'Decremented comments count for video %', OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers to ensure they're working with the updated functions
DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;
CREATE TRIGGER update_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes_count();

DROP TRIGGER IF EXISTS update_comments_count_trigger ON comments;
CREATE TRIGGER update_comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_video_comments_count();

-- Fix any existing videos with incorrect counts
DO $$
DECLARE
  video_record RECORD;
  calculated_likes integer;
  calculated_comments integer;
BEGIN
  FOR video_record IN 
    SELECT id FROM videos
  LOOP
    -- Calculate correct likes count
    SELECT COUNT(*) INTO calculated_likes
    FROM likes 
    WHERE video_id = video_record.id;

    -- Calculate correct comments count
    SELECT COUNT(*) INTO calculated_comments
    FROM comments 
    WHERE video_id = video_record.id;

    -- Update video with correct counts
    UPDATE videos 
    SET 
      likes_count = calculated_likes,
      comments_count = calculated_comments,
      updated_at = now()
    WHERE id = video_record.id
    AND (likes_count != calculated_likes OR comments_count != calculated_comments);
    
    RAISE NOTICE 'Fixed video %: likes=%, comments=%', video_record.id, calculated_likes, calculated_comments;
  END LOOP;
  
  RAISE NOTICE 'Completed fixing all video counts';
END $$;