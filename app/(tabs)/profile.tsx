import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Settings, LogOut, CreditCard as Edit, Store, Calendar, Star, X, Camera, Image as ImageIcon, Trash2, BookmarkCheck, MapPin, Globe } from 'lucide-react-native';
import NotificationBell from '@/components/NotificationBell';
import LanguageSelector from '@/components/LanguageSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'expo-router';
import UserBadge from '@/components/UserBadge';
import SubscriptionCard from '@/components/SubscriptionCard';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/supabaseApi';

interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  account_type: 'user' | 'business';
  created_at: string;
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  review_count: number;
  image_url?: string;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  guests: number;
  status: string;
  restaurant: {
    name: string;
    image_url?: string;
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<any[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [userHighestBadge, setUserHighestBadge] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;

    try {
      // Sync account type with subscription first
      await api.syncAccountTypeWithSubscription();
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setEditName(profileData.name);
      
      // Fetch user badges
      const badges = await api.getUserBadges(user.id);
      setUserBadges(badges);
      
      // Fetch highest badge for display
      const highestBadge = await api.getUserHighestBadge(user.id);
      setUserHighestBadge(highestBadge);

      // Fetch user reviews
      const userReviews = await api.getUserReviews(user.id);
      // Get total review count (may be more than the reviews we loaded)
      const count = await api.getUserReviewCount(user.id);
      setReviews(userReviews);
      setReviewCount(count);
      
      // Fetch favorite restaurants
      if (profileData.account_type === 'user') {
        const favorites = await api.getUserFavoriteRestaurants();
        setFavoriteRestaurants(favorites || []);
      }

      // Fetch restaurants if business user
      if (profileData.account_type === 'business') {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('id, name, cuisine, rating, review_count, image_url')
          .eq('owner_id', user.id)
          .eq('is_active', true);

        if (!restaurantsError) {
          setRestaurants(restaurantsData || []);
        }
      } else {
        // Fetch bookings if regular user
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_date,
            booking_time,
            guests,
            status,
            restaurant:restaurants(name, image_url)
          `)
          .eq('user_id', user.id)
          .order('booking_date', { ascending: false })
          .limit(5);

        if (!bookingsError) {
          setBookings(bookingsData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, name: editName.trim() });
      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleAvatarPicker = async () => {
    try {
      setUploadingAvatar(true);
      console.log('Starting avatar picker...');
      
      // Check current permission status first
      console.log('Checking current media library permission status...');
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('Current permission status:', currentPermission);
      
      let finalPermission = currentPermission;
      
      if (currentPermission.status === 'undetermined') {
        console.log('Permission undetermined, requesting...');
        finalPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Permission request result:', finalPermission);
      }
      
      if (finalPermission.status !== 'granted') {
        console.log('Permission not granted:', finalPermission.status);
        
        if (finalPermission.status === 'denied') {
          Alert.alert(
            'Photo Access Denied',
            'Photo access has been denied. Please go to Settings > Privacy & Security > Photos > Swipe4Food and enable photo access.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
            ]
          );
        } else {
          Alert.alert('Permission Required', 'We need access to your photos to update your profile picture.');
        }
        setUploadingAvatar(false);
        return;
      }

      console.log('Launching image picker...');
      
      // Add timeout to prevent hanging
      const pickerPromise = ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false, // Don't include EXIF data to reduce size
      });
      
      // Add 30 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Image picker timed out')), 30000)
      );
      
      const result = await Promise.race([pickerPromise, timeoutPromise]) as ImagePicker.ImagePickerResult;
      console.log('Image picker result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Avatar image selected:', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType
        });
        
        // Check file size before upload
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (asset.fileSize && asset.fileSize > maxSize) {
          const sizeMB = (asset.fileSize / 1024 / 1024).toFixed(1);
          Alert.alert('File Too Large', `Selected image is ${sizeMB}MB. Please select an image smaller than 5MB.`);
          setUploadingAvatar(false);
          return;
        }
        
        console.log('Uploading avatar image...');
        
        // Create filename with proper extension
        const fileExtension = asset.mimeType?.includes('png') ? 'png' : 'jpg';
        const fileName = `avatar-${user?.id}-${Date.now()}.${fileExtension}`;
        
        // Upload with timeout protection
        const uploadPromise = api.uploadImage(asset.uri, fileName, asset.mimeType, 'avatars');
        const uploadTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timed out after 60 seconds')), 60000)
        );
        
        const uploadedUrl = await Promise.race([uploadPromise, uploadTimeoutPromise]) as string;
        
        console.log('Avatar uploaded, updating profile...');
        
        // Update profile in database with timeout
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: uploadedUrl })
          .eq('id', user?.id);

        if (error) throw error;

        setProfile(prev => prev ? { ...prev, avatar_url: uploadedUrl } : null);
        setShowAvatarOptions(false);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update avatar:', error);
      setShowAvatarOptions(false);
      
      let errorMessage = 'Failed to update profile picture. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Upload took too long. Please check your internet connection and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please allow photo access in your device settings.';
        } else if (error.message.includes('too large')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarCamera = async () => {
    try {
      setUploadingAvatar(true);
      console.log('Starting camera capture...');
      
      // Check current camera permission status first
      console.log('Checking current camera permission status...');
      const currentPermission = await ImagePicker.getCameraPermissionsAsync();
      console.log('Current camera permission status:', currentPermission);
      
      let finalPermission = currentPermission;
      
      if (currentPermission.status === 'undetermined') {
        console.log('Camera permission undetermined, requesting...');
        finalPermission = await ImagePicker.requestCameraPermissionsAsync();
        console.log('Camera permission request result:', finalPermission);
      }
      
      if (finalPermission.status !== 'granted') {
        console.log('Camera permission not granted:', finalPermission.status);
        
        if (finalPermission.status === 'denied') {
          Alert.alert(
            'Camera Access Denied',
            'Camera access has been denied. Please go to Settings > Privacy & Security > Camera > Swipe4Food and enable camera access.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() }
            ]
          );
        } else {
          Alert.alert('Permission Required', 'We need camera access to take a photo for your profile picture.');
        }
        setUploadingAvatar(false);
        return;
      }

      console.log('Launching camera...');
      
      // Add timeout to prevent hanging
      const cameraPromise = ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Camera timed out')), 30000)
      );
      
      const result = await Promise.race([cameraPromise, timeoutPromise]) as ImagePicker.ImagePickerResult;
      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Photo captured:', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType
        });

        // Create filename with proper extension
        const fileName = `avatar-${user?.id}-${Date.now()}.jpg`;
        
        // Upload with timeout protection
        const uploadPromise = api.uploadImage(asset.uri, fileName, asset.mimeType, 'avatars');
        const uploadTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timed out after 60 seconds')), 60000)
        );
        
        const uploadedUrl = await Promise.race([uploadPromise, uploadTimeoutPromise]) as string;
        
        console.log('Photo uploaded, updating profile...');
        
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: uploadedUrl })
          .eq('id', user?.id);

        if (error) throw error;

        setProfile(prev => prev ? { ...prev, avatar_url: uploadedUrl } : null);
        setShowAvatarOptions(false);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Failed to capture and upload photo:', error);
      setShowAvatarOptions(false);
      
      let errorMessage = 'Failed to capture photo. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Camera or upload took too long. Please try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please allow camera access in your device settings.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Camera Error', errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user?.id);

              if (error) throw error;

              setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
              Alert.alert('Success', 'Profile picture removed successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove profile picture.');
            }
          }
        },
      ]
    );
  };

  const handleSignOut = async () => {
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
              // Force navigation to login after successful sign out
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              // Even if there's an error, try to navigate to login
              router.replace('/(auth)/login');
            }
          }
        },
      ]
    );
  };

  const switchAccountType = async () => {
    if (!user || !profile) return;

    const newType = profile.account_type === 'user' ? 'business' : 'user';
    const message = newType === 'business' 
      ? 'Switch to business account? This will allow you to manage restaurants and upload videos.'
      : 'Switch to user account? You will no longer be able to manage restaurants.';

    Alert.alert(
      'Switch Account Type',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ account_type: newType })
                .eq('id', user.id);

              if (error) throw error;
              
              // Update both local state and auth context
              setProfile(prev => prev ? { ...prev, account_type: newType } : null);
              await updateUserAccountType(newType);
              
              // Refresh user data from server to ensure consistency
              await refreshUser();
              
              // Refresh profile data
              fetchProfile();
              
              Alert.alert('Success', `Switched to ${newType} account successfully!`);
            } catch (error) {
              Alert.alert('Error', 'Failed to switch account type');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <NotificationBell />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <NotificationBell />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => setShowAvatarOptions(true)}
            disabled={uploadingAvatar}
          >
            {profile?.avatar_url ? (
              <>
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                {uploadingAvatar && (
                  <View style={styles.avatarUploadOverlay}>
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
                {!uploadingAvatar && (
                  <View style={styles.avatarChangeButton}>
                    <Camera size={16} color="white" />
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.avatarPlaceholder, uploadingAvatar && styles.avatarUploading]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#f29056" />
                ) : (
                  <>
                    <User size={40} color="#4A5568" />
                    <View style={styles.avatarChangeButton}>
                      <Camera size={16} color="white" />
                    </View>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          
          {/* User Badge */}
          {userHighestBadge && (
            <View style={styles.userBadgeContainer}>
              <UserBadge 
                badgeName={userHighestBadge.badge_name}
                badgeIcon={userHighestBadge.badge_icon}
                badgeColor={userHighestBadge.badge_color}
                size="large"
                showLabel={true}
              />
            </View>
          )}
          
          <View style={styles.accountTypeBadge}>
            {profile?.account_type === 'business' ? (
              <Store size={16} color="white" />
            ) : (
              <User size={16} color="white" />
            )}
            <Text style={styles.accountTypeText}>
              {profile?.account_type === 'business' ? 'Restaurant Owner' : 'Food Lover'}
            </Text>
          </View>
        </View>

        {/* Badges Section */}
        {/* Subscription Section */}
        <SubscriptionCard 
          onUpgrade={() => router.push('/subscription/plans')}
        />

        {userBadges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myBadges')}</Text>
            <View style={styles.badgesGrid}>
              {userBadges.map((badge) => (
                <View key={badge.id} style={styles.badgeCard}>
                  <UserBadge 
                    badgeName={badge.badge_definitions.name}
                    badgeIcon={badge.badge_definitions.icon}
                    badgeColor={badge.badge_definitions.color}
                    size="medium"
                    showLabel={true}
                  />
                  <Text style={styles.badgeDescription}>
                    {badge.badge_definitions.description}
                  </Text>
                  <Text style={styles.badgeDate}>
                    Earned {new Date(badge.awarded_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          {profile?.account_type === 'business' ? (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{restaurants.length}</Text>
                <Text style={styles.statLabel}>Restaurants</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {restaurants.reduce((sum, r) => sum + r.review_count, 0)}
                </Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {restaurants.length > 0 
                    ? (restaurants.reduce((sum, r) => sum + r.rating, 0) / restaurants.length).toFixed(1)
                    : '0.0'
                  }
                </Text>
                <Text style={styles.statLabel}>Avg Rating</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{bookings.length}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {bookings.filter(b => b.status === 'completed').length}
                </Text>
                <Text style={styles.statLabel}>Visited</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {reviewCount}
                </Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.accountSettings')}</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowEditProfile(true)}
          >
            <Edit size={20} color="#4A5568" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>{t('profile.editProfile')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('profile.editProfile')}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowLanguageSelector(true)}
          >
            <Globe size={20} color="#4A5568" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>{t('profile.language')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('language.selectLanguage')}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={switchAccountType}>
            {profile?.account_type === 'business' ? (
              <User size={20} color="#4A5568" />
            ) : (
              <Store size={20} color="#4A5568" />
            )}
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>
                {profile?.account_type === 'business' 
                  ? t('profile.switchToUserAccount') 
                  : t('profile.switchToBusinessAccount')}
              </Text>
              <Text style={styles.menuItemSubtitle}>
                {profile?.account_type === 'business' 
                  ? 'Switch back to regular user experience' 
                  : 'Create and manage your restaurant'
                }
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={20} color="#4A5568" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>{t('profile.settings')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('profile.notifications')}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut size={20} color="#EF4444" />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>{t('auth.logout')}</Text>
              <Text style={styles.menuItemSubtitle}>{t('auth.logout')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Business Content */}
        {profile?.account_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myRestaurants')}</Text>
            {restaurants.length > 0 ? (
              restaurants.map((restaurant) => (
                <TouchableOpacity 
                  key={restaurant.id} 
                  style={styles.restaurantCard}
                  onPress={() => router.push(`/restaurant/${restaurant.id}`)}
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
                    <View style={styles.ratingContainer}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.rating}>
                        {restaurant.rating.toFixed(1)} ({restaurant.review_count} reviews)
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Store size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No restaurants yet</Text>
                <Text style={styles.emptyText}>Start by creating your first restaurant profile</Text>
              </View>
            )}
          </View>
        )}

        {/* Favorite Restaurants Section - Only for regular users */}
        {profile?.account_type === 'user' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.favoriteRestaurants')}</Text>
            {favoriteRestaurants.length > 0 ? (
              favoriteRestaurants.map((restaurant) => (
                <TouchableOpacity 
                  key={restaurant.id} 
                  style={styles.restaurantCard}
                  onPress={() => router.push(`/restaurant/${restaurant.id}`)}
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
                    <Text style={styles.restaurantCuisine}>{restaurant.cuisine} • {restaurant.price_range}</Text>
                    
                    <View style={styles.ratingContainer}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.rating}>
                        {restaurant.rating.toFixed(1)} ({restaurant.review_count} reviews)
                      </Text>
                    </View>
                    
                    <View style={styles.locationContainer}>
                      <MapPin size={14} color="#94A3B8" />
                      <Text style={styles.distance}>
                        {restaurant.city}, {restaurant.country}
                      </Text>
                    </View>
                    
                    <Text style={styles.favoriteDate}>
                      Saved {new Date(restaurant.favorited_at).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <BookmarkCheck size={20} color="#f29056" fill="#f29056" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <BookmarkCheck size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{t('profile.noFavorites')}</Text>
                <Text style={styles.emptyText}>{t('profile.noFavorites')}</Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => router.push('/(tabs)/search')}
                >
                  <Text style={styles.exploreButtonText}>Explore Restaurants</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* User Content */}
        {profile?.account_type === 'user' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.recentBookings')}</Text>
            {bookings.length > 0 ? (
              bookings.map((booking) => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingRestaurant}>
                      {booking.restaurant?.name || 'Restaurant'}
                    </Text>
                    <Text style={styles.bookingDetails}>
                      {new Date(booking.booking_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })} at {booking.booking_time}
                    </Text>
                    <Text style={styles.bookingGuests}>{booking.guests} guests</Text>
                    <View style={[styles.statusBadge, getStatusStyle(booking.status)]}>
                      <Text style={styles.statusText}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Calendar size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No bookings yet</Text>
                <Text style={styles.emptyText}>Start exploring restaurants and make your first booking</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Avatar Options Modal */}
      <Modal
        visible={showAvatarOptions}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Profile Picture</Text>
              <TouchableOpacity onPress={() => setShowAvatarOptions(false)}>
                <X size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={() => {
                  setShowAvatarOptions(false);
                  handleAvatarPicker();
                }}
              >
                <View style={styles.modalIconContainer}>
                  <ImageIcon size={24} color="#f29056" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionDescription}>Select an existing photo from your device</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={() => {
                  setShowAvatarOptions(false);
                  handleAvatarCamera();
                }}
              >
                <View style={styles.modalIconContainer}>
                  <Camera size={24} color="#f29056" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Take a Photo</Text>
                  <Text style={styles.modalOptionDescription}>Capture a new photo with your camera</Text>
                </View>
              </TouchableOpacity>
              
              {profile?.avatar_url && (
                <TouchableOpacity 
                  style={styles.modalOption}
                  onPress={() => {
                    setShowAvatarOptions(false);
                    handleRemoveAvatar();
                  }}
                >
                  <View style={styles.modalIconContainer}>
                    <Trash2 size={24} color="#EF4444" />
                  </View>
                  <View style={styles.modalOptionTextContainer}>
                    <Text style={[styles.modalOptionTitle, { color: '#EF4444' }]}>Remove Photo</Text>
                    <Text style={styles.modalOptionDescription}>Remove your current profile picture</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowAvatarOptions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
              />
            </View>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Language Selector Modal */}
      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />
    </SafeAreaView>
  );
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { backgroundColor: '#10B981' };
    case 'pending':
      return { backgroundColor: '#F59E0B' };
    case 'cancelled':
      return { backgroundColor: '#EF4444' };
    case 'completed':
      return { backgroundColor: '#6B7280' };
    default:
      return { backgroundColor: '#94A3B8' };
  }
};

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
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarUploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChangeButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f29056',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarUploading: {
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 16,
  },
  userBadgeContainer: {
    marginBottom: 16,
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  accountTypeText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  statsContainer: {
    flexDirection: 'row',
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
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
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
    minWidth: 140,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  badgeDate: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    marginTop: 4,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  restaurantCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  restaurantImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
    justifyContent: 'center',
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
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distance: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  favoriteDate: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
  },
  exploreButton: {
    backgroundColor: '#f29056',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  exploreButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  bookingCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingRestaurant: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  bookingDetails: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 4,
  },
  bookingGuests: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
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
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
  },
  saveButton: {
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
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
  scrollContent: {
    paddingBottom: 120,
  },
});