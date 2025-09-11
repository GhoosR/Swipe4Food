import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar, Clock, Users, Phone, MessageSquare, Check, Circle as XCircle, Mail } from 'lucide-react-native';
import { api } from '@/services/supabaseApi';

interface BookingManagementModalProps {
  visible: boolean;
  booking: any;
  onClose: () => void;
  onUpdateStatus: () => void;
}

export default function BookingManagementModal({ 
  visible, 
  booking, 
  onClose, 
  onUpdateStatus 
}: BookingManagementModalProps) {
  const [loading, setLoading] = useState(false);

  if (!booking) return null;

  const handleStatusUpdate = async (status: 'confirmed' | 'cancelled') => {
    setLoading(true);
    try {
      await api.updateBookingStatus(booking.id, status);
      
      Alert.alert(
        'Success',
        `Booking has been ${status === 'confirmed' ? 'confirmed' : 'cancelled'}`,
        [{ 
          text: 'OK', 
          onPress: () => {
            onUpdateStatus(); // Update the bookings list
            onClose(); // Close the modal
          }
        }]
      );
    } catch (error) {
      console.error('Failed to update booking status:', error);
      Alert.alert('Error', 'Failed to update booking status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
            </View>
          </View>

          {/* Customer Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Users size={20} color="#4A5568" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Customer</Text>
                  <Text style={styles.infoValue}>
                    {booking.profiles?.name || 'Unknown Customer'}
                  </Text>
                </View>
              </View>

              {booking.profiles?.email && (
                <View style={styles.infoRow}>
                  <Mail size={20} color="#4A5568" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{booking.profiles.email}</Text>
                  </View>
                </View>
              )}

              {booking.contact_phone && (
                <View style={styles.infoRow}>
                  <Phone size={20} color="#4A5568" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{booking.contact_phone}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Booking Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Details</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Calendar size={20} color="#4A5568" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{formatDate(booking.booking_date || booking.date)}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Clock size={20} color="#4A5568" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>{booking.booking_time || booking.time}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Users size={20} color="#4A5568" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Party Size</Text>
                  <Text style={styles.infoValue}>{booking.guests} guests</Text>
                </View>
              </View>

              {booking.special_requests && (
                <View style={styles.infoRow}>
                  <MessageSquare size={20} color="#4A5568" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Special Requests</Text>
                    <Text style={styles.infoValue}>{booking.special_requests}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Booking Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Timeline</Text>
            <View style={styles.infoCard}>
              <Text style={styles.timelineText}>
                Booking created: {new Date(booking.created_at).toLocaleString()}
              </Text>
              {booking.updated_at !== booking.created_at && (
                <Text style={styles.timelineText}>
                  Last updated: {new Date(booking.updated_at).toLocaleString()}
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          {booking.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={() => handleStatusUpdate('confirmed')}
                disabled={loading}
              >
                <Check size={20} color="white" />
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleStatusUpdate('cancelled')}
                disabled={loading}
              >
                <XCircle size={20} color="#EF4444" />
                <Text style={styles.cancelButtonText}>
                  {loading ? 'Cancelling...' : 'Cancel Booking'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#94A3B8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    lineHeight: 22,
  },
  timelineText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 8,
  },
  userInfoButton: {
    padding: 2,
  },
  linkText: {
    color: '#f29056',
    textDecorationLine: 'underline',
  },
  actionButtons: {
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#10B981',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#EF4444',
  },
});