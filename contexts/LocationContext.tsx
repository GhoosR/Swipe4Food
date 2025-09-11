import React, { createContext, useContext, useState, useEffect } from 'react';
import { locationService, LocationCoordinates } from '@/services/locationService';

interface LocationContextType {
  userLocation: LocationCoordinates | null;
  locationPermission: boolean;
  loading: boolean;
  requestLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Delay location initialization to avoid blocking app startup
    setTimeout(() => {
      initializeLocation();
    }, 1000);
  }, []);

  const initializeLocation = async () => {
    setLoading(true);
    try {
      const hasPermission = await locationService.requestLocationPermission();
      setLocationPermission(hasPermission);

      if (hasPermission) {
        // Add timeout to prevent hanging
        const locationPromise = locationService.getCurrentLocation();
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 10000); // 10 second timeout
        });
        
        const location = await Promise.race([locationPromise, timeoutPromise]);
        setUserLocation(location);
      }
    } catch (error) {
      console.error('Failed to initialize location:', error);
      setUserLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = async () => {
    setLoading(true);
    try {
      const hasPermission = await locationService.requestLocationPermission();
      setLocationPermission(hasPermission);

      if (hasPermission) {
        const location = await locationService.getCurrentLocation();
        setUserLocation(location);
      }
    } catch (error) {
      console.error('Failed to request location:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshLocation = async () => {
    if (!locationPermission) return;
    
    try {
      const location = await locationService.getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Failed to refresh location:', error);
    }
  };

  return (
    <LocationContext.Provider value={{
      userLocation,
      locationPermission,
      loading,
      requestLocation,
      refreshLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}