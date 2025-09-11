import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { User, Store, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator } from 'react-native';

export default function AccountTypeScreen() {
  const { user, loading: authLoading, updateUserAccountType, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'user' | 'business'>('user');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Redirect to login if no user
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, router, authLoading]);

  // Don't render if still loading or no user
  if (authLoading || !user) {
    return null;
  }

  const handleContinue = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Ensure user is still authenticated before proceeding
      const currentUser = await api.getCurrentUser();
      if (!currentUser) {
        throw new Error('User session expired. Please login again.');
      }
      
      console.log(`Updating account type to: ${selectedType} for user:`, currentUser.id);
      await updateUserAccountType(selectedType);
      
      // Wait for database to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh user data to confirm update
      await refreshUser();
      
      console.log(`Account type successfully updated to: ${selectedType}`);
      
      // Navigate based on account type
      if (selectedType === 'business') {
        console.log('Business account selected - redirecting to subscription plans');
        router.replace('/subscription/plans');
      } else {
        console.log('Food lover account selected - redirecting to main app');
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.error('Error updating account type:', err);
      let errorMessage = 'Failed to update account type. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('session expired')) {
          errorMessage = err.message;
          // Redirect to login after showing error
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        } else {
          errorMessage = err.message;
        }
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state if user is not loaded yet
  if (!user && !loading) {
    return (
      <LinearGradient
        colors={['#faf6ee', '#f5f0e6', '#f0ebe0']}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#f29056" />
            <Text style={styles.loadingText}>Loading your account...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }


  return (
    <LinearGradient
      colors={['#faf6ee', '#f5f0e6', '#f0ebe0']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Store size={32} color={selectedType === 'business' ? '#f29056' : '#6B7280'} />
          <Text style={styles.title}>Choose Account Type</Text>
          <Text style={styles.subtitle}>How do you want to use Swipe4Food?</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.options}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'user' && styles.selectedCard
            ]}
            onPress={() => setSelectedType('user')}
          >
            <View style={styles.optionHeader}>
              <User size={32} color={selectedType === 'user' ? '#f9c435' : '#6B7280'} />
              {selectedType === 'user' && (
                <View style={styles.checkBadge}>
                  <Check size={16} color="white" />
                </View>
              )}
            </View>
            <Text style={[
              styles.optionTitle,
              selectedType === 'user' && styles.selectedTitle
            ]}>
              Food Lover
            </Text>
            <Text style={styles.optionDescription}>
              Discover restaurants, watch videos, and make bookings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'business' && styles.selectedCard
            ]}
            onPress={() => setSelectedType('business')}
          >
            <View style={styles.optionHeader}>
              <Store size={32} color={selectedType === 'business' ? '#f9c435' : '#6B7280'} />
              {selectedType === 'business' && (
                <View style={styles.checkBadge}>
                  <Check size={16} color="white" />
                </View>
              )}
            </View>
            <Text style={[
              styles.optionTitle,
              selectedType === 'business' && styles.selectedTitle
            ]}>
              Restaurant Owner
            </Text>
            <Text style={styles.optionDescription}>
              Upload videos, manage bookings, and attract customers
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.continueButton, loading && styles.disabledButton]} 
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.continueButtonText}>Get Started</Text>
          )}
        </TouchableOpacity>

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  options: {
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCard: {
    borderColor: '#f29056',
    backgroundColor: 'rgba(242, 144, 86, 0.05)',
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkBadge: {
    backgroundColor: '#f29056',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 8,
  },
  selectedTitle: {
    color: '#f29056',
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#f29056',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
});