import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface AddressInfo {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
}

class LocationService {
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Add timeout to prevent hanging on mobile
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 50,
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 8000);
      });
      
      const location = await Promise.race([locationPromise, timeoutPromise]);

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      // Handle web platform limitation more gracefully
      if (Platform.OS === 'web') {
        console.warn('Location unavailable on web platform:', error);
        return null;
      } else if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('Location request timed out:', error);
        return null;
      } else {
        console.warn('Error getting current location:', error);
        return null;
      }
    }
  }

  async reverseGeocode(coordinates: LocationCoordinates): Promise<AddressInfo | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync(coordinates);
      if (addresses.length > 0) {
        const address = addresses[0];
        return {
          street: address.street || undefined,
          city: address.city || undefined,
          region: address.region || undefined,
          country: address.country || undefined,
          postalCode: address.postalCode || undefined,
          formattedAddress: this.formatAddress(address),
        };
      }
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  private formatAddress(address: Location.LocationGeocodedAddress): string {
    const parts = [];
    
    if (address.street) {
      parts.push(address.street);
    }
    if (address.city) {
      parts.push(address.city);
    }
    if (address.region && address.region !== address.city) {
      parts.push(address.region);
    }
    if (address.country) {
      parts.push(address.country);
    }
    
    return parts.join(', ') || 'Address not available';
  }

  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  }

  // Geocoding for address search (if needed in the future)
  async geocodeAddress(address: string): Promise<LocationCoordinates | null> {
    try {
      const locations = await Location.geocodeAsync(address);
      if (locations.length > 0) {
        return {
          latitude: locations[0].latitude,
          longitude: locations[0].longitude,
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }
}

export const locationService = new LocationService();