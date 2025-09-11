/*
  # Fix Video Likes and Comments Count System

  1. Functions
    - Update video likes count trigger function with proper error handling
    - Update video comments count trigger function with proper error handling
    - Ensure counts are properly maintained and never go below zero

  2. Triggers
    - Recreate triggers to ensure they work correctly
    - Handle both INSERT and DELETE operations properly

  3. Data Integrity
    - Recalculate all existing video counts to fix any inconsistencies
    - Ensure database integrity after the fixes
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;
DROP TRIGGER IF EXISTS update_comments_count_trigger ON comments;

-- Create improved likes count update function
CREATE OR REPLACE FUNCTION update_video_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes count
    UPDATE videos 
    SET 
      likes_count = COALESCE(likes_count, 0) + 1, 
      updated_at = now()
    WHERE id = NEW.video_id;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes count (ensure it doesn't go below 0)
    UPDATE videos 
    SET 
      likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0), 
      updated_at = now()
    WHERE id = OLD.video_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved comments count update function
CREATE OR REPLACE FUNCTION update_video_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment comments count
    UPDATE videos 
    SET 
      comments_count = COALESCE(comments_count, 0) + 1, 
      updated_at = now()
    WHERE id = NEW.video_id;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement comments count (ensure it doesn't go below 0)
    UPDATE videos 
    SET 
      comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0), 
      updated_at = now()
    WHERE id = OLD.video_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER update_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes_count();

CREATE TRIGGER update_comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_video_comments_count();

-- Recalculate all video counts to ensure accuracy
UPDATE videos 
SET 
  likes_count = (
    SELECT COUNT(*) 
    FROM likes 
    WHERE video_id = videos.id
  ),
  comments_count = (
    SELECT COUNT(*) 
    FROM comments 
    WHERE video_id = videos.id
  ),
  updated_at = now()
WHERE id IN (SELECT DISTINCT id FROM videos);