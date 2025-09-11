import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, TextInput, FlatList, Platform, Modal } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPlayer, { VideoPlayerMethods } from './VideoPlayer';
import { Heart, MapPin, Star, Calendar, MessageCircle, Send, X, Play, Pause, Eye, RefreshCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BookingModal from './BookingModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from '@/contexts/LocationContext';
import { api } from '@/services/supabaseApi';
import { supabase } from '@/lib/supabase';
import { locationService } from '@/services/locationService';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { formatNumber } from '@/utils/formatNumber';
import UserBadge from './UserBadge';

const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');

// Tab bar height constant
const TAB_BAR_HEIGHT = 70;

interface VideoCardProps {
  video: any;
  isActive: boolean;
  autoOpenComments?: boolean;
  highlightCommentId?: string;
}

export default function VideoCard({ 
  video, 
  isActive, 
  autoOpenComments = false,
  highlightCommentId 
}: VideoCardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { t } = useLanguage();
  
  const restaurant = video.restaurants;
  
  const [isLiked, setIsLiked] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showComments, setShowComments] = useState(autoOpenComments);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likesCount, setLikesCount] = useState(video?.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(video?.comments_count || 0);
  const [viewsCount, setViewsCount] = useState(video?.views_count || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [optimisticComments, setOptimisticComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const videoPlayerRef = useRef<VideoPlayerMethods>(null);
  const [commenterBadges, setCommenterBadges] = useState<Record<string, any>>({});
  const { user } = useAuth();
  const { userLocation } = useLocation();
  const isFocused = useIsFocused();

  // Auto-open comments if specified
  React.useEffect(() => {
    if (autoOpenComments) {
      setShowComments(true);
      loadComments();
    }
  }, [autoOpenComments]);

  // Pause video when screen loses focus or component is not active
  React.useEffect(() => {
    if (!isFocused || !isActive) {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isFocused, isActive]);

  React.useEffect(() => {
    if (user && video) {
      checkIfLiked();
      refreshVideoCounts();
      setupRealtimeSubscriptions();
    }
  }, [user, video]);

  // Auto-play when video becomes active
  React.useEffect(() => {
    if (isActive && !userPaused && videoPlayerRef.current && isFocused) {
      setTimeout(async () => {
        try {
          await videoPlayerRef.current?.play();
          setIsPlaying(true);
          
          // Track view after a delay
          setTimeout(() => {
            if (user) {
              api.trackVideoEvent(video.id, 'view');
            }
          }, 1000);
        } catch (error) {
          console.log('Video autoplay failed:', error);
        }
      }, 200);
    } else if (!isActive && videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
      setUserPaused(false); // Reset user pause when video becomes inactive
    }
  }, [isActive, video, user, isFocused, userPaused]);

  // Separate effect for focus changes
  React.useEffect(() => {
    if (!isFocused && videoPlayerRef.current && isPlaying) {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
        setUserPaused(false);
    }
  }, [isFocused, isPlaying]);

  const handleVideoPress = () => {
    if (!videoPlayerRef.current) return;
    
    try {
      if (isPlaying) {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
        setUserPaused(true);
      } else {
        videoPlayerRef.current.play();
        setIsPlaying(true);
        setUserPaused(false);
      }
    } catch (error) {
      console.error('Video toggle error:', error);
    }
  };
  const setupRealtimeSubscriptions = () => {
    if (!video?.id) return;

    // Subscribe to likes changes
    const likesSubscription = supabase
      .channel(`video-likes-${video.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `video_id=eq.${video.id}`,
        },
        (payload) => {
          console.log('Likes change:', payload);
          // Refresh counts when likes change
          refreshVideoCounts();
        }
      )
      .subscribe();

    // Subscribe to comments changes
    const commentsSubscription = supabase
      .channel(`video-comments-${video.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `video_id=eq.${video.id}`,
        },
        (payload) => {
          console.log('Comments change:', payload);
          if (showComments) {
            loadComments();
          }
          refreshVideoCounts();
        }
      )
      .subscribe();

    // Subscribe to video count updates
    const videoSubscription = supabase
      .channel(`video-${video.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${video.id}`,
        },
        (payload) => {
          console.log('Video update:', payload);
          if (payload.new) {
            setLikesCount(payload.new.likes_count || 0);
            setCommentsCount(payload.new.comments_count || 0);
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      likesSubscription.unsubscribe();
      commentsSubscription.unsubscribe();
      videoSubscription.unsubscribe();
    };
  };

  const checkIfLiked = async () => {
    if (!user || !video) return;
    try {
      const liked = await api.isVideoLiked(video.id);
      setIsLiked(liked);
    } catch (error) {
      console.error('Failed to check like status:', error);
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
    
    // Optimistically update the UI
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      const result = await api.toggleLike(video.id);
      console.log('Like toggle result:', result);
      
      // The result tells us the new like state
      setIsLiked(result);
      
      // Force refresh counts from database to ensure accuracy
      await refreshVideoCounts();
      
      // Track analytics
      await api.trackVideoEvent(video.id, 'like');
    } catch (error) {
      console.error('Failed to toggle like:', error);
      // Revert optimistic update on error
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    } finally {
      setLoading(false);
    }
  };

  const loadCommenterBadges = async (comments: any[]) => {
    try {
      const uniqueUserIds = [...new Set(comments.map(c => c.user_id))];
      const badges: Record<string, any> = {};
      
      for (const userId of uniqueUserIds) {
        try {
          const userBadge = await api.getUserHighestBadge(userId);
          if (userBadge) {
            badges[userId] = userBadge;
          }
        } catch (error) {
          console.error('Failed to load badge for user:', userId);
        }
      }
      
      setCommenterBadges(badges);
    } catch (error) {
      console.error('Failed to load commenter badges:', error);
    }
  };

  const handleRefreshComments = async () => {
    setRefreshing(true);
    try {
      await loadComments();
      await refreshVideoCounts();
    } finally {
      setRefreshing(false);
    }
  };

  const loadComments = async () => {
    if (!video) return;
    
    try {
      const videoComments = await api.getComments(video.id);
      setComments(videoComments);
      
      // Load badges for all commenters
      await loadCommenterBadges(videoComments);
      
      // Clear optimistic comments when we load real ones
      setOptimisticComments([]);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleShowComments = () => {
    setShowComments(true);
    loadComments();
    refreshVideoCounts();
  };

  const handleAddComment = async (text: string, parentId?: string) => {
    if (!user || !video || !text.trim() || loading) return;
    
    setLoading(true);
    
    // Create optimistic comment
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      video_id: video.id,
      user_id: user.id,
      text: text.trim(),
      created_at: new Date().toISOString(),
      parent_id: parentId || null,
      depth: parentId ? 1 : 0,
      profiles: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url
      },
      replies: [],
      isOptimistic: true
    };
    
    try {
      if (parentId) {
        // For replies, add to optimistic comments
        setOptimisticComments(prev => [...prev, optimisticComment]);
        setReplyingTo(null);
        setReplyText('');
      } else {
        // For top-level comments, add to main comments
        setComments(prev => [optimisticComment, ...prev]);
        setNewComment('');
      }
      
      // Optimistically update count
      setCommentsCount(prev => prev + 1);
      
      const comment = await api.addComment(video.id, text.trim(), parentId);
      console.log('Comment added:', comment);
      
      // Remove optimistic comment and reload real comments
      if (parentId) {
        setOptimisticComments([]);
        await loadComments();
      } else {
        // Replace optimistic comment with real one
        setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
        await loadComments();
      }
      
      // Refresh counts from database
      await refreshVideoCounts();
      
      // Track analytics
      await api.trackVideoEvent(video.id, 'comment');
    } catch (error) {
      console.error('Failed to add comment:', error);
      // Remove optimistic comment on error
      if (parentId) {
        setOptimisticComments(prev => prev.filter(c => c.id !== optimisticComment.id));
        setReplyingTo(null);
        setReplyText('');
      } else {
        setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
        setNewComment('');
      }
      // Revert count
      setCommentsCount(prev => Math.max(0, prev - 1));
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (commentId: string, userName: string) => {
    setReplyingTo(commentId);
    setReplyText(`@${userName} `);
  };

  const renderComment = (comment: any, depth: number = 0) => {
    const isOptimistic = comment.isOptimistic;
    const isHighlighted = highlightCommentId === comment.id;
    
    return (
      <View key={comment.id} style={[
        styles.commentItem,
        depth > 0 && styles.replyComment,
        { marginLeft: depth * 20 },
        isHighlighted && styles.highlightedComment,
        isOptimistic && styles.optimisticComment
      ]}>
        <TouchableOpacity 
          onPress={() => {
            if (!isOptimistic) {
              handleUserProfileNavigation(comment.user_id);
            }
          }}
          disabled={isOptimistic}
        >
          <Image 
            source={{ uri: comment.profiles?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg' }} 
            style={[
              styles.commentAvatar,
              depth > 0 && styles.replyAvatar,
              isOptimistic && styles.optimisticAvatar
            ]}
          />
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <TouchableOpacity 
            onPress={() => {
              if (!isOptimistic) {
                handleUserProfileNavigation(comment.user_id);
              }
            }}
            activeOpacity={0.7}
            disabled={isOptimistic}
          >
            <Text style={[styles.commentUser, !isOptimistic && styles.clickableUser]}>
              {comment.profiles?.name || 'Anonymous'}
              {isOptimistic && ' (sending...)'}
            </Text>
            
            {/* User Badge */}
            {!isOptimistic && commenterBadges[comment.user_id] && (
              <UserBadge 
                badgeName={commenterBadges[comment.user_id].badge_name}
                badgeIcon={commenterBadges[comment.user_id].badge_icon}
                badgeColor={commenterBadges[comment.user_id].badge_color}
                size="small"
                showLabel={false}
              />
            )}
          </TouchableOpacity>
          
          <Text style={styles.commentText}>{comment.text}</Text>
          
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>
              {new Date(comment.created_at).toLocaleDateString()}
            </Text>
            
            {user && depth < 3 && !isOptimistic && (
              <TouchableOpacity 
                onPress={() => handleReply(comment.id, comment.profiles?.name || 'User')}
                style={styles.replyButton}
              >
                <Text style={styles.replyButtonText}>{t('video.reply')}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Reply input for this specific comment */}
          {replyingTo === comment.id && (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyTextInput}
                placeholder={`Reply to ${comment.profiles?.name || 'User'}...`}
                placeholderTextColor="#94A3B8"
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={500}
                autoFocus
              />
              <View style={styles.replyActions}>
                <TouchableOpacity 
                  style={styles.cancelReplyButton}
                  onPress={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                >
                  <Text style={styles.cancelReplyText}>{t('video.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sendReplyButton, 
                    { opacity: replyText.trim() && !loading ? 1 : 0.5 }
                  ]} 
                  onPress={() => handleAddComment(replyText, comment.id)}
                  disabled={!replyText.trim() || loading}
                >
                  <Send size={16} color="white" />
                  <Text style={styles.sendReplyText}>{t('video.reply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Render replies recursively */}
          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply: any) => renderComment(reply, depth + 1))}
            </View>
          )}
          
          {/* Render optimistic replies for this comment */}
          {optimisticComments.filter(oc => oc.parent_id === comment.id).map(optimisticReply => 
            renderComment(optimisticReply, depth + 1)
          )}
        </View>
      </View>
    );
  };

  const handleUserProfileNavigation = (userId: string) => {
    if (!userId) return;
    
    setShowComments(false);
    setTimeout(() => {
      router.push(`/user/${userId}`);
    }, 300);
  };

  const renderCommentItem = ({ item }: { item: any }) => renderComment(item, 0);

  return (
    <View style={[styles.container, { height: screenHeight }]}>
      {/* Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={handleVideoPress}
      >
        <VideoPlayer
          ref={videoPlayerRef}
          source={video.video_url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
          style={styles.video}
          shouldPlay={isActive && !userPaused && isFocused}
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
      
      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      
      {/* Right Side Actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[styles.actionButton, loading && styles.disabledButton]}
          onPress={handleLike}
          disabled={loading}
        >
          <Heart
            size={28}
            color={isLiked ? '#EF4444' : 'white'}
            fill={isLiked ? '#EF4444' : 'transparent'}
          />
          <Text style={styles.actionText}>{likesCount > 999 ? `${(likesCount/1000).toFixed(1)}k` : likesCount}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleShowComments}>
          <MessageCircle size={28} color="white" />
          <Text style={styles.actionText}>{commentsCount}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Eye size={28} color="white" />
          <Text style={styles.actionText}>{formatNumber(viewsCount)}</Text>
        </TouchableOpacity>
        
        {userLocation && restaurant?.latitude && restaurant?.longitude && (
          <TouchableOpacity style={styles.actionButton}>
            <MapPin size={28} color="white" />
            <Text style={styles.actionText}>
              {locationService.formatDistance(
                locationService.calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  restaurant.latitude,
                  restaurant.longitude
                )
              )}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Bottom Info */}
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant?.name}</Text>
          <Text style={styles.cuisineType}>{restaurant?.cuisine} • {restaurant?.price_range}</Text>
          
          <View style={styles.metaInfo}>
            <View style={styles.ratingContainer}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.rating}>{restaurant?.rating || 0}</Text>
            </View>
            <Text style={styles.location}>{restaurant?.city}, {restaurant?.country}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setShowBooking(true)}
        >
          <Calendar size={16} color="white" />
          <Text style={styles.bookButtonText}>Book</Text>
        </TouchableOpacity>
      </View>
      
      <BookingModal
        visible={showBooking}
        restaurant={restaurant}
        onClose={() => setShowBooking(false)}
      />

      {/* Comments Modal */}
      {showComments && (
        <Modal
          visible={showComments}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowComments(false)}
        >
          <SafeAreaView style={styles.fullScreenModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowComments(false)}
              >
                <X size={24} color="#2D3748" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Comments</Text>
              <View style={styles.placeholder} />
            </View>
            
            <View style={styles.commentsCount}>
              <Text style={styles.commentsCountText}>{commentsCount} comments</Text>
            </View>
            <View style={styles.commentsRefreshContainer}>
              <TouchableOpacity 
                style={[styles.refreshButton, refreshing && styles.refreshingButton]} 
                onPress={handleRefreshComments}
                disabled={refreshing}
              >
                <RefreshCw 
                  size={16} 
                  color="#4A5568" 
                  style={refreshing ? styles.rotatingRefresh : undefined} 
                />
                <Text style={styles.refreshButtonText}>
                  {refreshing ? t('video.refreshing') : t('video.refreshComments')}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.commentsContent}>
              {comments.length > 0 || optimisticComments.length > 0 ? (
                <FlatList
                  data={[...optimisticComments.filter(oc => !oc.parent_id), ...comments]}
                  renderItem={renderCommentItem}
                  keyExtractor={(item) => item.id}
                  style={styles.commentsList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.commentsListContent}
                />
              ) : (
                <View style={styles.emptyComments}>
                  <MessageCircle size={64} color="#D1D5DB" />
                  <Text style={styles.emptyCommentsTitle}>{t('video.noComments')}</Text>
                  <Text style={styles.emptyCommentsSubtitle}>{t('video.noCommentsText')}</Text>
                </View>
              )}
            </View>
            
            {user && (
              <View style={styles.commentInputContainer}>
                <View style={styles.commentInput}>
                  <Image 
                    source={{ uri: user?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg' }} 
                    style={styles.commentInputAvatar} 
                  />
                  <TextInput
                    style={styles.commentTextInput}
                    placeholder="Share your thoughts..."
                    placeholderTextColor="#94A3B8"
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity 
                    style={[
                      styles.sendButton, 
                      { 
                        backgroundColor: newComment.trim() && !loading ? '#f29056' : '#F3F4F6',
                        opacity: newComment.trim() && !loading ? 1 : 0.7 
                      }
                    ]} 
                    onPress={() => handleAddComment(newComment)}
                    disabled={!newComment.trim() || loading}
                  >
                    <Send size={18} color={newComment.trim() && !loading ? 'white' : '#94A3B8'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
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
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: '25%',
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  restaurantInfo: {
    gap: 8,
  },
  restaurantName: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: 'white',
  },
  cuisineType: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  location: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  bookButton: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    top: 16,
    bottom: 16,
    justifyContent: 'center',
    padding: 4,
  },
  commentsRefreshContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  refreshingButton: {
    opacity: 0.7,
  },
  rotatingRefresh: {
    transform: [{ rotate: '45deg' }],
  },
  refreshButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  commentsCount: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commentsCountText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  commentsContent: {
    flex: 1,
    backgroundColor: 'white',
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  replyComment: {
    borderBottomWidth: 0,
    paddingVertical: 8,
  },
  highlightedComment: {
    backgroundColor: 'rgba(242, 144, 86, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f29056',
  },
  optimisticComment: {
    opacity: 0.7,
    backgroundColor: 'rgba(242, 144, 86, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optimisticAvatar: {
    opacity: 0.7,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clickableUser: {
    color: '#f29056',
    fontFamily: 'Poppins-SemiBold',
  },
  commentText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 6,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  commentTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  replyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyInputContainer: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  replyTextInput: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    minHeight: 40,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelReplyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  cancelReplyText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  sendReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f29056',
    gap: 4,
  },
  sendReplyText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  emptyComments: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyCommentsTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 24,
    marginBottom: 12,
  },
  emptyCommentsSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  commentInputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentInputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    maxHeight: 120,
    paddingVertical: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
});