/*
  # Add Views Count Trigger for Video Analytics

  1. Functions
    - Create function to update video views count when analytics events are tracked
    - Only increment for 'view' events to avoid duplicate counting

  2. Triggers
    - Add trigger to automatically update views_count when view analytics are recorded
    - Ensure views are counted accurately

  3. Data Integrity
    - Recalculate existing view counts from analytics data
    - Ensure consistency between analytics and video counts
*/

-- Create function to update video views count from analytics
CREATE OR REPLACE FUNCTION update_video_views_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment views for 'view' events
  IF NEW.event_type = 'view' THEN
    UPDATE videos 
    SET 
      views_count = COALESCE(views_count, 0) + 1,
      updated_at = now()
    WHERE id = NEW.video_id;
    
    RAISE NOTICE 'Incremented views count for video %', NEW.video_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for view count updates
DROP TRIGGER IF EXISTS update_views_count_trigger ON video_analytics;
CREATE TRIGGER update_views_count_trigger
  AFTER INSERT ON video_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_video_views_count();

-- Recalculate existing view counts from analytics data
UPDATE videos 
SET 
  views_count = (
    SELECT COUNT(*) 
    FROM video_analytics 
    WHERE video_id = videos.id AND event_type = 'view'
  ),
  updated_at = now()
WHERE id IN (SELECT DISTINCT video_id FROM video_analytics WHERE event_type = 'view');

-- Ensure all videos have a views_count (set to 0 if null)
UPDATE videos 
SET views_count = 0 
WHERE views_count IS NULL;