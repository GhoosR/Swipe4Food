import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save, MapPin, Phone, Globe, Clock, Camera, X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';
import LocationPicker from '@/components/LocationPicker';
import * as ImagePicker from 'expo-image-picker';

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

export default function EditRestaurantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
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

  const { user } = useAuth();

  useEffect(() => {
    if (id) {
      loadRestaurant();
    }
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRestaurant();
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
      
      // Check if user owns this restaurant
      if (!user || data.owner_id !== user.id) {
        Alert.alert('Error', 'You are not authorized to edit this restaurant');
        router.back();
        return;
      }
      
      setRestaurant(data);
      setFormData({
        name: data.name || '',
        cuisine: data.cuisine || '',
        description: data.description || '',
        phone: data.phone || '',
        website: data.website || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
        price_range: data.price_range || '€€',
        opening_hours: data.opening_hours || {},
        available_slots: data.available_slots || [],
        latitude: data.latitude,
        longitude: data.longitude,
      });
      setImageUrl(data.image_url);
    } catch (error) {
      console.error('Failed to load restaurant:', error);
      Alert.alert('Error', 'Failed to load restaurant details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    if (!formData.address.trim() || !formData.city.trim() || !formData.country.trim()) {
      Alert.alert('Error', 'Please fill in the complete address');
      return;
    }

    setSaving(true);
    try {
      await api.updateRestaurant(id!, {
        ...formData,
        image_url: imageUrl,
      });
      Alert.alert('Success', 'Restaurant updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Failed to update restaurant:', error);
      Alert.alert('Error', 'Failed to update restaurant. Please try again.');
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

  const handleImagePicker = async () => {
    try {
      setUploadingImage(true);
      console.log('Starting restaurant image picker...');
      
      // Check current permission status first
      console.log('Checking current media library permission for restaurant...');
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
          Alert.alert('Permission Required', 'We need access to your photos to update your restaurant banner.');
        }
        setUploadingImage(false);
        return;
      }

      console.log('Launching image picker for restaurant...');
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Restaurant image selected:', asset.uri, 'size:', asset.fileSize);
        
        // Check file size (limit to 10MB)
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select an image smaller than 10MB.');
          return;
        }
        
        console.log('Uploading restaurant image...');
        // Generate a unique filename with restaurant ID for organization
        const fileExtension = asset.mimeType?.includes('png') ? 'png' : 'jpg';
        const fileName = `restaurant-${id}-banner-${Date.now()}.${fileExtension}`;
        
        // Upload the actual image
        const uploadedUrl = await api.uploadImage(asset.uri, fileName, asset.mimeType || 'image/jpeg', 'restaurants');
        
        console.log('Restaurant image uploaded successfully:', uploadedUrl);
        setImageUrl(uploadedUrl);
        setShowImageOptions(false);
        
        Alert.alert('Success', 'Restaurant image updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update restaurant image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update image. Please try again.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      setUploadingImage(true);
      console.log('Starting restaurant camera capture...');
      
      // Check current camera permission status first
      console.log('Checking current camera permission for restaurant...');
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
          Alert.alert('Permission Required', 'We need camera access to take a photo for your restaurant banner.');
        }
        setUploadingImage(false);
        return;
      }

      console.log('Launching camera for restaurant...');
      
      // Add timeout to prevent hanging
      const cameraPromise = ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        exif: false,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Camera timed out')), 30000)
      );
      
      const result = await Promise.race([cameraPromise, timeoutPromise]) as ImagePicker.ImagePickerResult;
      console.log('Restaurant camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Restaurant photo captured:', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType
        });

        // Create filename with proper extension
        const fileExtension = asset.mimeType?.includes('png') ? 'png' : 'jpg';
        const fileName = `restaurant-${id}-camera-${Date.now()}.${fileExtension}`;
        
        // Upload with timeout protection
        const uploadPromise = api.uploadImage(asset.uri, fileName, asset.mimeType, 'restaurants');
        const uploadTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timed out after 60 seconds')), 60000)
        );
        
        const uploadedUrl = await Promise.race([uploadPromise, uploadTimeoutPromise]) as string;
        
        console.log('Restaurant photo uploaded successfully:', uploadedUrl);
        setImageUrl(uploadedUrl);
        setShowImageOptions(false);
        
        Alert.alert('Success', 'Restaurant image updated successfully!');
      }
    } catch (error) {
      console.error('Failed to capture and upload photo:', error);
      setShowImageOptions(false);
      
      let errorMessage = 'Failed to capture restaurant photo. Please try again.';
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
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = () => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove the current restaurant image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setImageUrl(null);
            Alert.alert('Success', 'Restaurant image removed successfully!');
          } 
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Restaurant</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading restaurant...</Text>
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
        <Text style={styles.headerTitle}>Edit Restaurant</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Save size={20} color="white" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.modalTitle}>Update Restaurant Photo</Text>
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
                  <ImageIcon size={24} color="#f29056" />
                </View>
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Choose from Photos</Text>
                  <Text style={styles.modalOptionDescription}>Select a restaurant photo from your gallery</Text>
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
                  <Text style={styles.modalOptionDescription}>Take a new photo of your restaurant</Text>
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
        {/* Restaurant Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant Photo & Avatar</Text>
          
          <View style={styles.bannerContainer}>
            <Image 
              source={{ 
                uri: imageUrl || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
              }} 
              style={styles.bannerImage} 
            />
            
            {uploadingImage ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color="#f29056" />
                <Text style={styles.uploadText}>Uploading...</Text>
              </View>
            ) : (
              <>
                {imageUrl && (
                  <TouchableOpacity 
                    style={styles.deleteImageButton}
                    onPress={handleDeleteImage}
                  >
                    <Trash2 size={20} color="white" />
                  </TouchableOpacity>
                )}
              </>
            )}
            
            <TouchableOpacity 
              style={styles.changeBannerButton}
              onPress={() => setShowImageOptions(true)}
              disabled={uploadingImage}
            >
              <Camera size={20} color="white" />
              <Text style={styles.changeBannerText}>
                {imageUrl ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.bannerHelpText}>
            This photo serves as your restaurant's main image and avatar that appears throughout the app. Choose a high-quality image that represents your restaurant well.
          </Text>
        </View>

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
  bannerContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  bannerImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    marginTop: 8,
  },
  deleteImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBannerButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  changeBannerText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  bannerHelpText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'center',
  },
});