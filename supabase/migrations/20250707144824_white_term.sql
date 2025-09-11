/*
  # Add Reviews for Target User and Fix Badge Assignment

  1. Changes
    - Safely add reviews for target user without triggering unique constraint errors
    - Properly handle badge assignment through natural trigger execution
    - Update restaurant ratings correctly
    - Remove direct call to trigger function which causes errors
    - Log progress and results clearly

  2. Notes
    - Badges will be automatically assigned by existing triggers
    - No direct call to check_and_award_reviewer_badges() as trigger functions can't be called directly
*/

-- Check if user exists before proceeding
DO $$
DECLARE
  target_user_id uuid := 'ebecf594-3885-4559-a3c4-a86c71a5b23e';
  user_exists boolean;
  current_review_count integer;
  available_restaurant_ids uuid[];
  review_index integer := 0;
  rand_restaurant_id uuid;
  rand_rating integer;
  rand_days integer;
  available_restaurant_count integer;
  max_possible_reviews integer;
  reviews_to_add integer;
  review_comments text[] := ARRAY[
    'Amazing food and atmosphere! Definitely coming back.',
    'The service was excellent and the food was delicious.',
    'Great experience overall. Highly recommended.',
    'The flavors were exceptional. Chef knows what they''re doing.',
    'Beautiful restaurant with excellent menu options.',
    'Impressed with the quality and presentation of food.',
    'Very attentive service and delicious dishes.',
    'Good food but a bit pricey for what you get.',
    'Lovely ambiance and the staff was very friendly.',
    'The food was authentic and reminded me of home.',
    'Perfect place for a special occasion dinner.',
    'Creative menu with unique flavor combinations.',
    'Portion sizes were generous and everything tasted fresh.',
    'The signature dish was absolutely worth trying.',
    'Excellent wine selection to complement the meal.',
    'Clean establishment with a welcoming atmosphere.',
    'The desserts were the highlight of our meal.',
    'Friendly staff who went above and beyond.',
    'Menu had great variety with something for everyone.',
    'Food arrived quickly and was served hot.',
    'Outstanding culinary experience from start to finish.',
    'The presentation of each dish was works of art.',
    'Cozy atmosphere perfect for a romantic dinner.',
    'The chef really knows how to balance flavors.',
    'Exceptional service made our evening special.',
    'Fresh ingredients and creative combinations.',
    'The wine pairing suggestions were spot on.',
    'Great value for the quality of food and service.',
    'The seasonal menu items were particularly impressive.',
    'Will definitely be returning with friends and family.',
    'The attention to detail in every aspect was remarkable.',
    'Perfect execution of classic dishes with modern twists.',
    'The staff was knowledgeable about dietary restrictions.',
    'Beautiful plating and delicious flavors throughout.',
    'An unforgettable dining experience worth every penny.'
  ];
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE 'User with ID % does not exist', target_user_id;
    RETURN;
  END IF;
  
  -- Check current review count
  SELECT COUNT(*) INTO current_review_count FROM reviews WHERE user_id = target_user_id;
  
  -- Only proceed if user doesn't already have 100 reviews
  IF current_review_count >= 100 THEN
    RAISE NOTICE 'User already has % reviews, no need to add more', current_review_count;
    RETURN;
  END IF;
  
  -- Get restaurant IDs that this user hasn't reviewed yet
  SELECT ARRAY(
    SELECT r.id 
    FROM restaurants r 
    WHERE r.is_active = true 
    AND r.id NOT IN (
      SELECT rev.restaurant_id 
      FROM reviews rev 
      WHERE rev.user_id = target_user_id
    )
  ) INTO available_restaurant_ids;
  
  available_restaurant_count := array_length(available_restaurant_ids, 1);
  
  IF available_restaurant_count IS NULL OR available_restaurant_count = 0 THEN
    RAISE NOTICE 'No available restaurants found for user to review';
    RETURN;
  END IF;
  
  -- Calculate how many reviews we can actually add
  max_possible_reviews := current_review_count + available_restaurant_count;
  reviews_to_add := LEAST(100 - current_review_count, available_restaurant_count);
  
  RAISE NOTICE 'User has % reviews, can add % more reviews from % available restaurants', 
    current_review_count, reviews_to_add, available_restaurant_count;
  
  -- Add reviews to reach 100 total (or as many as possible)
  FOR i IN 1..reviews_to_add LOOP
    -- Pick the next available restaurant (no randomization to avoid duplicates)
    rand_restaurant_id := available_restaurant_ids[i];
    
    -- Generate a rating between 3-5 (mostly positive reviews)
    rand_rating := 3 + (i % 3);
    
    -- Random days ago (between 1 and 365 days) for realistic timestamps
    rand_days := 1 + (i % 365);
    
    -- Insert review with staggered timestamps
    INSERT INTO reviews (
      restaurant_id,
      user_id,
      rating,
      comment,
      created_at,
      updated_at
    ) VALUES (
      rand_restaurant_id,
      target_user_id,
      rand_rating,
      review_comments[1 + (i % array_length(review_comments, 1))],
      now() - (rand_days || ' days')::interval,
      now() - (rand_days || ' days')::interval
    );
    
    review_index := review_index + 1;
    
    -- Log progress
    IF review_index % 10 = 0 THEN
      RAISE NOTICE 'Added % reviews', review_index;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Added % reviews for user %. Total reviews: %', 
    review_index, target_user_id, current_review_count + review_index;
  
  -- Note: We're NOT directly calling the badge trigger function anymore
  -- The review INSERT triggers will automatically award badges
  
  -- Update all affected restaurant ratings
  UPDATE restaurants r
  SET 
    rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
      FROM reviews
      WHERE restaurant_id = r.id
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE restaurant_id = r.id
    ),
    updated_at = now()
  WHERE id = ANY(available_restaurant_ids[1:review_index]);
  
  RAISE NOTICE 'Updated ratings for % restaurants', review_index;
  
  -- Final summary
  IF current_review_count + review_index >= 100 THEN
    RAISE NOTICE 'SUCCESS: User now has 100+ reviews and should have the Platinum Reviewer badge!';
  ELSE
    RAISE NOTICE 'PARTIAL: User now has % reviews (maximum possible with available restaurants)', 
      current_review_count + review_index;
  END IF;
END $$;