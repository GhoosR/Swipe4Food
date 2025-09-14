import { supabase } from '@/lib/supabase';
import { stripeProducts } from '@/src/stripe-config';

export interface CheckoutSessionRequest {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface SubscriptionData {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export interface CustomerPortalResponse {
  url: string;
}
export class StripeAPI {
  private getSupabaseUrl(): string {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured');
    }
    return url;
  }

  private getAnonKey(): string {
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
      throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured');
    }
    return key;
  }

  private validateLiveMode() {
    // Validate that we have proper price IDs configured
    const hasValidPriceIds = stripeProducts.every(product => 
      product.priceId && !product.priceId.includes('REPLACE_ME')
    );
    
    if (!hasValidPriceIds) {
      console.warn('WARNING: Invalid price IDs detected. Please check src/stripe-config.ts configuration.');
    }
  }
  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    this.validateLiveMode();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    const apiUrl = `${this.getSupabaseUrl()}/functions/v1/stripe-checkout`;
    
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        price_id: request.priceId,
        mode: request.mode,
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Stripe checkout error:', errorData);
      throw new Error(errorData.error || 'Failed to create checkout session. Please try again.');
    }

    return await response.json();
  }

  async getUserSubscription(): Promise<SubscriptionData | null> {
    const { data, error } = await supabase
      .from('stripe_user_subscriptions')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching user subscription:', error);
      throw new Error('Failed to fetch subscription data');
    }

    return data;
  }

  async getUserOrders() {
    const { data, error } = await supabase
      .from('stripe_user_orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Error fetching user orders:', error);
      throw new Error('Failed to fetch order data');
    }

    return data || [];
  }

  async createCustomerPortalSession(returnUrl: string): Promise<CustomerPortalResponse> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    const apiUrl = `${this.getSupabaseUrl()}/functions/v1/stripe-customer-portal`;
    
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        return_url: returnUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const stripeApi = new StripeAPI();