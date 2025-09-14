import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { Crown, Calendar, CreditCard, Settings } from 'lucide-react-native';
import { stripeApi, SubscriptionData } from '@/services/stripeApi';
import { stripeProducts } from '@/src/stripe-config';
import { api } from '@/services/supabaseApi';

interface SubscriptionCardProps {
  onUpgrade?: () => void;
}

export default function SubscriptionCard({ onUpgrade }: SubscriptionCardProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [managingSubscription, setManagingSubscription] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const data = await stripeApi.getUserSubscription();
      setSubscription(data);
      
      // Sync account type with subscription status
      await api.syncAccountTypeWithSubscription();
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (priceId: string | null) => {
    if (!priceId) return 'Free Plan';
    
    const product = stripeProducts.find(p => p.priceId === priceId);
    return product?.name || 'Unknown Plan';
  };

  const getProductPrice = (priceId: string | null) => {
    if (!priceId) return null;
    
    const product = stripeProducts.find(p => p.priceId === priceId);
    if (!product) return null;
    
    return `€${product.price.toFixed(2)}/month`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const isActiveSubscription = (status: string) => {
    return ['active', 'trialing'].includes(status);
  };

  const handleManageSubscription = async () => {
    if (!subscription) return;
    
    setManagingSubscription(true);
    
    try {
      // Use the current URL as return URL for better UX
      const returnUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/(tabs)/profile`
        : `https://willowy-fox-6dca25.netlify.app/(tabs)/profile`;
        
      const { url } = await stripeApi.createCustomerPortalSession(returnUrl);
      
      if (url) {
        await Linking.openURL(url);
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      Alert.alert(
        'Error',
        'Unable to open subscription management. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setManagingSubscription(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#f29056" />
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  const hasActiveSubscription = subscription && isActiveSubscription(subscription.subscription_status);

  return (
    <View style={[styles.card, hasActiveSubscription && styles.premiumCard]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {hasActiveSubscription && <Crown size={20} color="#f29056" />}
          <Text style={[styles.title, hasActiveSubscription && styles.premiumTitle]}>
            {getProductName(subscription?.price_id)}
          </Text>
          {hasActiveSubscription && getProductPrice(subscription?.price_id) && (
            <Text style={styles.priceText}>
              {getProductPrice(subscription?.price_id)}
            </Text>
          )}
        </View>
        
        {subscription?.subscription_status && (
          <View style={[
            styles.statusBadge,
            { backgroundColor: isActiveSubscription(subscription.subscription_status) ? '#10B981' : '#6B7280' }
          ]}>
            <Text style={styles.statusText}>
              {subscription.subscription_status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {hasActiveSubscription ? (
        <View style={styles.subscriptionDetails}>
          <View style={styles.detailRow}>
            <Calendar size={16} color="#4A5568" />
            <Text style={styles.detailText}>
              Renews on {formatDate(subscription.current_period_end)}
            </Text>
          </View>
          
          {subscription.payment_method_brand && subscription.payment_method_last4 && (
            <View style={styles.detailRow}>
              <CreditCard size={16} color="#4A5568" />
              <Text style={styles.detailText}>
                {subscription.payment_method_brand.toUpperCase()} •••• {subscription.payment_method_last4}
              </Text>
            </View>
          )}
          
          {subscription.cancel_at_period_end && (
            <Text style={styles.cancelText}>
              Subscription will cancel at the end of the current period
            </Text>
          )}
          
          <TouchableOpacity 
            style={[styles.manageButton, managingSubscription && styles.disabledButton]} 
            onPress={handleManageSubscription}
            disabled={managingSubscription}
          >
            {managingSubscription ? (
              <ActivityIndicator size="small" color="#4A5568" />
            ) : (
              <Settings size={16} color="#4A5568" />
            )}
            <Text style={styles.manageButtonText}>
              {managingSubscription ? 'Opening...' : 'Manage Subscription'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.upgradeSection}>
          <Text style={styles.upgradeText}>
            Upgrade to a business plan to create and manage restaurants
          </Text>
          
          {onUpgrade && (
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
              <Crown size={16} color="white" />
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  premiumCard: {
    borderWidth: 1,
    borderColor: '#f29056',
    backgroundColor: 'rgba(242, 144, 86, 0.02)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  premiumTitle: {
    color: '#f29056',
  },
  priceText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  subscriptionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  cancelText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#EF4444',
    marginTop: 4,
  },
  upgradeSection: {
    alignItems: 'center',
    gap: 12,
  },
  upgradeText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginLeft: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginTop: 12,
  },
  manageButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  disabledButton: {
    opacity: 0.6,
  },
});