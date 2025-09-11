import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { locationService, LocationCoordinates, AddressInfo } from '@/services/locationService';

interface LocationPickerProps {
  onLocationSelected: (coordinates: LocationCoordinates, address: AddressInfo) => void;
  currentAddress?: string;
  style?: any;
}

export default function LocationPicker({ onLocationSelected, currentAddress, style }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const hasPermission = await locationService.requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to automatically fill in your restaurant address.',
          [{ text: 'OK' }]
        );
        return;
      }

      const coordinates = await locationService.getCurrentLocation();
      if (!coordinates) {
        Alert.alert('Error', 'Unable to get your current location. Please try again.');
        return;
      }

      const address = await locationService.reverseGeocode(coordinates);
      if (!address) {
        Alert.alert('Error', 'Unable to get address information for this location.');
        return;
      }

      onLocationSelected(coordinates, address);
      
      Alert.alert(
        'Location Updated',
        `Address set to: ${address.formattedAddress}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.locationButton}
        onPress={handleGetCurrentLocation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#f29056" />
        ) : (
          <Navigation size={20} color="#f29056" />
        )}
        <Text style={styles.locationButtonText}>
          {loading ? 'Getting location...' : 'Use Current Location'}
        </Text>
      </TouchableOpacity>
      
      {currentAddress && (
        <View style={styles.currentAddressContainer}>
          <MapPin size={16} color="#4A5568" />
          <Text style={styles.currentAddressText}>{currentAddress}</Text>
        </View>
      )}
      
      <Text style={styles.helpText}>
        This will automatically fill in your address, city, and country based on your current location.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    borderWidth: 1,
    borderColor: '#f29056',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  currentAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  currentAddressText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});