/*
  # Add Restaurant Favorites System

  1. New Tables
    - `favorites` - User-restaurant favorites relationship
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on favorites table
    - Users can read, create and delete their own favorites
    - Users can see how many people favorited a restaurant

  3. Indexes
    - Add indexes for better performance queries
*/

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_restaurant_id ON favorites(restaurant_id);

-- Create function to check if a restaurant is favorited by a user
CREATE OR REPLACE FUNCTION is_restaurant_favorited(p_user_id uuid, p_restaurant_id uuid)
RETURNS boolean AS $$
DECLARE
  is_favorited boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM favorites
    WHERE restaurant_id = p_restaurant_id
    AND user_id = p_user_id
  ) INTO is_favorited;
  
  RETURN is_favorited;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get favorite count for a restaurant
CREATE OR REPLACE FUNCTION get_restaurant_favorites_count(p_restaurant_id uuid)
RETURNS integer AS $$
DECLARE
  favorites_count integer;
BEGIN
  SELECT COUNT(*) INTO favorites_count
  FROM favorites
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN favorites_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;