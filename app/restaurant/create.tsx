import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, MapPin, Phone, Globe, Clock, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';
import LocationPicker from '@/components/LocationPicker';

const cuisineTypes = [
  'Italian', 'Spanish', 'French', 'Japanese', 'Chinese', 'Indian', 'Mexican',
  'Thai', 'Greek', 'Turkish', 'Lebanese', 'American', 'British', 'German',
  'Korean', 'Vietnamese', 'Mediterranean', 'International'
];

const priceRanges = [
  { value: '€', label: '€ - Budget' },
  { value: '€€', label: '€€ - Moderate' },
  { value: '€€€', label: '€€€ - Expensive' },
  { value: '€€€€', label: '€€€€ - Very Expensive' }
];

const timeSlots = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

const daysOfWeek = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

export default function CreateRestaurantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cuisine: '',
    description: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    country: '',
    price_range: '€€' as '€' | '€€' | '€€€' | '€€€€',
    opening_hours: {} as any,
    available_slots: [] as string[],
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Check if user is authorized
  React.useEffect(() => {
    if (user && user.account_type !== 'business') {
      Alert.alert(
        'Business Account Required',
        'You need a business account to create a restaurant profile.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [user]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    if (!formData.cuisine) {
      Alert.alert('Error', 'Please select a cuisine type');
      return;
    }

    if (!formData.address.trim() || !formData.city.trim() || !formData.country.trim()) {
      Alert.alert('Error', 'Please fill in the complete address');
      return;
    }

    setSaving(true);
    try {
      const restaurant = await api.createRestaurant(formData);
      Alert.alert(
        'Success', 
        'Restaurant created successfully!',
        [{ 
          text: 'OK', 
          onPress: () => router.replace(`/restaurant/${restaurant.id}`)
        }]
      );
    } catch (error) {
      console.error('Failed to create restaurant:', error);
      Alert.alert('Error', 'Failed to create restaurant. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationSelected = (coordinates: any, address: any) => {
    setFormData(prev => ({
      ...prev,
      address: address.street || prev.address,
      city: address.city || prev.city,
      country: address.country || prev.country,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    }));
  };

  const updateOpeningHours = (day: string, hours: string) => {
    setFormData(prev => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: hours
      }
    }));
  };

  const toggleTimeSlot = (slot: string) => {
    setFormData(prev => ({
      ...prev,
      available_slots: prev.available_slots.includes(slot)
        ? prev.available_slots.filter(s => s !== slot)
        : [...prev.available_slots, slot].sort()
    }));
  };

  if (!user || user.account_type !== 'business') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f29056" />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#2D3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Restaurant</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Save size={20} color="white" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Creating...' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Restaurant Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter restaurant name"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Cuisine Type *</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowCuisineModal(true)}
            >
              <Text style={[styles.selectText, !formData.cuisine && styles.placeholderText]}>
                {formData.cuisine || 'Select cuisine type'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Price Range</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowPriceModal(true)}
            >
              <Text style={styles.selectText}>
                {priceRanges.find(p => p.value === formData.price_range)?.label}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe your restaurant..."
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <LocationPicker
            onLocationSelected={handleLocationSelected}
            currentAddress={formData.address ? `${formData.address}, ${formData.city}, ${formData.country}` : undefined}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Street address"
              value={formData.address}
              onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>City *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="City"
                value={formData.city}
                onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Country *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Country"
                value={formData.country}
                onChangeText={(text) => setFormData(prev => ({ ...prev, country: text }))}
              />
            </View>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputWithIcon}>
              <Phone size={20} color="#94A3B8" />
              <TextInput
                style={styles.textInputWithIcon}
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Website</Text>
            <View style={styles.inputWithIcon}>
              <Globe size={20} color="#94A3B8" />
              <TextInput
                style={styles.textInputWithIcon}
                placeholder="https://yourrestaurant.com"
                value={formData.website}
                onChangeText={(text) => setFormData(prev => ({ ...prev, website: text }))}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setShowHoursModal(true)}
          >
            <Clock size={20} color="#4A5568" />
            <Text style={styles.selectText}>Set Opening Hours</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setShowSlotsModal(true)}
          >
            <Clock size={20} color="#4A5568" />
            <Text style={styles.selectText}>
              Available Booking Slots ({formData.available_slots.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Cuisine Modal */}
      <Modal visible={showCuisineModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Cuisine Type</Text>
            <TouchableOpacity onPress={() => setShowCuisineModal(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {cuisineTypes.map((cuisine) => (
              <TouchableOpacity
                key={cuisine}
                style={[
                  styles.modalOption,
                  formData.cuisine === cuisine && styles.selectedOption
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, cuisine }));
                  setShowCuisineModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  formData.cuisine === cuisine && styles.selectedOptionText
                ]}>
                  {cuisine}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Price Range Modal */}
      <Modal visible={showPriceModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Price Range</Text>
            <TouchableOpacity onPress={() => setShowPriceModal(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {priceRanges.map((range) => (
              <TouchableOpacity
                key={range.value}
                style={[
                  styles.modalOption,
                  formData.price_range === range.value && styles.selectedOption
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, price_range: range.value as any }));
                  setShowPriceModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  formData.price_range === range.value && styles.selectedOptionText
                ]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Opening Hours Modal */}
      <Modal visible={showHoursModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Opening Hours</Text>
            <TouchableOpacity onPress={() => setShowHoursModal(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {daysOfWeek.map((day) => (
              <View key={day.key} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <TextInput
                  style={styles.hoursInput}
                  placeholder="e.g., 12:00 - 22:00"
                  value={formData.opening_hours[day.key] || ''}
                  onChangeText={(text) => updateOpeningHours(day.key, text)}
                />
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Available Slots Modal */}
      <Modal visible={showSlotsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Available Booking Slots</Text>
            <TouchableOpacity onPress={() => setShowSlotsModal(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Select the time slots when customers can book tables
            </Text>
            <View style={styles.slotsGrid}>
              {timeSlots.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotChip,
                    formData.available_slots.includes(slot) && styles.selectedSlot
                  ]}
                  onPress={() => toggleTimeSlot(slot)}
                >
                  <Text style={[
                    styles.slotText,
                    formData.available_slots.includes(slot) && styles.selectedSlotText
                  ]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
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
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  selectText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  textInputWithIcon: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
  },
  row: {
    flexDirection: 'row',
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
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedOption: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
  },
  selectedOptionText: {
    color: 'white',
    fontFamily: 'Poppins-SemiBold',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dayLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    width: 100,
  },
  hoursInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    backgroundColor: '#F9FAFB',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedSlot: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  slotText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  selectedSlotText: {
    color: 'white',
  },
});