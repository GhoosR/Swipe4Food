import React, { useState } from 'react';
import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, Users, MapPin, Phone, MessageSquare, Mail, Navigation } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { api } from '@/services/supabaseApi';
import { useLanguage } from '@/contexts/LanguageContext';
import BookingManagementModal from '@/components/BookingManagementModal';

interface Booking {
  id: string;
  restaurant_id: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  special_requests?: string;
  contact_phone?: string;
  created_at: string;
  user_id?: string;
  restaurants?: {
    name: string;
    image_url?: string;
    city: string;
    country: string;
    phone?: string;
  };
  profiles?: {
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showBookingManagementModal, setShowBookingManagementModal] = useState(false);
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();
  const { userLocation } = useLocation();

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookings();
    } finally {
      setRefreshing(false);
    }
  };

  const loadBookings = async () => {
    if (!user) return;
    
    // Use a Map to track unique bookings by ID
    const bookingsMap = new Map<string, Booking>();
    
    let allBookings: Booking[] = [];
    
    try {
      if (user.account_type === 'business') {
        // Load restaurant bookings for business owners
        const userRestaurant = await api.getRestaurantByOwnerId(user.id);
        if (userRestaurant) {
          const restaurantBookings = await api.getRestaurantBookings(userRestaurant.id);
          // Add restaurant bookings to map
          restaurantBookings.forEach(booking => {
            bookingsMap.set(booking.id, booking);
          });
        }
        
        // Also load personal bookings made by the business user at other restaurants
        const personalBookings = await api.getUserBookings();
        
        // Add personal bookings to map (will overwrite if there are duplicates)
        personalBookings.forEach(booking => {
          bookingsMap.set(booking.id, booking);
        });
        
        // Convert map values back to array
        setBookings(Array.from(bookingsMap.values()));
      } else {
        // Load user's personal bookings
        const userBookings = await api.getUserBookings();
        setBookings(userBookings);
      }
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingCardPress = (booking: Booking) => {
    if (user?.account_type === 'business') {
      setSelectedBooking(booking);
      setShowBookingManagementModal(true);
    }
  };

  const handleBookingStatusUpdate = () => {
    // Immediately refresh the bookings list
    setLoading(true);
    loadBookings().finally(() => {
      setLoading(false);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10B981';
      case 'pending':
        return '#f29056';
      case 'cancelled':
        return '#EF4444';
      case 'completed':
        return '#6B7280';
      case 'no_show':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      case 'no_show':
        return 'No Show';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Filter bookings based on user type and tab
  const getFilteredBookings = () => {
    if (user?.account_type === 'business') {
      // For business users, separate restaurant bookings (where they're the owner) from personal bookings
      if (activeTab === 'upcoming') {
        // Show confirmed and pending bookings that are upcoming (both restaurant and personal)
        const now = new Date();
        return bookings.filter(booking => {
          const bookingDateStr = booking.date || booking.booking_date;
          const bookingTimeStr = booking.time || booking.booking_time;
          
          if (!bookingDateStr || !bookingTimeStr) return false;
          
          const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
          const isUpcoming = bookingDateTime >= now;
          const isActiveStatus = booking.status === 'confirmed' || booking.status === 'pending';
          
          return isUpcoming && isActiveStatus;
        }).sort((a, b) => {
          // Sort by date and time
          const dateA = new Date(`${(a.date || a.booking_date)}T${(a.time || a.booking_time)}`);
          const dateB = new Date(`${(b.date || b.booking_date)}T${(b.time || b.booking_time)}`);
          return dateA.getTime() - dateB.getTime();
        });
      } else {
        // Show past bookings or completed/cancelled ones
        const now = new Date();
        return bookings.filter(booking => {
          const bookingDateStr = booking.date || booking.booking_date;
          const bookingTimeStr = booking.time || booking.booking_time;
          
          if (!bookingDateStr || !bookingTimeStr) return false;
          
          const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
          const isPast = bookingDateTime < now;
          const isCompletedStatus = booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show';
          
          return isPast || isCompletedStatus;
        }).sort((a, b) => {
          // Sort by date and time (most recent first)
          const dateA = new Date(`${(a.date || a.booking_date)}T${(a.time || a.booking_time)}`);
          const dateB = new Date(`${(b.date || b.booking_date)}T${(b.time || b.booking_time)}`);
          return dateB.getTime() - dateA.getTime();
        });
      }
    } else {
      // For regular users, use existing logic
      if (activeTab === 'upcoming') {
        const now = new Date();
        return bookings.filter(booking => {
          const bookingDateStr = booking.date || booking.booking_date;
          const bookingTimeStr = booking.time || booking.booking_time;
          
          if (!bookingDateStr || !bookingTimeStr) return false;
          
          const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
          return bookingDateTime >= now && booking.status !== 'cancelled' && booking.status !== 'completed';
        }).sort((a, b) => {
          const dateA = new Date(`${(a.date || a.booking_date)}T${(a.time || a.booking_time)}`);
          const dateB = new Date(`${(b.date || b.booking_date)}T${(b.time || b.booking_time)}`);
          return dateA.getTime() - dateB.getTime();
        });
      } else {
        const now = new Date();
        return bookings.filter(booking => {
          const bookingDateStr = booking.date || booking.booking_date;
          const bookingTimeStr = booking.time || booking.booking_time;
          
          if (!bookingDateStr || !bookingTimeStr) return false;
          
          const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
          return bookingDateTime < now || booking.status === 'cancelled' || booking.status === 'completed';
        }).sort((a, b) => {
          const dateA = new Date(`${(a.date || a.booking_date)}T${(a.time || a.booking_time)}`);
          const dateB = new Date(`${(b.date || b.booking_date)}T${(b.time || b.booking_time)}`);
          return dateB.getTime() - dateA.getTime();
        });
      }
    }
  };

  const displayBookings = getFilteredBookings();

  // Separate functions to get counts for each tab
  const getUpcomingCount = () => {
    if (user?.account_type === 'business') {
      const now = new Date();
      return bookings.filter(booking => {
        const bookingDateStr = booking.date || booking.booking_date;
        const bookingTimeStr = booking.time || booking.booking_time;
        
        if (!bookingDateStr || !bookingTimeStr) return false;
        
        const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
        const isUpcoming = bookingDateTime >= now;
        const isActiveStatus = booking.status === 'confirmed' || booking.status === 'pending';
        
        return isUpcoming && isActiveStatus;
      }).length;
    } else {
      const now = new Date();
      return bookings.filter(booking => {
        const bookingDateStr = booking.date || booking.booking_date;
        const bookingTimeStr = booking.time || booking.booking_time;
        
        if (!bookingDateStr || !bookingTimeStr) return false;
        
        const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
        return bookingDateTime >= now && booking.status !== 'cancelled' && booking.status !== 'completed';
      }).length;
    }
  };

  const getPastCount = () => {
    if (user?.account_type === 'business') {
      const now = new Date();
      return bookings.filter(booking => {
        const bookingDateStr = booking.date || booking.booking_date;
        const bookingTimeStr = booking.time || booking.booking_time;
        
        if (!bookingDateStr || !bookingTimeStr) return false;
        
        const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
        const isPast = bookingDateTime < now;
        const isCompletedStatus = booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show';
        
        return isPast || isCompletedStatus;
      }).length;
    } else {
      const now = new Date();
      return bookings.filter(booking => {
        const bookingDateStr = booking.date || booking.booking_date;
        const bookingTimeStr = booking.time || booking.booking_time;
        
        if (!bookingDateStr || !bookingTimeStr) return false;
        
        const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);
        return bookingDateTime < now || booking.status === 'cancelled' || booking.status === 'completed';
      }).length;
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.updateBookingStatus(bookingId, 'cancelled');
              await loadBookings(); // Refresh the list
              Alert.alert('Success', 'Your booking has been cancelled.');
            } catch (error) {
              console.error('Failed to cancel booking:', error);
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRouteToRestaurant = async (booking: Booking) => {
    const restaurant = booking.restaurants;
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

  const isRestaurantBooking = (booking: Booking) => {
    // If booking has a profiles field, it's a restaurant booking (customer booked at their restaurant)
    return booking.profiles !== undefined;
  };
  
  const isPersonalBooking = (booking: Booking) => {
    // If booking has a restaurants field, it's a personal booking (business owner booked at another restaurant)
    return booking.restaurants !== undefined && !isRestaurantBooking(booking);
  };

  const renderBookingCard = (booking: Booking) => (
    <TouchableOpacity 
      style={styles.bookingCard}
      onPress={() => handleBookingCardPress(booking)}
      activeOpacity={user?.account_type === 'business' ? 0.7 : 1}
    >
      <Image 
        source={{ 
          uri: user?.account_type === 'business' 
            ? (isRestaurantBooking(booking)
               ? (booking.profiles?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg')
               : (booking.restaurants?.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg'))
            : (booking.restaurants?.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg')
        }} 
        style={styles.restaurantImage} 
      />
      
      <View style={styles.bookingInfo}>
        <View style={styles.bookingHeader}>
          <Text style={styles.restaurantName}>
            {user?.account_type === 'business' 
              ? (isRestaurantBooking(booking)
                 ? (booking.profiles?.name || 'Unknown Customer')
                 : (booking.restaurants?.name || booking.restaurantName))
              : (booking.restaurants?.name || booking.restaurantName)
            }
          </Text>
          {user?.account_type === 'business' && isPersonalBooking(booking) && (
            <View style={styles.personalBookingBadge}>
              <Text style={styles.personalBookingText}>My Booking</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Calendar size={16} color="#4A5568" />
            <Text style={styles.detailText}>{formatDate(booking.date || booking.booking_date)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Clock size={16} color="#4A5568" />
            <Text style={styles.detailText}>{booking.time || booking.booking_time}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Users size={16} color="#4A5568" />
            <Text style={styles.detailText}>{booking.guests} guests</Text>
          </View>
          
          {user?.account_type === 'business' ? (
            booking.profiles?.email && (
              <View style={styles.detailRow}>
                <Mail size={16} color="#4A5568" />
                <Text style={styles.detailText}>{booking.profiles.email}</Text>
              </View>
            )
          ) : (
            booking.restaurants && (
              <View style={styles.detailRow}>
                <MapPin size={16} color="#4A5568" />
                <Text style={styles.detailText}>
                  {booking.restaurants.city}, {booking.restaurants.country}
                </Text>
              </View>
            )
          )}

          {user?.account_type !== 'business' && booking.restaurants && (
            <View style={styles.detailRow}>
              <MapPin size={16} color="#4A5568" />
              <Text style={styles.detailText}>
                {booking.restaurants.city}, {booking.restaurants.country}
              </Text>
            </View>
          )}

          {user?.account_type !== 'business' && booking.contact_phone && (
            <View style={styles.detailRow}>
              <Phone size={16} color="#4A5568" />
              <Text style={styles.detailText}>{booking.contact_phone}</Text>
            </View>
          )}

          {user?.account_type !== 'business' && booking.special_requests && (
            <View style={styles.detailRow}>
              <MessageSquare size={16} color="#4A5568" />
              <Text style={styles.detailText}>{booking.special_requests}</Text>
            </View>
          )}
        </View>

        {user?.account_type !== 'business' && (
          <View style={styles.actionButtons}>
            {activeTab === 'upcoming' && booking.status !== 'cancelled' && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => handleCancelBooking(booking.id)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            
            {booking.status === 'confirmed' && (
              <TouchableOpacity 
                style={styles.routeButton}
                onPress={() => handleRouteToRestaurant(booking)}
              >
                <Navigation size={16} color="white" />
                <Text style={styles.routeButtonText}>Route</Text>
              </TouchableOpacity>
            )}
            
            {booking.restaurants?.phone && (
              <TouchableOpacity style={styles.contactButton}>
                <Text style={styles.contactButtonText}>Contact</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Bookings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('navigation.bookings')}</Text>
        <NotificationBell />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            {user?.account_type === 'business' ? t('booking.confirmed') : t('booking.upcoming')} ({getUpcomingCount()})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            {user?.account_type === 'business' ? t('booking.history') : t('booking.past')} ({getPastCount()})
          </Text>
        </TouchableOpacity>
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
        {displayBookings.length === 0 && (
          <View style={styles.emptyState}>
            <Calendar size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming'
                ? (user?.account_type === 'business' ? t('booking.noConfirmedBookings') : t('booking.noUpcomingBookings'))
                : (user?.account_type === 'business' ? 'No booking history' : 'No past bookings')
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {user?.account_type === 'business' 
                ? t('booking.customerBookingsText')
                : t('booking.noBookingsText')
              }
            </Text>
          </View>
        )}

        {displayBookings.map(booking => (
          <React.Fragment key={booking.id}>
            {renderBookingCard(booking)}
          </React.Fragment>
        ))}

        <BookingManagementModal
          visible={showBookingManagementModal}
          booking={selectedBooking}
          onClose={() => {
            setShowBookingManagementModal(false);
            // Refresh bookings when modal closes in case status was updated
            handleBookingStatusUpdate();
          }}
          onUpdateStatus={() => {
            // Don't close modal here - let the success alert handle it
            handleBookingStatusUpdate();
          }}
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
    borderColor: '#f29056',
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bookingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  bookingInfo: {
    gap: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: 'white',
  },
  personalBookingBadge: {
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  personalBookingText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  bookingDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#EF4444',
  },
  routeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  routeButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: 'white',
  },
  contactButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f29056',
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: 'white',
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#f29056',
  },
  scrollContent: {
    paddingBottom: 120,
  },
});