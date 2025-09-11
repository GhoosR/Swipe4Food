/*
  # Add Menu Items System

  1. New Tables
    - `menu_items` - Restaurant menu items with prices, descriptions, and categories
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `name` (text, required - dish name)
      - `description` (text, optional - dish description)
      - `price` (decimal, required - dish price)
      - `category` (text, required - menu category like "Appetizers", "Main Courses")
      - `image_url` (text, optional - dish photo)
      - `is_available` (boolean, default true - whether item is currently available)
      - `sort_order` (integer, default 0 - for custom ordering within categories)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on menu_items table
    - Anyone can read menu items for active restaurants
    - Only restaurant owners can manage their menu items

  3. Performance
    - Add indexes for efficient querying by restaurant and category
*/

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price decimal NOT NULL CHECK (price >= 0),
  category text NOT NULL,
  image_url text,
  is_available boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read available menu items from active restaurants"
  ON menu_items FOR SELECT
  TO authenticated
  USING (
    is_available = true AND 
    restaurant_id IN (
      SELECT id FROM restaurants WHERE is_active = true
    )
  );

CREATE POLICY "Restaurant owners can manage their menu items"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(restaurant_id, category);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON menu_items(restaurant_id, category, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(restaurant_id, is_available);

-- Create updated_at trigger
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample menu categories as a reference
-- (This is just for documentation - actual categories will be created by restaurants)
COMMENT ON COLUMN menu_items.category IS 'Menu category examples: Appetizers, Soups, Salads, Main Courses, Pasta, Pizza, Desserts, Beverages, etc.';