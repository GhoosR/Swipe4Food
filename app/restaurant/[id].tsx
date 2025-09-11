import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  FlatList,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Star, Clock, Phone, Globe, Calendar, Play, Heart, MessageCircle, Settings, Share, X, BookmarkCheck } from 'lucide-react-native';
import NotificationBell from '@/components/NotificationBell';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { api } from '@/services/supabaseApi';
import { locationService } from '@/services/locationService';
import BookingModal from '@/components/BookingModal';
import ReviewModal from '@/components/ReviewModal';
import MenuDisplay from '@/components/MenuDisplay';
import RestaurantBadges from '@/components/RestaurantBadges';
import { useLanguage } from '@/contexts/LanguageContext';
import { Linking, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export default function RestaurantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? String(params.id) : null;
  const [restaurant, setRestaurant] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [toggleFavoriteLoading, setToggleFavoriteLoading] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showOpeningHours, setShowOpeningHours] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'reviews' | 'menu'>('videos');
  const [restaurantBadges, setRestaurantBadges] = useState<any[]>([]);
  const { user } = useAuth();
  const { userLocation } = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (id) {
      loadRestaurant();
      checkFavoritedStatus();
      loadReviews();
      loadFavoritesCount();
    }
  }, [id]);

  // Auto-refresh when screen comes into focus (e.g., returning from edit screen)
  useFocusEffect(
    React.useCallback(() => {
      if (id && !loading) {
        loadRestaurant();
        loadReviews();
      }
    }, [id, loading])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadRestaurant(),
        loadReviews(),
        checkFavoritedStatus(),
        loadFavoritesCount()
      ]);
    } catch (error) {
      console.error('Failed to refresh restaurant data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadRestaurant = async () => {
    if (!id) return;
    
    try {
      const data = await api.getRestaurant(id);
      setRestaurant(data);
      
      // Load restaurant badges
      const badges = await api.getRestaurantBadges(id);
      setRestaurantBadges(badges);
    } catch (error) {
      console.error('Failed to load restaurant:', error);
      Alert.alert('Error', 'Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!id) return;
    
    try {
      const data = await api.getReviews(id);
      setReviews(data);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const checkFavoritedStatus = async () => {
    if (!id || !user) return;
    
    try {
      const status = await api.isRestaurantFavorited(id);
      setIsFavorited(status);
    } catch (error) {
      console.error('Failed to check favorited status:', error);
    }
  };
  
  const loadFavoritesCount = async () => {
    if (!id) return;
    
    try {
      const count = await api.getRestaurantFavoritesCount(id);
      setFavoritesCount(count);
    } catch (error) {
      console.error('Failed to load favorites count:', error);
    }
  };
  
  const handleToggleFavorite = async () => {
    if (!id || !user || toggleFavoriteLoading) return;
    
    setToggleFavoriteLoading(true);
    
    try {
      const newStatus = await api.toggleFavoriteRestaurant(id);
      setIsFavorited(newStatus);
      
      // Update favorites count
      await loadFavoritesCount();
    } catch (error) {
      console.error('Failed to toggle favorite status:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setToggleFavoriteLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleShare = () => {
    // Implement share functionality
    Alert.alert('Share', 'Share functionality would be implemented here');
  };

  const handleAddressPress = async () => {
    if (!restaurant) {
      Alert.alert('Error', 'Restaurant information not available');
      return;
    }

    // Construct the full address
    const fullAddress = `${restaurant.address || ''}, ${restaurant.city}, ${restaurant.country}`.trim();
    
    try {
      let mapsUrl = '';
      
      if (Platform.OS === 'ios') {
        // Use Apple Maps on iOS
        if (userLocation && restaurant.latitude && restaurant.longitude) {
          // Use coordinates if available (more accurate)
          mapsUrl = `http://maps.apple.com/?saddr=${userLocation.latitude},${userLocation.longitude}&daddr=${restaurant.latitude},${restaurant.longitude}&dirflg=d`;
        } else {
          // Fallback to address
          const encodedAddress = encodeURIComponent(fullAddress);
          mapsUrl = `http://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;
        }
      } else {
        // Use Google Maps on Android and Web
        if (userLocation && restaurant.latitude && restaurant.longitude) {
          // Use coordinates if available
          mapsUrl = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${restaurant.latitude},${restaurant.longitude}`;
        } else {
          // Fallback to address
          const encodedAddress = encodeURIComponent(fullAddress);
          if (userLocation) {
            mapsUrl = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${encodedAddress}`;
          } else {
            mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
          }
        }
      }

      const canOpen = await Linking.canOpenURL(mapsUrl);
      if (canOpen) {
        await Linking.openURL(mapsUrl);
      } else {
        Alert.alert('Error', 'Unable to open maps. Please check if you have a maps app installed.');
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'Failed to open directions. Please try again.');
    }
  };
  const isOwner = user && restaurant && user.id === restaurant.owner_id;

  const formatOpeningHours = (hours: any) => {
    if (!hours || typeof hours !== 'object') return {};
    
    const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = {
      monday: 'Monday',
      tuesday: 'Tuesday', 
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    };
    
    return daysOrder.reduce((acc, day) => {
      if (hours[day]) {
        acc[dayNames[day as keyof typeof dayNames]] = hours[day];
      }
      return acc;
    }, {} as Record<string, string>);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={16}
        color="#f9c435"
        fill={index < Math.floor(rating) ? '#f9c435' : 'transparent'}
      />
    ));
  };

  const renderVideo = ({ item, index }: any) => (
    <TouchableOpacity 
      style={styles.videoCard}
      onPress={() => router.push(`/video/${item.id}`)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ 
          uri: item.thumbnail_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
        }} 
        style={styles.videoThumbnail} 
      />
      <View style={styles.playButton}>
        <Play size={16} color="white" fill="white" />
      </View>
    </TouchableOpacity>
  );

  const renderReview = ({ item }: any) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Image 
          source={{ 
            uri: item.profiles?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg' 
          }} 
          style={styles.reviewAvatar} 
        />
        <View style={styles.reviewInfo}>
          <Text style={styles.reviewerName}>{item.profiles?.name || 'Anonymous'}</Text>
          <View style={styles.reviewRating}>
            {renderStars(item.rating)}
            <Text style={styles.reviewDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.reviewText}>{item.comment}</Text>
      {item.images && item.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewImages}>
          {item.images.map((imageUri: string, index: number) => (
            <Image key={index} source={{ uri: imageUri }} style={styles.reviewImage} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading restaurant...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {!id ? 'Invalid restaurant ID' : 'Restaurant not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        {/* Header */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ 
              uri: restaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
            }} 
            style={styles.restaurantImage} 
          />
          
          <View style={styles.headerOverlay}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            
            <NotificationBell color="white" />
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleToggleFavorite}
                disabled={toggleFavoriteLoading}
              >
                {isFavorited ? (
                  <BookmarkCheck size={20} color="#f29056" fill="#f29056" />
                ) : (
                  <BookmarkCheck size={20} color="white" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Share size={20} color="white" />
              </TouchableOpacity>
              
              {isOwner && (
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => router.push(`/restaurant/edit/${restaurant.id}`)}
                >
                  <Settings size={20} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Restaurant Info */}
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.cuisineType}>{restaurant.cuisine} • {restaurant.price_range}</Text>
          
          <View style={styles.metaInfo}>
            <View style={styles.ratingContainer}>
              {renderStars(restaurant.rating || 0)}
              <Text style={styles.rating}>
                {(restaurant.rating || 0).toFixed(1)} 
                <Text style={styles.reviewCount}>
                  ({(restaurant.review_count || reviews.length || 0)} reviews)
                </Text>
              </Text>
              {favoritesCount > 0 && (
                <View style={styles.favoritesContainer}>
                  <BookmarkCheck size={16} color="#f29056" />
                  <Text style={styles.favoritesCount}>
                    {favoritesCount}
                  </Text>
                </View>
              ) || null}
            </View>
          </View>

          <TouchableOpacity style={styles.locationContainer} onPress={handleAddressPress} activeOpacity={0.7}>
            <MapPin size={16} color="#4A5568" />
            <Text style={[styles.location, styles.clickableAddress]}>
              {restaurant.address}, {restaurant.city}, {restaurant.country}
            </Text>
            {userLocation && restaurant.latitude && restaurant.longitude && (
              <Text style={styles.distance}>
                {' • ' + locationService.formatDistance(
                  locationService.calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    restaurant.latitude,
                    restaurant.longitude
                  )
                )}
              </Text>
            )}
          </TouchableOpacity>

          {/* Restaurant Badges */}
          {restaurantBadges.length > 0 && (
            <View style={styles.badgesContainer}>
              <RestaurantBadges 
                badges={restaurantBadges.map(b => ({
                  id: b.id,
                  name: b.badge_definitions.name,
                  icon: b.badge_definitions.icon,
                  color: b.badge_definitions.color,
                  description: b.badge_definitions.description,
                }))}
                layout="horizontal"
                size="medium"
              />
            </View>
          )}

          {restaurant.description && (
            <Text style={styles.description}>{restaurant.description}</Text>
          )}

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            {restaurant.phone && (
              <View style={styles.contactItem}>
                <Phone size={16} color="#4A5568" />
                <Text style={styles.contactText}>{restaurant.phone}</Text>
              </View>
            )}
            
            {restaurant.website && (
              <View style={styles.contactItem}>
                <Globe size={16} color="#4A5568" />
                <Text style={styles.contactText}>{restaurant.website}</Text>
              </View>
            )}
            
            {restaurant.opening_hours && (
              <View style={styles.contactItem}>
                <Clock size={16} color="#4A5568" />
                <TouchableOpacity onPress={() => setShowOpeningHours(true)}>
                  <Text style={[styles.contactText, styles.linkText]}>{t('restaurant.seeOpeningHours')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {!isOwner && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.bookButton}
                onPress={() => setShowBooking(true)}
              >
                <Calendar size={20} color="white" />
                <Text style={styles.bookButtonText}>{t('restaurant.book')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.reviewButton}
                onPress={() => setShowReviewModal(true)}
              >
                <Star size={20} color="#f29056" />
                <Text style={styles.reviewButtonText}>{t('restaurant.review')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Business Owner Actions */}
          {isOwner && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.bookButton}
                onPress={() => router.push('/(tabs)/bookings')}
              >
                <Calendar size={20} color="white" />
                <Text style={styles.bookButtonText}>Manage Bookings</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
            onPress={() => setActiveTab('videos')}
          >
            <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>
              Videos ({restaurant.videos?.length || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
            onPress={() => setActiveTab('menu')}
          >
            <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>
              Menu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
              Reviews ({reviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'videos' && (
          <View style={styles.videosContainer}>
            {restaurant.videos && restaurant.videos.length > 0 ? (
              <FlatList
                data={restaurant.videos}
                renderItem={renderVideo}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.videoRow}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Play size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{t('restaurant.noVideos')}</Text>
                <Text style={styles.emptySubtitle}>
                  {isOwner 
                    ? t('restaurant.noVideosOwner')
                    : t('restaurant.noVideosUser')
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'menu' && (
          <View style={styles.menuContainer}>
            <MenuDisplay
              menuItems={restaurant.menu_items || []}
              isOwner={isOwner}
              restaurantId={restaurant.id}
              onMenuUpdate={loadRestaurant}
            />
          </View>
        )}
        {activeTab === 'reviews' && (
          <View style={styles.reviewsContainer}>
            {reviews.length > 0 ? (
              <FlatList
                data={reviews}
                renderItem={renderReview}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Star size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{t('restaurant.noReviews')}</Text>
                <Text style={styles.emptySubtitle}>{t('restaurant.noReviewsText')}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <BookingModal
        visible={showBooking}
        restaurant={restaurant}
        onClose={() => setShowBooking(false)}
      />

      <ReviewModal
        visible={showReviewModal}
        restaurant={restaurant}
        onClose={() => setShowReviewModal(false)}
        onRequestBooking={() => {
          setShowReviewModal(false);
          setTimeout(() => setShowBooking(true), 300);
        }}
        onReviewSubmitted={() => {
          // Reload both reviews and restaurant data to get updated counts
          loadReviews();
          loadRestaurant();
        }}
      />

      {/* Opening Hours Modal */}
      <Modal visible={showOpeningHours} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Opening Hours</Text>
            <TouchableOpacity onPress={() => setShowOpeningHours(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.hoursContainer}>
              {Object.entries(formatOpeningHours(restaurant?.opening_hours)).length > 0 ? (
                Object.entries(formatOpeningHours(restaurant?.opening_hours)).map(([day, hours]) => (
                  <View key={day} style={styles.hourRow}>
                    <Text style={styles.dayText}>{day}</Text>
                    <Text style={styles.hoursText}>{hours}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.noHoursContainer}>
                  <Clock size={48} color="#D1D5DB" />
                  <Text style={styles.noHoursTitle}>No opening hours set</Text>
                  <Text style={styles.noHoursSubtitle}>
                    Contact the restaurant directly for their operating hours
                  </Text>
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  content: {
    flex: 1,
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
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  imageContainer: {
    position: 'relative',
  },
  restaurantImage: {
    width: '100%',
    height: 300,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantInfo: {
    padding: 20,
    backgroundColor: 'white',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  restaurantName: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  cuisineType: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
    marginBottom: 12,
  },
  metaInfo: {
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoritesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  favoritesCount: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  rating: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 14,
    fontSize: 12,
    color: '#4A5568',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  location: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
    lineHeight: 20,
  },
  badgesContainer: {
    marginVertical: 12,
  },
  clickableAddress: {
    color: '#f29056',
    textDecorationLine: 'underline',
  },
  distance: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactInfo: {
    gap: 8,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  linkText: {
    color: '#f9c435',
    textDecorationLine: 'underline',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  reviewButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  activeTabText: {
    color: '#2D3748',
  },
  videosContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  videoRow: {
    justifyContent: 'space-between',
  },
  videoCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  videoThumbnail: {
    width: '100%',
    aspectRatio: 9/16,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  reviewText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewImages: {
    marginTop: 8,
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  addMenuButton: {
    backgroundColor: '#f9c435',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  addMenuButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  menuContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  hoursContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  hoursText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  noHoursContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noHoursTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  noHoursSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});