import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, MapPin, Star, Navigation, X } from 'lucide-react-native';
import NotificationBell from '@/components/NotificationBell';
import { useLocation } from '@/contexts/LocationContext';
import { locationService } from '@/services/locationService';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/services/supabaseApi';
import { useRouter } from 'expo-router';

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

const popularLocations = [
  'Madrid, Spain',
  'Barcelona, Spain', 
  'Granada, Spain',
  'Valencia, Spain',
  'Seville, Spain',
  'New York, USA',
  'London, UK',
  'Paris, France',
  'Rome, Italy',
  'Tokyo, Japan'
];

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { userLocation } = useLocation();

  useEffect(() => {
    loadRestaurants();
  }, [userLocation, searchLocation]);

  const loadRestaurants = async () => {
    try {
      // Use search location if available, otherwise use user's current location
      const coords = searchLocation || userLocation;
      const data = await api.getRestaurants(
        coords?.latitude,
        coords?.longitude,
        50 // 50km radius
      );
      setRestaurants(data);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNearMe = async () => {
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please enable location access to find restaurants near you.'
      );
      return;
    }

    setLocationLoading(true);
    setSelectedLocation('Near Me');
    setLocationQuery('Near Me');
    setSearchLocation(userLocation);
    setShowLocationSuggestions(false);
    
    try {
      await loadRestaurants();
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationSearch = async (location: string) => {
    if (!location.trim()) return;

    setLocationLoading(true);
    setSelectedLocation(location);
    setLocationQuery(location);
    setShowLocationSuggestions(false);

    try {
      // If it's "Near Me", use current location
      if (location === 'Near Me') {
        if (userLocation) {
          setSearchLocation(userLocation);
        } else {
          Alert.alert('Error', 'Current location not available');
          return;
        }
      } else {
        // Geocode the location string to get coordinates
        const coordinates = await locationService.geocodeAddress(location);
        if (coordinates) {
          setSearchLocation(coordinates);
        } else {
          Alert.alert('Location Not Found', 'Could not find the specified location. Please try a different search.');
          setSelectedLocation(null);
          setLocationQuery('');
          return;
        }
      }
      
      await loadRestaurants();
    } catch (error) {
      console.error('Location search failed:', error);
      Alert.alert('Error', 'Failed to search location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const clearLocationFilter = () => {
    setSelectedLocation(null);
    setLocationQuery('');
    setSearchLocation(null);
    setShowLocationSuggestions(false);
    loadRestaurants();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear filters to show fresh results
      setSearchQuery('');
      setSelectedCategory('All');
      // Reload restaurants
      await loadRestaurants();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = !searchQuery || 
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.cuisine.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || 
      restaurant.cuisine.toLowerCase().includes(selectedCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

  const getLocationDisplayText = () => {
    if (selectedLocation === 'Near Me') {
      return 'Near Me';
    }
    return selectedLocation || 'Search by location...';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.discover')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={20} color="#f29056" />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Search Bars */}
      <View style={styles.searchContainer}>
        {/* Restaurant Search */}
        <View style={styles.searchBar}>
          <Search size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search.searchRestaurants')}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Location Search */}
        <View style={styles.locationSearchContainer}>
          <View style={styles.locationSearchBar}>
            <MapPin size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.searchLocation')}
              placeholderTextColor="#94A3B8"
              value={locationQuery}
              onChangeText={(text) => {
                setLocationQuery(text);
                setShowLocationSuggestions(text.length > 0);
              }}
              onSubmitEditing={() => handleLocationSearch(locationQuery)}
            />
            {selectedLocation && (
              <TouchableOpacity onPress={clearLocationFilter} style={styles.clearButton}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Near Me Button */}
          <TouchableOpacity 
            style={[
              styles.nearMeButton,
              selectedLocation === 'Near Me' && styles.nearMeButtonActive
            ]}
            onPress={handleNearMe}
            disabled={locationLoading}
          >
            {locationLoading && selectedLocation === 'Near Me' ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Navigation size={16} color={selectedLocation === 'Near Me' ? 'white' : '#f29056'} />
            )}
            <Text style={[
              styles.nearMeButtonText,
              selectedLocation === 'Near Me' && styles.nearMeButtonTextActive
            ]}>
              {t('search.nearMe')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location Suggestions */}
        {showLocationSuggestions && (
          <View style={styles.locationSuggestions}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.suggestionsContainer}>
                {popularLocations
                  .filter(location => 
                    location.toLowerCase().includes(locationQuery.toLowerCase())
                  )
                  .slice(0, 6)
                  .map((location) => (
                    <TouchableOpacity
                      key={location}
                      style={styles.suggestionChip}
                      onPress={() => handleLocationSearch(location)}
                    >
                      <MapPin size={14} color="#4A5568" />
                      <Text style={styles.suggestionText}>{location}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      <ScrollView 
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
        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categories}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.name && styles.selectedChip
                  ]}
                  onPress={() => setSelectedCategory(category.name)}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category.name && styles.selectedCategoryText
                  ]}>
                    {category.emoji} {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Results */}
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionTitle}>
              {selectedLocation 
                ? selectedLocation === 'Near Me' 
                  ? t('search.restaurantsNear') 
                  : `${t('search.restaurantsIn')} ${selectedLocation}`
                : t('search.popularRestaurants')
              }
            </Text>
            {locationLoading && (
              <ActivityIndicator size="small" color="#f29056" />
            )}
          </View>
          
          {loading ? (
            <Text style={styles.loadingText}>Loading restaurants...</Text>
          ) : filteredRestaurants.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('search.noRestaurantsFound')}</Text>
              <Text style={styles.emptyText}>
                {selectedLocation 
                  ? selectedLocation === 'Near Me' 
                    ? t('search.noRestaurantsNearby') 
                    : t('search.noRestaurantsLocation')
                  : t('search.adjustSearch')
                }
              </Text>
            </View>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <TouchableOpacity 
                key={restaurant.id} 
                style={styles.restaurantCard}
                onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: restaurant.image_url || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg' }} 
                  style={styles.restaurantImage} 
                />
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantCuisine}>{restaurant.cuisine} • {restaurant.price_range}</Text>
                  
                  <View style={styles.restaurantMeta}>
                    <View style={styles.ratingContainer}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.rating}>{restaurant.rating}</Text>
                    </View>
                    
                    <View style={styles.distanceContainer}>
                      <MapPin size={14} color="#94A3B8" />
                      <Text style={styles.distance}>
                        {userLocation && restaurant.latitude && restaurant.longitude
                          ? locationService.formatDistance(
                              locationService.calculateDistance(
                                searchLocation?.latitude || userLocation.latitude,
                                searchLocation?.longitude || userLocation.longitude,
                                restaurant.latitude,
                                restaurant.longitude
                              )
                            )
                          : 'Distance unknown'
                        }
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  locationSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  nearMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#f29056',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  nearMeButtonActive: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  nearMeButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  nearMeButtonTextActive: {
    color: 'white',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
  },
  clearButton: {
    padding: 4,
  },
  locationSuggestions: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  categoriesContainer: {
    marginBottom: 24,
  },
  categories: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedChip: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  selectedCategoryText: {
    color: 'white',
  },
  resultsContainer: {
    paddingHorizontal: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  restaurantCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  restaurantName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  restaurantCuisine: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distance: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 120,
  },
});