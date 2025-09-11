import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, FlatList, StyleSheet, Platform, ScrollView, TouchableOpacity, Text, Modal, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SlidersHorizontal, MapPin, X, Navigation } from 'lucide-react-native';
import VideoReelCard from '@/components/VideoReelCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { api } from '@/services/supabaseApi';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import NotificationBell from '@/components/NotificationBell';
import FilterSlider from '@/components/FilterSlider';

const { width, height } = Dimensions.get('screen');

const categories = [
  { name: 'All', emoji: '🌍' },
  { name: 'Italian', emoji: '🇮🇹' },
  { name: 'Spanish', emoji: '🇪🇸' },
  { name: 'Japanese', emoji: '🇯🇵' },
  { name: 'Mexican', emoji: '🇲🇽' },
  { name: 'Indian', emoji: '🇮🇳' },
  { name: 'French', emoji: '🇫🇷' },
  { name: 'Chinese', emoji: '🇨🇳' },
  { name: 'Thai', emoji: '🇹🇭' },
  { name: 'Greek', emoji: '🇬🇷' },
  { name: 'Vegetarian', emoji: '🌱' },
  { name: 'Vegan', emoji: '🌱' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRadius, setSelectedRadius] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();
  const { userLocation } = useLocation();
  const isFocused = useIsFocused();
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  const itemHeight = height;
  const VIDEOS_PER_PAGE = 10;

  useEffect(() => {
    if (user) {
      // Small delay to ensure components are mounted
      setTimeout(() => {
        loadInitialVideos();
      }, 300);
    }
  }, [user]);

  useEffect(() => {
    if (user && userLocation) {
      setTimeout(() => {
        loadInitialVideos();
      }, 300);
    }
  }, [userLocation]);

  useEffect(() => {
    // Reload videos when filters change
    if (user) {
      setTimeout(() => {
        loadInitialVideos();
      }, 300);
    }
  }, [selectedCategory, selectedRadius]);
  const loadInitialVideos = async () => {
    try {
      setLoading(true);
      const videoData = await api.getVideos(
        VIDEOS_PER_PAGE, 
        0, 
        userLocation?.latitude,
        userLocation?.longitude,
        selectedRadius,
        selectedCategory === 'All' ? undefined : selectedCategory
      );
      setVideos(videoData);
      setCurrentPage(0);
      setHasMoreVideos(videoData.length === VIDEOS_PER_PAGE);
    } catch (error) {
      console.error('Failed to load initial videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (loadingMore || !hasMoreVideos) return;
    
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const newVideos = await api.getVideos(
        VIDEOS_PER_PAGE, 
        nextPage * VIDEOS_PER_PAGE,
        userLocation?.latitude,
        userLocation?.longitude,
        selectedRadius,
        selectedCategory === 'All' ? undefined : selectedCategory
      );
      
      if (newVideos.length > 0) {
        setVideos(prev => [...prev, ...newVideos]);
        setCurrentPage(nextPage);
        setHasMoreVideos(newVideos.length === VIDEOS_PER_PAGE);
      } else {
        setHasMoreVideos(false);
      }
    } catch (error) {
      console.error('Failed to load more videos:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const openFilters = () => {
    setShowFilters(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeFilters = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setShowFilters(false);
    });
  };

  const handleApplyFilters = () => {
    closeFilters();
    // Trigger video reload with new filters
    setTimeout(() => {
      loadInitialVideos();
    }, 300);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialVideos();
    setRefreshing(false);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }).current;

  const handleEndReached = () => {
    if (hasMoreVideos && !loadingMore) {
      loadMoreVideos();
    }
  };

  const renderItem = ({ item, index }: any) => (
    <VideoReelCard
      video={item}
      isActive={index === currentIndex && isFocused}
      onRestaurantPress={() => router.push(`/restaurant/${item.restaurants.id}`)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with filters */}
      <View style={[styles.header, { top: insets.top }]}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={openFilters}
        >
          <SlidersHorizontal size={24} color="white" />
        </TouchableOpacity>
        
        <NotificationBell color="white" size={24} />
      </View>

      {/* Full Screen Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.filterModal,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <SafeAreaView style={styles.filterContent}>
              {/* Filter Header */}
              <View style={styles.filterHeader}>
                <Text style={styles.filterHeaderTitle}>Filters</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={closeFilters}
                >
                  <X size={24} color="#2D3748" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.filterScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {/* Cuisine Categories */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>🍽️ Cuisine Type</Text>
                  <View style={styles.categoryGrid}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.name}
                        style={[
                          styles.categoryCard,
                          selectedCategory === category.name && styles.selectedCategoryCard
                        ]}
                        onPress={() => setSelectedCategory(category.name)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.categoryCardText,
                          selectedCategory === category.name && styles.selectedCategoryCardText
                        ]}>
                          {category.emoji} {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Distance Filter */}
                {userLocation && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>📍 Search Radius</Text>
                    <View style={styles.radiusContainer}>
                      <Text style={styles.radiusLabel}>Distance: {selectedRadius} km</Text>
                      <View style={styles.radiusSliderContainer}>
                        <FilterSlider
                          value={selectedRadius}
                          onValueChange={setSelectedRadius}
                          minimumValue={5}
                          maximumValue={100}
                          step={5}
                        />
                        <View style={styles.radiusLabels}>
                          <Text style={styles.radiusLabelText}>5 km</Text>
                          <Text style={styles.radiusLabelText}>100 km</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Location Status */}
                {userLocation ? (
                  <View style={styles.locationStatus}>
                    <Navigation size={16} color="#10B981" />
                    <Text style={styles.locationStatusText}>
                      Location enabled - showing nearby restaurants
                    </Text>
                  </View>
                ) : (
                  <View style={styles.locationStatus}>
                    <MapPin size={16} color="#F59E0B" />
                    <Text style={styles.locationStatusText}>
                      Enable location for distance-based filtering
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Apply Button */}
              <View style={styles.filterFooter}>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApplyFilters}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        bounces={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={height}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        getItemLayout={(data, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        initialScrollIndex={0}
        style={styles.flatList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    zIndex: 20,
  },
  filterButton: {
    position: 'absolute',
    left: 20,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 144, 86, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  filterModal: {
    flex: 1,
    backgroundColor: '#faf6ee',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 80,
  },
  filterContent: {
    flex: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  filterHeaderTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScrollView: {
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterSectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCategoryCard: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
    shadowColor: '#f29056',
    shadowOpacity: 0.3,
    transform: [{ scale: 1.05 }],
  },
  categoryCardText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#4A5568',
    textAlign: 'center',
  },
  selectedCategoryCardText: {
    color: 'white',
  },
  radiusContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  radiusLabel: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 20,
    textAlign: 'center',
  },
  radiusSliderContainer: {
    paddingHorizontal: 4,
  },
  radiusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  radiusLabelText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationStatusText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
    flex: 1,
  },
  filterFooter: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  applyButton: {
    backgroundColor: '#f29056',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  applyButtonText: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: 'white',
  },
  flatList: {
    flex: 1,
  },
  selectedCategoryText: {
    color: 'white',
  },
  radiusText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: '#4A5568',
    textAlign: 'center',
  },
  selectedRadiusText: {
    color: 'white',
  },
});