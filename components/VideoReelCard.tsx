import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, TextInput, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPlayer, { VideoPlayerMethods } from './VideoPlayer';
import { Heart, MessageCircle, Share, Calendar, Star, MapPin, Send, Eye, Bell, Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BookingModal from './BookingModal';
import CommentsModal from './CommentsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { api } from '@/services/supabaseApi';
import { locationService } from '@/services/locationService';
import { formatNumber } from '@/utils/formatNumber';
import NotificationBell from './NotificationBell';
import Logo from './Logo';

const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');

interface VideoReelCardProps {
  video: any;
  isActive: boolean;
  onRestaurantPress: () => void;
}

export default function VideoReelCard({ video, isActive, onRestaurantPress }: VideoReelCardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const restaurant = video.restaurants;
  
  const [isLiked, setIsLiked] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likesCount, setLikesCount] = useState(video?.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(video?.comments_count || 0);
  const [viewsCount, setViewsCount] = useState(video?.views_count || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoPlayerRef = useRef<VideoPlayerMethods>(null);
  const { user } = useAuth();
  const { userLocation } = useLocation();

  // Initialize video state when component mounts or video changes
  useEffect(() => {
    if (user && video) {
      checkIfLiked();
      refreshVideoCounts();
    }
  }, [user, video]);

  // Handle video play/pause based on active state
  useEffect(() => {
    if (isActive && !userPaused && videoPlayerRef.current) {
      setTimeout(async () => {
        try {
          await videoPlayerRef.current?.play();
          setIsPlaying(true);
          
          // Track view after 1 second
          setTimeout(() => {
            if (user) {
              api.trackVideoEvent(video.id, 'view');
            }
          }, 1000);
        } catch (error) {
          console.log('Video autoplay failed:', error);
        }
      }, 100);
    } else if (!isActive && videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
      setUserPaused(false); // Reset user pause when video becomes inactive
    }
  }, [isActive, video, userPaused]);

  const checkIfLiked = async () => {
    if (!user || !video) return;
    try {
      const liked = await api.isVideoLiked(video.id);
      setIsLiked(liked);
    } catch (error) {
      console.error('Failed to check if liked:', error);
    }
  };

  const refreshVideoCounts = async () => {
    if (!video) return;
    try {
      const counts = await api.getVideoCounts(video.id);
      setLikesCount(counts.likes_count || 0);
      setCommentsCount(counts.comments_count || 0);
      setViewsCount(counts.views_count || 0);
    } catch (error) {
      console.error('Failed to refresh video counts:', error);
    }
  };

  const handleLike = async () => {
    if (!user || !video || loading) return;
    
    setLoading(true);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      const result = await api.toggleLike(video.id);
      setIsLiked(result);
      await refreshVideoCounts();
      await api.trackVideoEvent(video.id, 'like');
    } catch (error) {
      console.error('Failed to toggle like:', error);
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPress = async () => {
    if (!videoPlayerRef.current) return;
    
    try {
      if (isPlaying) {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
        setUserPaused(true);
      } else {
        await videoPlayerRef.current.play();
        setIsPlaying(true);
        setUserPaused(false);
      }
    } catch (error) {
      console.error('Video toggle error:', error);
    }
  };

  const handleShare = () => {
    Alert.alert('Share', 'Share functionality would be implemented here');
  };

  const handleCommentsUpdate = () => {
    refreshVideoCounts();
  };

  const handleBookButtonPress = () => {
    if (videoPlayerRef.current && isPlaying) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
      setUserPaused(true);
    }
    setShowBooking(true);
  };
  
  return (
    <View style={styles.container}>
      {/* Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={handleVideoPress}
      >
        <VideoPlayer
          key={video.id}
          ref={videoPlayerRef}
          source={video.video_url}
          style={styles.video}
          shouldPlay={isActive && !userPaused}
          isLooping
          resizeMode="cover"
          useNativeControls={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
            }
          }}
        />
        
        {/* Play Button Overlay - Only show when user has paused */}
        {userPaused && !isPlaying && (
          <View style={styles.playOverlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Play size={32} color="white" fill="white" />
            </View>
          </View>
        )}
      </TouchableOpacity>
      
      {/* Top Header */}
      <View style={[styles.topHeader, { top: insets.top }]} pointerEvents="box-none">
        <View style={styles.headerPlaceholder} />
        <NotificationBell color="white" />
      </View>
      
      {/* Right Side Actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLike}
          disabled={loading}
        >
          <Heart
            size={28}
            color={isLiked ? '#EF4444' : 'white'}
            fill={isLiked ? '#EF4444' : 'transparent'}
          />
          <Text style={styles.actionText}>
            {formatNumber(likesCount)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => setShowComments(true)}
        >
          <MessageCircle size={28} color="white" />
          <Text style={styles.actionText}>
            {formatNumber(commentsCount)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Share size={28} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Eye size={28} color="white" />
          <Text style={styles.actionText}>
            {formatNumber(viewsCount)}
          </Text>
        </TouchableOpacity>
        
        {/* Restaurant Avatar */}
        <TouchableOpacity 
          style={styles.restaurantAvatar}
          onPress={onRestaurantPress}
        >
          <Image 
            source={{ 
              uri: restaurant?.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
            }} 
            style={styles.avatarImage} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Info */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      
      <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 100 }]} pointerEvents="box-none">
        {/* Restaurant Info */}
        <TouchableOpacity 
          style={styles.restaurantInfo}
          onPress={onRestaurantPress}
          activeOpacity={0.7}
        >
          <View style={styles.restaurantHeader}>
            <Text style={styles.restaurantName}>@{restaurant?.name}</Text>
          </View>
          
          <View style={styles.ratingContainer}>
            <Star size={14} color="#FFD700" fill="#FFD700" />
            <Text style={styles.rating}>{restaurant?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.reviewCount}>({restaurant?.review_count || 0} reviews)</Text>
          </View>
          
          <Text style={styles.cuisineType}>
            {restaurant?.cuisine} • {restaurant?.price_range}
          </Text>
          
          <View style={styles.locationRow}>
            <MapPin size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.location}>
              {restaurant?.city}, {restaurant?.country}
            </Text>
            {userLocation && restaurant?.latitude && restaurant?.longitude && (
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
          </View>
        </TouchableOpacity>
        
        {/* Video Caption */}
        <Text style={styles.videoCaption} numberOfLines={2}>
          {video.title}
        </Text>
        
        {/* Book Button */}
        <TouchableOpacity
          style={styles.bookButton}
          onPress={handleBookButtonPress}
        >
          <Calendar size={18} color="white" />
          <Text style={styles.bookButtonText}>Book Table</Text>
        </TouchableOpacity>
      </View>
      
      {/* Modals */}
      <BookingModal
        visible={showBooking}
        restaurant={restaurant}
        onClose={() => setShowBooking(false)}
      />

      <CommentsModal
        visible={showComments}
        video={video}
        onClose={() => setShowComments(false)}
        onCommentsUpdate={handleCommentsUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'black',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  topHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: '25%',
    gap: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  restaurantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
    marginTop: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerPlaceholder: {
    width: 1,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    zIndex: 5,
  },
  bottomContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 20,
    zIndex: 10,
  },
  restaurantInfo: {
    marginBottom: 12,
  },
  restaurantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: 'white',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  rating: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  reviewCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  cuisineType: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
  },
  distance: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
  },
  videoCaption: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: 'white',
    lineHeight: 18,
    marginBottom: 16,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-start',
    gap: 8,
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
});