import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Calendar, Heart, MessageCircle, CircleCheck as CheckCircle, X, Check, Circle as XCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';
import { Notification } from '@/types';
import BookingManagementModal from '@/components/BookingManagementModal';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [processingBooking, setProcessingBooking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-refresh notifications when screen is focused
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadNotifications();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const userNotifications = await api.getNotifications();
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      // Small delay to ensure database is updated before other components check
      setTimeout(() => {
        // This will trigger other components to refresh their unread count
      }, 200);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => api.markNotificationAsRead(n.id))
      );
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      
      // Force reload of unread count in other components
      setTimeout(() => {
        loadNotifications();
      }, 500);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleBookingAction = async (notificationId: string, bookingId: string, action: 'confirmed' | 'cancelled') => {
    setProcessingBooking(notificationId);
    try {
      await api.updateBookingStatus(bookingId, action);
      
      // Mark notification as read
      await markAsRead(notificationId);
      
      // Refresh notifications
      await loadNotifications();
      
      Alert.alert(
        'Success',
        `Booking has been ${action === 'confirmed' ? 'confirmed' : 'cancelled'}`
      );
    } catch (error) {
      console.error('Failed to update booking:', error);
      Alert.alert('Error', 'Failed to update booking. Please try again.');
    } finally {
      setProcessingBooking(null);
    }
  };

  const handleViewBookingDetails = async (bookingId: string) => {
    try {
      // Use the new getBooking function that handles permissions and data fetching
      const booking = await api.getBooking(bookingId);
      setSelectedBooking(booking);
      setShowBookingModal(true);
    } catch (error) {
      console.error('Failed to load booking details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load booking details';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleCommentNotificationPress = async (notification: Notification) => {
    if (notification.type === 'new_comment' && notification.data?.video_id) {
      // Mark as read first
      await markAsRead(notification.id);
      
      // Navigate to the video with comments open and highlight the specific comment
      const videoId = notification.data.video_id;
      const commentId = notification.data.comment_id;
      
      router.push({
        pathname: `/video/${videoId}`,
        params: {
          openComments: 'true',
          commentId: commentId || '',
        },
      });
    }
  };

  const handleLikeNotificationPress = async (notification: Notification) => {
    if (notification.type === 'new_like' && notification.data?.video_id) {
      // Mark as read first
      await markAsRead(notification.id);
      
      // Navigate to the video
      const videoId = notification.data.video_id;
      router.push(`/video/${videoId}`);
    }
  };

  const handleBookingStatusUpdate = () => {
    // Refresh notifications with a small delay to ensure database is updated
    setTimeout(() => {
      loadNotifications();
    }, 500);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
        return <Calendar size={20} color="#f29056" />;
      case 'new_like':
        return <Heart size={20} color="#EF4444" />;
      case 'new_comment':
        return <MessageCircle size={20} color="#3B82F6" />;
      default:
        return <Bell size={20} color="#6B7280" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return t('notifications.just_now');
    if (diffInMinutes < 60) return `${diffInMinutes}${t('notifications.minutes_ago')}`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}${t('notifications.hours_ago')}`;
    return `${Math.floor(diffInMinutes / 1440)}${t('notifications.days_ago')}`;
  };

  const renderBookingActions = (notification: Notification) => {
    // Only show booking actions for pending booking requests for business users
    if (notification.type !== 'booking_request' || notification.read || user?.account_type !== 'business') {
      return null;
    }

    const bookingId = notification.data?.booking_id;
    if (!bookingId) return null;

    const isProcessing = processingBooking === notification.id;

    return (
      <View style={styles.bookingActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.confirmAction]}
          onPress={() => handleBookingAction(notification.id, bookingId, 'confirmed')}
          disabled={isProcessing}
        >
          <Check size={16} color="white" />
          <Text style={styles.confirmActionText}>
            {isProcessing ? 'Confirming...' : 'Confirm'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.declineAction]}
          onPress={() => handleBookingAction(notification.id, bookingId, 'cancelled')}
          disabled={isProcessing}
        >
          <XCircle size={16} color="#EF4444" />
          <Text style={styles.declineActionText}>
            {isProcessing ? 'Declining...' : 'Decline'}
          </Text>
        </TouchableOpacity>

      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.some(n => !n.read) && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <CheckCircle size={20} color="#f29056" />
            <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
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
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('notifications.noNotifications')}</Text>
            <Text style={styles.emptySubtitle}>{t('notifications.noNotificationsText')}</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard
              ]}
              onPress={() => {
                if (notification.type === 'new_comment') {
                  handleCommentNotificationPress(notification);
                } else if (notification.type === 'new_like') {
                  handleLikeNotificationPress(notification);
                } else {
                  markAsRead(notification.id);
                }
              }}
            >
              <View style={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
              </View>
              
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {getTimeAgo(notification.created_at)}
                </Text>
                
                {/* Booking Actions for business users */}
                {renderBookingActions(notification)}
                
                {/* View Details button for booking-related notifications */}
                {(notification.type === 'booking_request' || 
                  notification.type === 'booking_confirmed' || 
                  notification.type === 'booking_cancelled') && 
                  notification.data?.booking_id && (
                  <TouchableOpacity
                    style={styles.viewDetailsButton}
                    onPress={() => handleViewBookingDetails(notification.data.booking_id)}
                  >
                    <Text style={styles.viewDetailsText}>{t('notifications.viewDetails')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {!notification.read && (
                <View style={styles.unreadDot} />
              )}
            </TouchableOpacity>
          ))
        )}

        <BookingManagementModal
          visible={showBookingModal}
          booking={selectedBooking}
          onClose={() => setShowBookingModal(false)}
          onUpdateStatus={handleBookingStatusUpdate}
        />
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
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
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
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: 'rgba(242, 144, 86, 0.05)',
    borderLeftWidth: 4,
    borderLeftColor: '#f29056',
    borderWidth: 1,
    borderColor: 'rgba(242, 144, 86, 0.2)',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f29056',
    marginTop: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  confirmAction: {
    backgroundColor: '#10B981',
  },
  confirmActionText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  declineAction: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  declineActionText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#EF4444',
  },
  viewDetailsButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  viewDetailsText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#4B5563',
  },
  viewProfileButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  viewProfileText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#4B5563',
  },
  scrollContent: {
    paddingBottom: 120,
  },
});