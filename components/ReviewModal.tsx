import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Star, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';

interface ReviewModalProps {
  visible: boolean;
  restaurant: any;
  onRequestBooking?: () => void;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export default function ReviewModal({ visible, restaurant, onRequestBooking, onClose, onReviewSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState<boolean>(false);
  const [checkingExistingReview, setCheckingExistingReview] = useState<boolean>(false);
  const [hasConfirmedBooking, setHasConfirmedBooking] = useState<boolean>(false);
  const [checkingBooking, setCheckingBooking] = useState<boolean>(false);
  const { user } = useAuth();

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setRating(0);
      setReviewText('');
      setSelectedImages([]);
      setHasExistingReview(false);
      setHasConfirmedBooking(false);
      checkForExistingReview();
      checkForConfirmedBooking();
    }
  }, [visible]);

  const checkForExistingReview = async () => {
    if (!user || !restaurant) return;
    
    setCheckingExistingReview(true);
    try {
      const reviews = await api.getReviews(restaurant.id);
      const userReview = reviews.find((review: any) => review.user_id === user.id);
      setHasExistingReview(!!userReview);
    } catch (error) {
      console.error('Failed to check existing review:', error);
      // Don't block the user if we can't check - let them try to submit
      setHasExistingReview(false);
    } finally {
      setTimeout(() => {
        setCheckingExistingReview(false);
      }, 500);
    }
  };

  const checkForConfirmedBooking = async () => {
    if (!user || !restaurant) return;
    
    setCheckingBooking(true);
    try {
      const hasBooking = await api.hasConfirmedBooking(restaurant.id);
      setHasConfirmedBooking(hasBooking);
    } catch (error) {
      console.error('Failed to check booking status:', error);
      // Don't block the user if we can't check - let them try to submit
      setHasConfirmedBooking(false);
    } finally {
      setTimeout(() => {
        setCheckingBooking(false);
      }, 500);
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to add images to your review.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 3)); // Max 3 images
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to leave a review');
      return;
    }

    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    if (!reviewText.trim()) {
      Alert.alert('Error', 'Please write a review');
      return;
    }

    if (reviewText.trim().length < 10) {
      Alert.alert('Error', 'Please write a more detailed review (at least 10 characters)');
      return;
    }
    setLoading(true);
    
    try {
      // Double-check confirmed booking even if we already checked
      const hasBooking = await api.hasConfirmedBooking(restaurant.id);
      if (!hasBooking) {
        Alert.alert(
          'Booking Required',
          'You can only review restaurants after you have visited with a confirmed booking.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      await api.createReview({
        restaurant_id: restaurant.id,
        rating,
        comment: reviewText.trim(),
        images: selectedImages,
      });

      Alert.alert(
        'Review Submitted!',
        'Thank you for your review. It will help other customers discover this restaurant.',
        [{ text: 'OK', onPress: () => {
          onReviewSubmitted();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Failed to submit review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit review. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setRating(index + 1)}
        style={styles.starButton}
      >
        <Star
          size={32}
          color="#f9c435"
          fill={index < rating ? '#f9c435' : 'transparent'}
        />
      </TouchableOpacity>
    ));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Write a Review</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Restaurant Info */}
          <View style={styles.restaurantInfo}>
            <Image 
              source={{ 
                uri: restaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' 
              }} 
              style={styles.restaurantImage} 
            />
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.restaurantCuisine}>{restaurant.cuisine} • {restaurant.price_range}</Text>
            </View>
          </View>

          {/* Information about review requirements */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Note: You can only review restaurants after your booking has been confirmed and you've visited.
            </Text>
          </View>

          {/* Rating Section */}
          {!hasExistingReview && !checkingExistingReview && (
            <View style={styles.section}>
              {!hasConfirmedBooking && !checkingBooking ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    You need a confirmed booking to review this restaurant.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.sectionTitle}>How was your experience?</Text>
              <View style={styles.starsContainer}>
                {renderStars()}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingText}>
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </Text>
              )}
            </View>
          )}

          {/* Review Text */}
          {!hasExistingReview && <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tell us about your experience</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Share details about the food, service, atmosphere, or anything else that would help other diners..."
              placeholderTextColor="#94A3B8"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={6}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{reviewText.length}/500</Text>
          </View>}

          {/* Photo Section */}
          {!hasExistingReview && <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
            <Text style={styles.sectionSubtitle}>Help others see what to expect</Text>
            
            <View style={styles.photosContainer}>
              {selectedImages.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.selectedPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removeImage(index)}
                  >
                    <X size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {selectedImages.length < 3 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={handleImagePicker}>
                  <ImageIcon size={24} color="#94A3B8" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>}

          {/* Existing Review Message */}
          {hasExistingReview && (
            <View style={styles.existingReviewContainer}>
              <Text style={styles.existingReviewTitle}>You've already reviewed this restaurant</Text>
              <Text style={styles.existingReviewText}>
                You can only submit one review per restaurant. Thank you for sharing your experience!
              </Text>
            </View>
          )}

          {/* Booking Status Message */}
          {!hasExistingReview && !checkingExistingReview && !hasConfirmedBooking && !checkingBooking && (
            <View style={styles.noBookingContainer}>
              <Text style={styles.noBookingTitle}>Booking Required</Text>
              <Text style={styles.noBookingText}>
                You need to have a confirmed booking at this restaurant before you can leave a review. 
                This ensures all reviews come from verified customers.
              </Text>
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => {
                  onClose();
                  // Let the parent component know to open the booking modal instead
                  if (onRequestBooking) {
                    onRequestBooking();
                  }
                }}
              >
                <Text style={styles.bookNowButtonText}>Book a Table</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading Message */}
          {checkingExistingReview && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Checking your review status...</Text>
            </View>
          )}

          {/* Submit Button */}
          {!hasExistingReview && !checkingExistingReview && <TouchableOpacity
            style={[
              styles.submitButton,
              (rating === 0 || !reviewText.trim() || loading) && styles.disabledButton
            ]}
            onPress={handleSubmitReview}
            disabled={rating === 0 || !reviewText.trim() || loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </Text>
          </TouchableOpacity>}
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
  restaurantInfo: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  infoBox: {
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#3B82F6',
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#D97706',
    textAlign: 'center',
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
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    height: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
  },
  selectedPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  existingReviewContainer: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  existingReviewTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#92400E',
    marginBottom: 8,
    textAlign: 'center',
  },
  existingReviewText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  noBookingContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
  },
  noBookingTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#D97706',
    marginBottom: 8,
    textAlign: 'center',
  },
  noBookingText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  bookNowButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookNowButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  loadingContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4B5563',
    textAlign: 'center',
  },
});