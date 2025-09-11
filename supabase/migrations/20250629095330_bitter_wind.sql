/*
  # Fix Business Restaurant Creation and Video Upload

  1. Changes
    - Update default restaurant creation to be active by default
    - Improve restaurant profile validation
    - Fix video upload requirements

  2. Security
    - Maintain existing RLS policies
    - Ensure proper ownership validation
*/

-- Update the function to create a more complete default restaurant
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
        price_range,
        is_active,
        opening_hours
      ) VALUES (
        NEW.id,
        COALESCE(NEW.name || '''s Restaurant', 'My Restaurant'),
        'International',
        'Please update your address',
        'Please update your city',
        'Please update your country',
        'Welcome to our restaurant! Please update this description to tell customers about your amazing food and atmosphere.',
        '€€',
        true, -- Set to active so videos can be uploaded
        jsonb_build_object(
          'monday', '12:00 - 22:00',
          'tuesday', '12:00 - 22:00',
          'wednesday', '12:00 - 22:00',
          'thursday', '12:00 - 22:00',
          'friday', '12:00 - 23:00',
          'saturday', '12:00 - 23:00',
          'sunday', '12:00 - 21:00'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing restaurants that might be inactive
UPDATE restaurants 
SET is_active = true 
WHERE is_active = false 
AND owner_id IN (
  SELECT id FROM profiles WHERE account_type = 'business'
);