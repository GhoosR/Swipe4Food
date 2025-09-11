import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, User, Store, Calendar, Star, MapPin } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  account_type: 'user' | 'business';
  created_at: string;
}

interface UserRestaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  review_count: number;
  image_url?: string;
  city: string;
  country: string;
}

interface UserReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  restaurants: {
    id: string;
    name: string;
    cuisine: string;
    image_url?: string;
    city: string;
    country: string;
  };
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  
  console.log('UserProfileScreen - id:', id); // Debug log
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restaurant, setRestaurant] = useState<UserRestaurant | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      console.log('Loading user profile for ID:', id); // Debug log
      loadUserProfile();
    }
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserProfile();
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadUserProfile = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching profile for user ID:', id); // Debug log

      // Get user profile
      const userProfile = await api.getUserProfile(id);
      console.log('Received user profile:', userProfile); // Debug log
      
      if (!userProfile) {
        console.log('User profile not found for ID:', id);
        setError('User profile not found');
        return;
      }
      
      setProfile(userProfile);

      // If user is a business owner, get their restaurant
      if (userProfile.account_type === 'business') {
        const userRestaurant = await api.getRestaurantByOwnerId(id);
        console.log('Received user restaurant:', userRestaurant); // Debug log
        setRestaurant(userRestaurant);
      }

      // Get user's reviews (for all users)
      const userReviews = await api.getUserReviews(id);
      console.log('Received user reviews:', userReviews); // Debug log
      setReviews(userReviews || []);
      
      // Get total review count (may be more than we display)
      const count = await api.getUserReviewCount(id);
      setReviewCount(count || 0);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setError('Failed to load user profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleRestaurantPress = () => {
    if (restaurant) {
      router.push(`/restaurant/${restaurant.id}`);
    }
  };

  const handleReviewRestaurantPress = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={14}
        color="#f9c435"
        fill={index < Math.floor(rating) ? '#f9c435' : 'transparent'}
      />
    ));
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const formatReviewDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f29056" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{error || 'User not found'}</Text>
          <Text style={styles.errorText}>
            {error === 'User profile not found' 
              ? "The user profile you're looking for doesn't exist or has been removed."
              : "There was an error loading the profile. Please check your connection and try again."
            }
          </Text>
          <TouchableOpacity style={styles.backToHomeButton} onPress={handleBack}>
            <Text style={styles.backToHomeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#2D3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'Your Profile' : 'Profile'}
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#f29056']}
            tintColor='#f29056'
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={40} color="#4A5568" />
              </View>
            )}
          </View>
          
          <Text style={styles.name}>{profile.name}</Text>
          
          <View style={styles.accountTypeBadge}>
            {profile.account_type === 'business' ? (
              <Store size={16} color="white" />
            ) : (
              <User size={16} color="white" />
            )}
            <Text style={styles.accountTypeText}>
              {profile.account_type === 'business' ? 'Restaurant Owner' : 'Food Lover'}
            </Text>
          </View>
          
          <Text style={styles.joinDate}>
            Joined {formatJoinDate(profile.created_at)}
          </Text>
        </View>

        {/* Restaurant Section for Business Users */}
        {profile.account_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            
            {restaurant ? (
              <TouchableOpacity 
                style={styles.restaurantCard}
                onPress={handleRestaurantPress}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ 
                    uri: restaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
                  }} 
                  style={styles.restaurantImage} 
                />
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantCuisine}>{restaurant.cuisine}</Text>
                  
                  <View style={styles.restaurantMeta}>
                    <View style={styles.ratingContainer}>
                      {renderStars(restaurant.rating)}
                      <Text style={styles.rating}>
                        {restaurant.rating.toFixed(1)} ({restaurant.review_count} reviews)
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.locationContainer}>
                    <MapPin size={14} color="#4A5568" />
                    <Text style={styles.location}>
                      {restaurant.city}, {restaurant.country}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.noRestaurantContainer}>
                <Store size={48} color="#D1D5DB" />
                <Text style={styles.noRestaurantTitle}>No restaurant yet</Text>
                <Text style={styles.noRestaurantText}>
                  This restaurant owner hasn't set up their restaurant profile yet.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutItem}>
              <Star size={20} color="#4A5568" />
              <Text style={styles.aboutText}>
                {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'} written
              </Text>
            </View>
            
            <View style={styles.aboutItem}>
              <Calendar size={20} color="#4A5568" />
              <Text style={styles.aboutText}>
                Member since {formatJoinDate(profile.created_at)}
              </Text>
            </View>
            
            <View style={styles.aboutItem}>
              {profile.account_type === 'business' ? (
                <Store size={20} color="#4A5568" />
              ) : (
                <User size={20} color="#4A5568" />
              )}
              <Text style={styles.aboutText}>
                {profile.account_type === 'business' 
                  ? 'Restaurant owner sharing delicious food experiences'
                  : 'Food enthusiast exploring amazing restaurants'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Reviews ({reviews.length})
            </Text>
            
            {reviews.slice(0, 3).map((review) => (
              <TouchableOpacity
                key={review.id}
                style={styles.reviewCard}
                onPress={() => handleReviewRestaurantPress(review.restaurants.id)}
                activeOpacity={0.7}
              >
                <View style={styles.reviewHeader}>
                  <Image 
                    source={{ 
                      uri: review.restaurants.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
                    }} 
                    style={styles.reviewRestaurantImage} 
                  />
                  <View style={styles.reviewRestaurantInfo}>
                    <Text style={styles.reviewRestaurantName}>
                      {review.restaurants.name}
                    </Text>
                    <Text style={styles.reviewRestaurantLocation}>
                      {review.restaurants.city}, {review.restaurants.country}
                    </Text>
                  </View>
                  <View style={styles.reviewRatingContainer}>
                    <View style={styles.reviewStars}>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewDate}>
                      {formatReviewDate(review.created_at)}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.reviewComment} numberOfLines={3}>
                  {review.comment}
                </Text>
              </TouchableOpacity>
            ))}
            
            {reviews.length > 3 && (
              <View style={styles.moreReviewsContainer}>
                <Text style={styles.moreReviewsText}>
                  and {reviews.length - 3} more {reviews.length - 3 === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            )}
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.ownProfileNotice}>
            <Text style={styles.ownProfileText}>
              This is how your profile appears to other users. You can edit your profile in the Profile tab.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backToHomeButton: {
    backgroundColor: '#f29056',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backToHomeText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  profileHeader: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  accountTypeText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  joinDate: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 16,
  },
  restaurantCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  restaurantName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 8,
  },
  restaurantMeta: {
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  noRestaurantContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noRestaurantTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  noRestaurantText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  aboutCard: {
    gap: 16,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  aboutText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
    lineHeight: 20,
  },
  ownProfileNotice: {
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
  },
  ownProfileText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#f29056',
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewRestaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  reviewRestaurantInfo: {
    flex: 1,
  },
  reviewRestaurantName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  reviewRestaurantLocation: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  reviewRatingContainer: {
    alignItems: 'flex-end',
  },
  reviewStars: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
  },
  moreReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  moreReviewsText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});