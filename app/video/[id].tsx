import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import VideoCard from '@/components/VideoCard';
import { api } from '@/services/supabaseApi';
import VideoPlayer, { VideoPlayerMethods } from '@/components/VideoPlayer';

const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');

export default function VideoScreen() {
  const router = useRouter();
  const { id, openComments, commentId } = useLocalSearchParams();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerMethods>(null);

  useEffect(() => {
    if (id) {
      loadVideo();
    }
  }, [id]);

  const loadVideo = async () => {
    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid video ID');
      router.back();
      return;
    }

    try {
      // Get the specific video directly
      const targetVideo = await api.getVideo(id);
      
      if (!targetVideo) {
        Alert.alert('Error', 'Video not found');
        router.back();
        return;
      }

      setVideo(targetVideo);
    } catch (error) {
      console.error('Failed to load video:', error);
      Alert.alert('Error', 'Failed to load video');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <VideoCard
        video={video}
        isActive={true}
        autoOpenComments={openComments === 'true'}
        highlightCommentId={typeof commentId === 'string' ? commentId : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 50,
    paddingBottom: 20,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});