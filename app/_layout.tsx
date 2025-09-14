import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSegments } from 'expo-router';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // More robust loading check
    if (loading) {
      console.log('AuthGuard: Still loading, waiting...');
      return;
    }
    
    console.log('AuthGuard: User state:', !!user, 'Segments:', segments);

    const inAuthGroup = segments[0] === '(auth)';
    const inSubscriptionGroup = segments[0] === 'subscription';

    if (!user && !inAuthGroup && !inSubscriptionGroup) {
      // User is not signed in and not in auth group, redirect to login
      console.log('AuthGuard: No user, redirecting to login');
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // User is signed in but in auth group
      // Only redirect if they're not in account-type selection
      if (segments[1] !== 'account-type') {
        console.log('AuthGuard: User authenticated, redirecting to main app');
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, segments]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <SafeAreaProvider>
        <AuthProvider>
          <LanguageProvider>
            <NotificationProvider>
              <AuthGuard>
                <LocationProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="restaurant" />
                    <Stack.Screen name="subscription" />
                    <Stack.Screen name="user" />
                    <Stack.Screen name="video" />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                </LocationProvider>
              </AuthGuard>
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
      </SafeAreaProvider>
      <StatusBar style="light" />
    </>
  );
}