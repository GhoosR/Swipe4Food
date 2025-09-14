import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import VideoPlayer from '@/components/VideoPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Upload, Store, Check, Play, ExternalLink, Smartphone } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// import * as VideoThumbnails from 'expo-video-thumbnails'; // Temporarily disabled due to module issues
import { api } from '@/services/supabaseApi';
import { useRouter } from 'expo-router';

export default function CreateScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [showVideoDetails, setShowVideoDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Video details form
  const [videoDetails, setVideoDetails] = useState({
    title: '',
    description: '',
  });
  
  // Check if user is a business owner
  const isBusinessUser = user?.account_type === 'business';
  
  // Generate thumbnail from video (temporarily disabled)
  const generateThumbnail = async (videoUri: string) => {
    try {
      console.log('🖼️ Generating thumbnail for video...');
      // Temporarily disabled due to expo-video-thumbnails module issues
      // const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      //   time: 1000, // 1 second into the video
      //   quality: 0.7,
      // });
      // console.log('✅ Thumbnail generated successfully');
      // setVideoThumbnail(uri);
      console.log('⚠️ Thumbnail generation temporarily disabled');
    } catch (error) {
      console.error('❌ Error generating thumbnail:', error);
      // Don't block the flow if thumbnail fails
    }
  };

  // Pick custom thumbnail
  const pickThumbnail = async () => {
    try {
      console.log('🖼️ Starting thumbnail picker...');
      
      // Check permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need access to your media library to select a thumbnail.');
        return;
      }
      
      console.log('🖼️ Launching thumbnail picker...');
      
      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // Video aspect ratio
        quality: 0.8,
      });
      
      console.log('🖼️ Thumbnail picker result:', result.canceled, result.assets?.length);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('🖼️ Thumbnail selected:', asset.uri);
        setVideoThumbnail(asset.uri);
      }
    } catch (error) {
      console.error('❌ Error picking thumbnail:', error);
      Alert.alert('Error', 'Failed to pick thumbnail. Please try again.');
    }
  };

  // Remove custom thumbnail
  const removeThumbnail = () => {
    setVideoThumbnail(null);
  };

  // Pick video from gallery
  const pickVideo = async () => {
    if (!isBusinessUser) return;
    
    try {
      console.log('📱 Starting video picker...');
      
      // Check permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need access to your media library to select videos.');
        return;
      }
      
      console.log('🎬 Launching video picker...');
      
      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false, // Don't edit to preserve quality
        quality: 1,
        videoMaxDuration: 60, // 60 seconds max
      });
      
      console.log('📹 Video picker result:', result.canceled, result.assets?.length);
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        console.log('📊 Selected video details:', {
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType
        });
        
        // Check video duration (max 60 seconds)
        if (asset.duration && asset.duration > 60000) { // 60 seconds in milliseconds
          Alert.alert('Video Too Long', 'Please select a video shorter than 60 seconds.');
          return;
        }
        
        // Check file size (max 100MB for videos)
        const maxSize = 100 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > maxSize) {
          const sizeMB = (asset.fileSize / 1024 / 1024).toFixed(1);
          Alert.alert('File Too Large', `Selected video is ${sizeMB}MB. Please select a video smaller than 100MB.`);
          return;
        }
        
        setSelectedVideo(asset.uri);
        await generateThumbnail(asset.uri);
        setShowVideoDetails(true);
      }
    } catch (error) {
      console.error('❌ Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const resetVideoUpload = () => {
    setSelectedVideo(null);
    setVideoThumbnail(null);
    setShowVideoDetails(false);
    setVideoDetails({ title: '', description: '' });
    setUploadProgress(0);
  };

  const handleVideoUpload = async () => {
    if (!selectedVideo || !videoDetails.title.trim()) {
      Alert.alert('Error', 'Please enter a title for your video');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to upload videos');
      return;
    }

    // Get user's restaurant
    const restaurant = await api.getRestaurantByOwnerId(user.id);
    if (!restaurant) {
      Alert.alert('Restaurant Required', 'You need to create a restaurant profile before uploading videos.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      console.log('📤 Starting video upload process...');
      
      // Create unique filename
      const timestamp = Date.now();
      const fileName = `video-${user.id}-${timestamp}.mp4`;
      
      console.log('☁️ Uploading video to storage...');
      setUploadProgress(30);
      
      // Upload video to Supabase Storage
      const videoUrl = await api.uploadVideoFromUri(
        selectedVideo, 
        fileName, 
        'video/mp4'
      );
      
      console.log('✅ Video uploaded to:', videoUrl);
      setUploadProgress(60);
      
      // Upload thumbnail if available
      let thumbnailUrl = null;
      if (videoThumbnail) {
        try {
          console.log('🖼️ Uploading thumbnail...');
          const thumbnailFileName = `thumb-${user.id}-${timestamp}.jpg`;
          thumbnailUrl = await api.uploadImage(
            videoThumbnail, 
            thumbnailFileName, 
            'image/jpeg', 
            'video-thumbnails'
          );
          console.log('✅ Thumbnail uploaded to:', thumbnailUrl);
        } catch (error) {
          console.error('⚠️ Thumbnail upload failed, continuing without:', error);
          // Don't fail the whole process if thumbnail fails
        }
      }
      
      setUploadProgress(80);
      
      console.log('💾 Creating video record in database...');
      
      // Create video record in database
      const videoRecord = await api.createVideo({
        title: videoDetails.title.trim(),
        description: videoDetails.description.trim() || null,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        status: 'published',
        duration: null, // Could be calculated from video metadata if needed
      }, restaurant.id);
      
      console.log('✅ Video record created:', videoRecord.id);
      setUploadProgress(100);
      
      Alert.alert(
        'Success!', 
        'Your video has been uploaded successfully and is now live on your restaurant profile.',
        [
          { 
            text: 'View Restaurant', 
            onPress: () => {
              resetVideoUpload();
              // Navigate to restaurant page to see the new video
              router.push(`/restaurant/${restaurant.id}`);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Video upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload video. Please try again.';
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCapCutDownload = () => {
    const capCutUrl = Platform.select({
      ios: 'https://apps.apple.com/app/capcut-video-editor/id1500855883',
      android: 'https://play.google.com/store/apps/details?id=com.lemon.lvoverseas',
      default: 'https://capcut.com', // Web fallback
    });

    Linking.openURL(capCutUrl).catch(() => {
      Alert.alert('Error', 'Could not open CapCut download link');
    });
  };

  // Render business-only message for regular users
  if (!isBusinessUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.businessRequiredContainer}>
          <Store size={64} color="#D1D5DB" />
          <Text style={styles.businessRequiredTitle}>{t('create.businessRequired')}</Text>
          <Text style={styles.businessRequiredText}>
            {t('create.businessRequiredText')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show video details form after video is selected
  if (showVideoDetails && selectedVideo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={resetVideoUpload}
          >
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Video Details</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Video Preview */}
          <View style={styles.videoPreviewContainer}>
            <VideoPlayer
              source={selectedVideo}
              style={styles.videoPreview}
              useNativeControls
              resizeMode="contain"
            />
            
            <TouchableOpacity 
              style={styles.changeVideoButton}
              onPress={resetVideoUpload}
            >
              <Text style={styles.changeVideoText}>Change Video</Text>
            </TouchableOpacity>
          </View>

          {/* Video Details Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Video Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Fresh Pasta Making Process"
                placeholderTextColor="#94A3B8"
                value={videoDetails.title}
                onChangeText={(text) => setVideoDetails(prev => ({ ...prev, title: text }))}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{videoDetails.title.length}/100</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe your dish, ingredients, or cooking process..."
                placeholderTextColor="#94A3B8"
                value={videoDetails.description}
                onChangeText={(text) => setVideoDetails(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.characterCount}>{videoDetails.description.length}/500</Text>
            </View>
            
            {/* Thumbnail Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thumbnail (Optional)</Text>
              <Text style={styles.inputSubtext}>
                Upload a custom thumbnail or we'll generate one automatically from your video
              </Text>
              
              {videoThumbnail ? (
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: videoThumbnail }} style={styles.thumbnailPreview} />
                  <View style={styles.thumbnailActions}>
                    <TouchableOpacity 
                      style={styles.thumbnailButton}
                      onPress={pickThumbnail}
                    >
                      <Text style={styles.thumbnailButtonText}>Change Thumbnail</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.thumbnailButton, styles.removeButton]}
                      onPress={removeThumbnail}
                    >
                      <Text style={[styles.thumbnailButtonText, styles.removeButtonText]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.thumbnailUploadButton}
                  onPress={pickThumbnail}
                >
                  <Upload size={24} color="#f29056" />
                  <Text style={styles.thumbnailUploadText}>Upload Custom Thumbnail</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Video Tips */}
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>Tips for Great Videos</Text>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>• Keep videos short and engaging (15-60 seconds)</Text>
              <Text style={styles.tipItem}>• Show your signature dishes or cooking process</Text>
              <Text style={styles.tipItem}>• Good lighting makes your food look appetizing</Text>
              <Text style={styles.tipItem}>• Add music and effects to make it stand out</Text>
              <Text style={styles.tipItem}>• Vertical format works best for mobile viewing</Text>
            </View>
          </View>

          {/* Upload Progress */}
          {uploading && (
            <View style={styles.uploadProgressContainer}>
              <Text style={styles.uploadProgressText}>Uploading... {uploadProgress}%</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
            </View>
          )}

          {/* Upload Button */}
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!videoDetails.title.trim() || uploading) && styles.disabledButton
            ]}
            onPress={handleVideoUpload}
            disabled={!videoDetails.title.trim() || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Check size={20} color="white" />
            )}
            <Text style={styles.uploadButtonText}>
              {uploading ? 'Uploading Video...' : 'Upload Video'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main upload selection screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.mainHeader}>
          <Text style={styles.mainTitle}>Create Content</Text>
          <Text style={styles.mainSubtitle}>Share your restaurant's story through video</Text>
        </View>

        {/* CapCut Promotion */}
        <View style={styles.capCutSection}>
          <View style={styles.capCutHeader}>
            <Smartphone size={32} color="#f29056" />
            <Text style={styles.capCutTitle}>Create Professional Videos</Text>
          </View>
          
          <Text style={styles.capCutDescription}>
            Use CapCut to create stunning restaurant videos with professional editing tools, 
            effects, and music that will attract more customers.
          </Text>
          
          <View style={styles.capCutFeatures}>
            <Text style={styles.featureItem}>• Professional video editing tools</Text>
            <Text style={styles.featureItem}>• Restaurant-focused templates</Text>
            <Text style={styles.featureItem}>• Music and sound effects</Text>
            <Text style={styles.featureItem}>• Text overlays and transitions</Text>
            <Text style={styles.featureItem}>• Export in perfect quality</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.capCutButton}
            onPress={handleCapCutDownload}
          >
            <ExternalLink size={20} color="white" />
            <Text style={styles.capCutButtonText}>Download CapCut</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <Upload size={48} color="#f29056" />
          </View>
          
          <Text style={styles.uploadTitle}>Upload Your Video</Text>
          <Text style={styles.uploadDescription}>
            Choose a video from your device (max 60 seconds) to showcase your restaurant's food and atmosphere
          </Text>
          
          <TouchableOpacity 
            style={styles.selectVideoButton}
            onPress={pickVideo}
          >
            <Upload size={20} color="white" />
            <Text style={styles.selectVideoButtonText}>Select Video</Text>
          </TouchableOpacity>
        </View>

        {/* Video Guidelines */}
        <View style={styles.guidelinesSection}>
          <Text style={styles.guidelinesTitle}>Video Guidelines</Text>
          <View style={styles.guidelinesList}>
            <Text style={styles.guidelineItem}>• Maximum duration: 60 seconds</Text>
            <Text style={styles.guidelineItem}>• Maximum file size: 100MB</Text>
            <Text style={styles.guidelineItem}>• Supported formats: MP4, MOV</Text>
            <Text style={styles.guidelineItem}>• Vertical or square format recommended</Text>
            <Text style={styles.guidelineItem}>• Show food, cooking, or restaurant atmosphere</Text>
          </View>
        </View>

        {/* Bottom spacing for tab bar */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  // Business required view
  businessRequiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  businessRequiredTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  businessRequiredText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Main header
  mainHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  mainTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  // CapCut section
  capCutSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  capCutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  capCutTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  capCutDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 16,
  },
  capCutFeatures: {
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 4,
  },
  capCutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  capCutButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  // Upload section
  uploadSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  selectVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  selectVideoButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  // Guidelines section
  guidelinesSection: {
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
  },
  guidelinesList: {
    gap: 4,
  },
  guidelineItem: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  // Video details form
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  headerPlaceholder: {
    width: 40,
  },
  videoPreviewContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: 'black',
  },
  changeVideoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeVideoText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  formSection: {
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
  inputGroup: {
    marginBottom: 20,
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
  characterCount: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  tipsSection: {
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
  },
  uploadProgressContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  uploadProgressText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f29056',
    borderRadius: 3,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
    gap: 8,
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  uploadButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  // Thumbnail styles
  inputSubtext: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    marginBottom: 12,
  },
  thumbnailContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thumbnailPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  thumbnailActions: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnailButton: {
    flex: 1,
    backgroundColor: '#f29056',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  thumbnailButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  removeButtonText: {
    color: 'white',
  },
  thumbnailUploadButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#f29056',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailUploadText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
    marginTop: 8,
  },
});