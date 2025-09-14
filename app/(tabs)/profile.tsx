import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  User, 
  Settings, 
  Globe, 
  Bell, 
  LogOut, 
  Store, 
  Star, 
  Calendar, 
  Heart,
  Camera,
  Crown,
  X,
  Edit3,
  MapPin,
  Award
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/services/supabaseApi';
import LanguageSelector from '@/components/LanguageSelector';
import SubscriptionCard from '@/components/SubscriptionCard';
import UserBadge from '@/components/UserBadge';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState({
    favoriteRestaurants: [],
    recentBookings: [],
    userBadges: [],
    reviewCount: 0,
  });
  const [userRestaurant, setUserRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUser(),
        loadUserData()
      ]);
    } catch (error) {
      console.error('Failed to refresh profile data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load user statistics
      const [favoriteRestaurants, recentBookings, userBadges] = await Promise.all([
        api.getUserFavoriteRestaurants().catch(() => []),
        api.getUserBookings().catch(() => []),
        api.getUserBadges(user.id).catch(() => []),
      ]);

      // Get review count
      const reviewCount = await api.getUserReviewCount(user.id).catch(() => 0);

      setUserStats({
        favoriteRestaurants: favoriteRestaurants.slice(0, 3), // Show only first 3
        recentBookings: recentBookings.slice(0, 3), // Show only first 3
        userBadges,
        reviewCount,
      });

      // Load restaurant if user is a business owner
      if (user.account_type === 'business') {
        const restaurant = await api.getRestaurantByOwnerId(user.id);
        setUserRestaurant(restaurant);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      setUploadingImage(true);
      console.log('Starting profile image picker...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need access to your photos to update your profile picture.');
        return;
      }
      
      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Image selected:', asset.uri);
        
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select an image smaller than 5MB.');
          return;
        }
        
        console.log('Uploading profile image...');
        const fileName = `avatar-${user!.id}-${Date.now()}.jpg`;
        const uploadedUrl = await api.uploadImage(asset.uri, fileName, asset.mimeType || 'image/jpeg', 'avatars');
        
        console.log('Image uploaded successfully:', uploadedUrl);
        
        // Update user profile with new avatar URL
        await api.updateProfile(user!.id, { avatar_url: uploadedUrl });
        await refreshUser();
        
        setShowImageOptions(false);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update profile picture:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile picture. Please try again.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      setUploadingImage(true);
      console.log('Starting camera capture...');
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera access to take a profile picture.');
        return;
      }
      
      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Photo captured:', asset.uri);

        const fileName = `avatar-camera-${user!.id}-${Date.now()}.jpg`;
        const uploadedUrl = await api.uploadImage(asset.uri, fileName, asset.mimeType, 'avatars');
        
        console.log('Photo uploaded successfully:', uploadedUrl);
        
        await api.updateProfile(user!.id, { avatar_url: uploadedUrl });
        await refreshUser();
        
        setShowImageOptions(false);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Failed to capture and upload photo:', error);
      setShowImageOptions(false);
      
      let errorMessage = 'Failed to capture photo. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please allow camera access in your device settings.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Camera Error', errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getHighestBadge = () => {
    if (!userStats.userBadges || userStats.userBadges.length === 0) return null;
    
    // Sort badges by sort_order (highest first) and return the first one
    const sortedBadges = userStats.userBadges.sort((a, b) => 
      (b.badge_definitions?.sort_order || 0) - (a.badge_definitions?.sort_order || 0)
    );
    
    return sortedBadges[0];
  };

  const highestBadge = getHighestBadge();

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f29056" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('navigation.profile')}</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Settings size={24} color="#2D3748" />
        </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setShowImageOptions(true)}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={40} color="#4A5568" />
                </View>
              )}
              
              {uploadingImage ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="small" color="#f29056" />
                </View>
              ) : (
                <View style={styles.cameraButton}>
                  <Camera size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.name}>{user.name}</Text>
          
          <View style={styles.accountTypeBadge}>
            {user.account_type === 'business' ? (
              <Store size={16} color="white" />
            ) : (
              <User size={16} color="white" />
            )}
            <Text style={styles.accountTypeText}>
              {user.account_type === 'business' ? 'Restaurant Owner' : 'Food Lover'}
            </Text>
          </View>
          
          {/* User Badge */}
          {highestBadge && (
            <View style={styles.badgeContainer}>
              <UserBadge 
                badgeName={highestBadge.badge_definitions?.name}
                badgeIcon={highestBadge.badge_definitions?.icon}
                badgeColor={highestBadge.badge_definitions?.color}
                size="medium"
                showLabel={true}
              />
            </View>
          )}
          
          <Text style={styles.joinDate}>
            {t('profile.joinedDate')} {formatJoinDate(user.created_at)}
          </Text>
        </View>

        {/* Subscription Card */}
        <SubscriptionCard 
          onUpgrade={() => router.push('/subscription/plans')}
        />

        {/* My Restaurant (Business Users) */}
        {user.account_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myRestaurants')}</Text>
            
            {userRestaurant ? (
              <TouchableOpacity 
                style={styles.restaurantCard}
                onPress={() => router.push(`/restaurant/${userRestaurant.id}`)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ 
                    uri: userRestaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
                  }} 
                  style={styles.restaurantImage} 
                />
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>{userRestaurant.name}</Text>
                  <Text style={styles.restaurantCuisine}>{userRestaurant.cuisine}</Text>
                  
                  <View style={styles.restaurantMeta}>
                    <View style={styles.ratingContainer}>
                      <Star size={14} color="#f9c435" fill="#f9c435" />
                      <Text style={styles.rating}>
                        {userRestaurant.rating.toFixed(1)} ({userRestaurant.review_count} reviews)
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.locationContainer}>
                    <MapPin size={14} color="#4A5568" />
                    <Text style={styles.location}>
                      {userRestaurant.city}, {userRestaurant.country}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.editRestaurantButton}
                  onPress={() => router.push(`/restaurant/edit/${userRestaurant.id}`)}
                >
                  <Edit3 size={16} color="#f29056" />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <View style={styles.noRestaurantContainer}>
                <Store size={48} color="#D1D5DB" />
                <Text style={styles.noRestaurantTitle}>No restaurant yet</Text>
                <Text style={styles.noRestaurantText}>
                  Create your restaurant profile to start uploading videos and managing bookings.
                </Text>
                <TouchableOpacity 
                  style={styles.createRestaurantButton}
                  onPress={() => router.push('/restaurant/create')}
                >
                  <Store size={16} color="white" />
                  <Text style={styles.createRestaurantButtonText}>Create Restaurant</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Star size={24} color="#f9c435" />
              <Text style={styles.statNumber}>{userStats.reviewCount}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            
            <View style={styles.statCard}>
              <Heart size={24} color="#EF4444" />
              <Text style={styles.statNumber}>{userStats.favoriteRestaurants.length}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
            
            <View style={styles.statCard}>
              <Calendar size={24} color="#3B82F6" />
              <Text style={styles.statNumber}>{userStats.recentBookings.length}</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
            
            <View style={styles.statCard}>
              <Award size={24} color="#8B5CF6" />
              <Text style={styles.statNumber}>{userStats.userBadges.length}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
          </View>
        </View>

        {/* Favorite Restaurants */}
        {userStats.favoriteRestaurants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profile.favoriteRestaurants')}</Text>
              <TouchableOpacity onPress={() => router.push('/favorites')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalList}>
                {userStats.favoriteRestaurants.map((restaurant: any) => (
                  <TouchableOpacity 
                    key={restaurant.id} 
                    style={styles.favoriteCard}
                    onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                  >
                    <Image 
                      source={{ 
                        uri: restaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
                      }} 
                      style={styles.favoriteImage} 
                    />
                    <Text style={styles.favoriteName} numberOfLines={1}>
                      {restaurant.name}
                    </Text>
                    <Text style={styles.favoriteCuisine} numberOfLines={1}>
                      {restaurant.cuisine}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* My Badges */}
        {userStats.userBadges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myBadges')}</Text>
            
            <View style={styles.badgesGrid}>
              {userStats.userBadges.map((badge: any) => (
                <View key={badge.id} style={styles.badgeCard}>
                  <UserBadge 
                    badgeName={badge.badge_definitions?.name}
                    badgeIcon={badge.badge_definitions?.icon}
                    badgeColor={badge.badge_definitions?.color}
                    size="large"
                    showLabel={true}
                  />
                  <Text style={styles.badgeDescription} numberOfLines={2}>
                    {badge.badge_definitions?.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowLanguageSelector(true)}
          >
            <Globe size={20} color="#4A5568" />
            <Text style={styles.settingText}>{t('profile.language')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Bell size={20} color="#4A5568" />
            <Text style={styles.settingText}>{t('profile.notifications')}</Text>
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.accountSettings')}</Text>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Language Selector Modal */}
      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />

      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImageOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.updateProfilePicture')}</Text>
              <TouchableOpacity onPress={() => setShowImageOptions(false)}>
                <X size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={() => {
                  setShowImageOptions(false);
                  handleImagePicker();
                }}
              >
                <View style={styles.modalIconContainer}>
                  <User size={24} color="#f29056" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Choose from Photos</Text>
                  <Text style={styles.modalOptionDescription}>Select a photo from your gallery</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={() => {
                  setShowImageOptions(false);
                  handleCameraCapture();
                }}
              >
                <View style={styles.modalIconContainer}>
                  <Camera size={24} color="#f29056" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Take a Photo</Text>
                  <Text style={styles.modalOptionDescription}>Take a new profile picture</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowImageOptions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
  },
  settingsButton: {
    padding: 8,
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
  profileHeader: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
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
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f29056',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
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
  badgeContainer: {
    marginBottom: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  horizontalList: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  favoriteCard: {
    width: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  favoriteImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  favoriteName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  favoriteCuisine: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: '45%',
    gap: 8,
  },
  badgeDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  restaurantCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
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
  editRestaurantButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    marginBottom: 20,
  },
  createRestaurantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  createRestaurantButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#faf6ee',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  modalContent: {
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalOptionTextContainer: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  modalOptionDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
});