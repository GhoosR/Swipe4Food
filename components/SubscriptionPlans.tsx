import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Crown, Check } from 'lucide-react-native';
import { stripeProducts } from '@/src/stripe-config';
import { stripeApi } from '@/services/stripeApi';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

interface SubscriptionPlansProps {
  onPlanSelect?: (priceId: string) => void;
}

export default function SubscriptionPlans({ onPlanSelect }: SubscriptionPlansProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (priceId: string, mode: 'payment' | 'subscription') => {
    setLoading(priceId);
    
    try {
      // Use proper URLs for mobile and web
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'https://willowy-fox-6dca25.netlify.app';
        
      const successUrl = `${baseUrl}/subscription/success`;
      const cancelUrl = `${baseUrl}/subscription/cancel`;
      
      const { url } = await stripeApi.createCheckoutSession({
        priceId,
        mode,
        successUrl,
        cancelUrl,
      });

      if (url) {
        await Linking.openURL(url);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to start checkout process. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('price_LIVE') || error.message.includes('REPLACE_ME')) {
          errorMessage = 'Payment system is being configured. Please try again later.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      Alert.alert(
        'Payment Error',
        errorMessage
      );
    } finally {
      setLoading(null);
    }
  };

  const getFeatures = () => [
    'Create and manage restaurant profiles',
    'Upload promotional videos',
    'Manage bookings and reservations',
    'Access to analytics dashboard',
    'Customer review management',
    'Menu management tools',
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Crown size={32} color="#f29056" />
        <Text style={styles.title}>Choose Your Business Plan</Text>
        <Text style={styles.subtitle}>
          Upgrade to start managing your restaurant on Swipe4Food
        </Text>
      </View>

      <View style={styles.plansContainer}>
        {stripeProducts.map((product) => {
          const isYearly = product.name.includes('Yearly');
          const isLoading = loading === product.priceId;
          
          const formatPrice = (price: number, interval: string) => {
            if (interval === 'year') {
              return `€${price.toFixed(0)}/year`;
            }
            return `€${price.toFixed(2)}/month`;
          };
          
          return (
            <View key={product.priceId} style={[styles.planCard, isYearly && styles.popularPlan]}>
              {isYearly && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}
              
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{product.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{formatPrice(product.price, product.interval)}</Text>
                  {product.savings && (
                    <Text style={styles.savings}>{product.savings}</Text>
                  )}
                </View>
                <Text style={styles.planDescription}>{product.description}</Text>
              </View>

              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>What's included:</Text>
                {getFeatures().map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Check size={16} color="#10B981" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.selectButton,
                  isYearly && styles.popularButton,
                  isLoading && styles.loadingButton
                ]}
                onPress={() => handleSelectPlan(product.priceId, product.mode)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Crown size={16} color="white" />
                    <Text style={styles.selectButtonText}>
                      {isYearly ? 'Choose Yearly Plan' : 'Choose Monthly Plan'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          All plans include a 30-day money-back guarantee. Cancel anytime.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  plansContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: '#f29056',
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    right: 20,
    backgroundColor: '#f29056',
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
  },
  popularText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  planName: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    color: '#f29056',
    marginBottom: 4,
  },
  savings: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    flex: 1,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  popularButton: {
    backgroundColor: '#f29056',
  },
  loadingButton: {
    opacity: 0.7,
  },
  selectButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    textAlign: 'center',
  },
});