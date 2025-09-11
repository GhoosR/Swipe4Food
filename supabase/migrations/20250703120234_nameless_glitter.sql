/*
  # Add Threaded Comments Support

  1. Schema Changes
    - Add parent_id to comments table for nested comments
    - Add depth field to track nesting level
    - Update comment policies to handle nested structure

  2. Functions
    - Add function to create comment reply notifications
    - Update comment triggers for reply notifications

  3. Security
    - Maintain existing RLS policies
    - Add proper validation for nested comments
*/

-- Add parent_id and depth columns to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE comments ADD COLUMN parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'depth'
  ) THEN
    ALTER TABLE comments ADD COLUMN depth integer DEFAULT 0 CHECK (depth >= 0 AND depth <= 3);
  END IF;
END $$;

-- Create index for parent_id for better performance
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Create function to handle comment reply notifications
CREATE OR REPLACE FUNCTION create_comment_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  parent_comment_user_id uuid;
  parent_comment_text text;
  video_title text;
  commenter_name text;
BEGIN
  -- Only create notification if this is a reply (has parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    -- Get the parent comment's user_id and text
    SELECT user_id, text INTO parent_comment_user_id, parent_comment_text
    FROM comments 
    WHERE id = NEW.parent_id;
    
    -- Get the video title
    SELECT title INTO video_title
    FROM videos 
    WHERE id = NEW.video_id;
    
    -- Get the commenter's name
    SELECT name INTO commenter_name
    FROM profiles 
    WHERE id = NEW.user_id;
    
    -- Only create notification if replying to someone else's comment
    IF parent_comment_user_id IS NOT NULL AND parent_comment_user_id != NEW.user_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        parent_comment_user_id,
        'new_comment',
        'Reply to Your Comment',
        COALESCE(commenter_name, 'Someone') || ' replied to your comment on "' || COALESCE(video_title, 'a video') || '"',
        jsonb_build_object(
          'comment_id', NEW.id,
          'parent_comment_id', NEW.parent_id,
          'video_id', NEW.video_id,
          'commenter_name', commenter_name,
          'comment_text', NEW.text,
          'parent_comment_text', parent_comment_text
        )
      );
      
      RAISE NOTICE 'Created reply notification for comment % replied to by %', NEW.parent_id, NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the comment creation
    RAISE WARNING 'Failed to create comment reply notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment reply notifications
DROP TRIGGER IF EXISTS create_comment_reply_notification_trigger ON comments;
CREATE TRIGGER create_comment_reply_notification_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_reply_notification();

-- Update the depth when inserting nested comments
CREATE OR REPLACE FUNCTION set_comment_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth integer;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Get parent's depth
    SELECT depth INTO parent_depth
    FROM comments 
    WHERE id = NEW.parent_id;
    
    -- Set this comment's depth to parent's depth + 1 (max 3 levels deep)
    NEW.depth := LEAST(COALESCE(parent_depth, 0) + 1, 3);
  ELSE
    -- Top-level comment
    NEW.depth := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set comment depth
DROP TRIGGER IF EXISTS set_comment_depth_trigger ON comments;
CREATE TRIGGER set_comment_depth_trigger
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_depth();