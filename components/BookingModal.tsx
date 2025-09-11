import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar, Clock, Users, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/services/supabaseApi';

const { width, height } = Dimensions.get('window');

interface Restaurant {
  id: string;
  name: string;
  available_slots: string[];
}

interface BookingModalProps {
  visible: boolean;
  restaurant: any;
  onClose: () => void;
}

// Generate next 7 days
const generateDates = () => {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    dates.push({
      date: date.getDate().toString().padStart(2, '0'),
      fullDate: date.toISOString().split('T')[0], // YYYY-MM-DD format
      day: i === 0 ? 'Today' : dayNames[date.getDay()],
      isToday: i === 0,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    });
  }
  
  return dates;
};

const partySize = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function BookingModal({ visible, restaurant, onClose }: BookingModalProps) {
  const dates = generateDates();
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(dates[0].fullDate);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const { user } = useAuth();

  // Reset modal state when it opens
  React.useEffect(() => {
    if (visible) {
      setSelectedDate(dates[0].fullDate);
      setSelectedTime('');
      setSelectedGuests(2);
      setCurrentStep(1);
      setSpecialRequests('');
      setContactPhone('');
    }
  }, [visible]);

  const handleBooking = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a booking');
      return;
    }
    
    if (!selectedTime) {
      Alert.alert('Error', 'Please select a time for your booking');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        restaurant_id: restaurant.id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        guests: selectedGuests,
        special_requests: specialRequests.trim() || null,
        contact_phone: contactPhone.trim() || null,
      };
      
      await api.createBooking(bookingData);
      
      setCurrentStep(3);
      setTimeout(() => {
        onClose();
        setCurrentStep(1);
        setSelectedTime('');
        setSpecialRequests('');
        setContactPhone('');
      }, 2000);
    } catch (error) {
      console.error('Failed to create booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedDateInfo = () => {
    const dateInfo = dates.find(d => d.fullDate === selectedDate);
    if (!dateInfo) return 'Unknown date';
    
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    return `${monthNames[dateInfo.month - 1]} ${dateInfo.date}, ${dateInfo.year}`;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>{t('booking.selectDate')}</Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.chooseDate')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.dateContainer}>
                  {dates.map((dateItem) => (
                    <TouchableOpacity
                      key={dateItem.fullDate}
                      style={[
                        styles.dateCard,
                        selectedDate === dateItem.fullDate && styles.selectedDateCard
                      ]}
                      onPress={() => setSelectedDate(dateItem.fullDate)}
                    >
                      <Text style={[
                        styles.dateText,
                        selectedDate === dateItem.fullDate && styles.selectedDateText
                      ]}>
                        {dateItem.date}
                      </Text>
                      <Text style={[
                        styles.dayText,
                        selectedDate === dateItem.fullDate && styles.selectedDayText
                      ]}>
                        {dateItem.day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.partySize')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.guestContainer}>
                  {partySize.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.guestCard,
                        selectedGuests === size && styles.selectedGuestCard
                      ]}
                      onPress={() => setSelectedGuests(size)}
                    >
                      <Users
                        size={20}
                        color={selectedGuests === size ? 'white' : '#4A5568'}
                      />
                      <Text style={[
                        styles.guestText,
                        selectedGuests === size && styles.selectedGuestText
                      ]}>
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>{t('booking.availableTimes')}</Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.time')}</Text>
              <View style={styles.timeGrid}>
                {(restaurant.available_slots && restaurant.available_slots.length > 0 ? restaurant.available_slots : ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']).map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeCard,
                      selectedTime === time && styles.selectedTimeCard
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Clock
                      size={16}
                      color={selectedTime === time ? 'white' : '#4A5568'}
                    />
                    <Text style={[
                      styles.timeText,
                      selectedTime === time && styles.selectedTimeText
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {(!restaurant.available_slots || restaurant.available_slots.length === 0) && (
                <Text style={styles.noSlotsText}>
                  Using default time slots. Restaurant owner can customize these in settings.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.contactPhoneOpt')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Your phone number"
                placeholderTextColor="#94A3B8"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.specialRequestsOpt')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Any special requests or dietary requirements..."
                placeholderTextColor="#94A3B8"
                value={specialRequests}
                onChangeText={setSpecialRequests}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('booking.bookingSummary')}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('booking.restaurant')}</Text>
                <Text style={styles.summaryValue}>{restaurant.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('booking.date')}</Text>
                <Text style={styles.summaryValue}>{getSelectedDateInfo()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('booking.time')}</Text>
                <Text style={styles.summaryValue}>{selectedTime || 'Not selected'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('booking.guests')}</Text>
                <Text style={styles.summaryValue}>{selectedGuests} {selectedGuests === 1 ? 'person' : 'people'}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentStep(1)}
              >
                <Text style={styles.backButtonText}>{t('common.back')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.bookingButton,
                  (!selectedTime || loading) && styles.disabledButton
                ]}
                onPress={handleBooking}
                disabled={!selectedTime || loading}
              >
                <Text style={styles.bookingButtonText}>
                  {loading ? 'Booking...' : t('booking.confirmBooking')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );

      case 3:
        return (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Check size={32} color="white" />
            </View>
            <Text style={styles.successTitle}>{t('booking.bookingConfirm')}</Text>
            <Text style={styles.successMessage}>
              Your table at {restaurant.name} has been booked for {getSelectedDateInfo()} at {selectedTime}
            </Text>
            <Text style={styles.successSubMessage}>{t('booking.bookingSuccess')}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Table</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStepContent()}
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
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  dateCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 70,
  },
  selectedDateCard: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  dateText: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  selectedDateText: {
    color: 'white',
  },
  dayText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginTop: 4,
  },
  selectedDayText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  guestContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  guestCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 60,
    gap: 4,
  },
  selectedGuestCard: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  guestText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  selectedGuestText: {
    color: 'white',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  selectedTimeCard: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  selectedTimeText: {
    color: 'white',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  continueButton: {
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#4A5568',
  },
  bookingButton: {
    flex: 2,
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  bookingButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f29056',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  successSubMessage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});