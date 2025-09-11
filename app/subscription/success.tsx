import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircleCheck as CheckCircle, Crown, ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    // Sync account type and refresh user data
    const syncAndRefresh = async () => {
      try {
        await api.syncAccountTypeWithSubscription();
        await refreshUser();
      } catch (error) {
        console.error('Failed to sync account after subscription success:', error);
      }
    };
    
    syncAndRefresh();
  }, []);

  const handleContinue = () => {
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CheckCircle size={64} color="#10B981" />
        </View>
        
        <Text style={styles.title}>Welcome to Business!</Text>
        <Text style={styles.subtitle}>
          Your subscription has been activated successfully. You can now create and manage your restaurant profile.
        </Text>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>What you can do now:</Text>
          
          <View style={styles.benefitItem}>
            <Crown size={20} color="#f29056" />
            <Text style={styles.benefitText}>Create your restaurant profile</Text>
          </View>
          
          <View style={styles.benefitItem}>
            <Crown size={20} color="#f29056" />
            <Text style={styles.benefitText}>Upload promotional videos</Text>
          </View>
          
          <View style={styles.benefitItem}>
            <Crown size={20} color="#f29056" />
            <Text style={styles.benefitText}>Manage bookings and reservations</Text>
          </View>
          
          <View style={styles.benefitItem}>
            <Crown size={20} color="#f29056" />
            <Text style={styles.benefitText}>Access analytics dashboard</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Go to Profile</Text>
          <ArrowRight size={20} color="white" />
        </TouchableOpacity>

        <Text style={styles.footerText}>
          You can manage your subscription anytime from your profile settings.
        </Text>
      </View>
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
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitsTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginBottom: 24,
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
  footerText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'center',
  },
});