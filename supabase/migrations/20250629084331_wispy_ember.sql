/*
  # Restaurant Management Enhancement

  1. New Indexes
    - Add index on restaurants.owner_id for better query performance
    - Add index on restaurants.is_active for filtering active restaurants

  2. Security
    - Add policy for business users to create restaurants
    - Ensure only business account holders can create restaurants

  3. Automation
    - Add function to automatically create default restaurant when user switches to business
    - Add trigger to execute the function on account type change

  4. Notes
    - Default restaurants start as inactive until details are filled
    - Only creates restaurant if switching from user to business and no restaurant exists
*/

-- Ensure restaurants table has proper constraints and indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Business users can create restaurants" ON restaurants;

-- Add policy for restaurant creation
CREATE POLICY "Business users can create restaurants"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND account_type = 'business'
    )
  );

-- Function to create default restaurant when user switches to business
CREATE OR REPLACE FUNCTION create_default_restaurant_for_business()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create restaurant if switching to business and no restaurant exists
  IF NEW.account_type = 'business' AND OLD.account_type = 'user' THEN
    -- Check if user already has a restaurant
    IF NOT EXISTS (SELECT 1 FROM restaurants WHERE owner_id = NEW.id) THEN
      INSERT INTO restaurants (
        owner_id,
        name,
        cuisine,
        address,
        city,
        country,
        description,
        is_active
      ) VALUES (
        NEW.id,
        COALESCE(NEW.name || '''s Restaurant', 'My Restaurant'),
        'International',
        'Address not set',
        'City not set',
        'Country not set',
        'Welcome to our restaurant! Please update this description.',
        false -- Start as inactive until details are filled
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic restaurant creation
DROP TRIGGER IF EXISTS create_restaurant_on_business_switch ON profiles;
CREATE TRIGGER create_restaurant_on_business_switch
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.account_type = 'business' AND OLD.account_type = 'user')
  EXECUTE FUNCTION create_default_restaurant_for_business();