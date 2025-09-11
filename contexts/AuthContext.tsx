import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/services/supabaseApi';
import { Database } from '@/types/database';
import { Alert } from 'react-native';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: Profile | null;
  loginWithPhone: (phone: string) => Promise<boolean>;
  signUpWithPhone: (phone: string, name: string, email: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  resendVerificationCode: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
  updateUserAccountType: (accountType: 'user' | 'business') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    setTimeout(() => {
      checkInitialSession();
    }, 100);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id, session?.user?.phone);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkInitialSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking initial session:', error);
      setLoading(false);
    }
  };
  const loadUserProfile = async (userId: string) => {
    try {
      // Add retry mechanism for profile loading after signup
      let profile = null;
      let retries = 0;
      const maxRetries = 3;
      
      while (!profile && retries < maxRetries) {
        try {
          profile = await api.getCurrentUser();
          if (profile) break;
          
          // If no profile found, wait and retry (database trigger might be slow)
          retries++;
          console.log(`Profile not found, retry ${retries}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Profile fetch attempt ${retries + 1} failed:`, error);
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      setUser(profile);
      
      // Sync account type with subscription status
      if (profile) {
        // Do this in background to avoid blocking
        api.syncAccountTypeWithSubscription().then(async () => {
          const updatedProfile = await api.getCurrentUser();
          if (updatedProfile?.account_type !== profile.account_type) {
            setUser(updatedProfile);
          }
        }).catch(error => {
          console.error('Failed to sync account type:', error);
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const updateUserAccountType = async (accountType: 'user' | 'business') => {
    if (user) {
      try {
        const updatedProfile = await api.updateProfile(user.id, { 
          account_type: accountType 
        });
        setUser({ ...user, account_type: accountType });
      } catch (error) {
        console.error('Failed to update account type:', error);
        throw error;
      }
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all spaces, dashes, and parentheses and ensure it starts with +
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  };

  const loginWithPhone = async (phone: string): Promise<boolean> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log('Authenticating with phone:', formattedPhone);

      // Use database function to check phone existence (bypasses RLS)
      console.log('Checking if phone exists in database...');
      const { data: phoneExists, error: phoneCheckError } = await supabase
        .rpc('check_phone_exists', { phone_input: formattedPhone });
      
      if (phoneCheckError) {
        console.error('Phone check error:', phoneCheckError);
        // Fallback: try the original phone input format
        const { data: fallbackExists } = await supabase
          .rpc('check_phone_exists', { phone_input: phone });
        console.log('Phone exists (fallback check):', !!fallbackExists);
        
        // If both fail, default to false but still send OTP
        console.log('Phone exists (with errors):', false);
      }
      
      const userExists = phoneExists || false;
      console.log('Phone exists in PROFILES table:', userExists);

      // Send OTP regardless of user existence - let Supabase handle it
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        console.error('OTP send error:', error);
        throw error;
      }
      
      console.log('OTP sent to:', formattedPhone, 'User exists:', userExists);

      return userExists;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signUpWithPhone = async (phone: string, name: string, email: string) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log('Creating account for:', formattedPhone, 'name:', name, 'email:', email);

      // Check if phone number already exists in profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('Phone number already registered. Please login instead.');
      }

      // Check if email already exists
      const { data: existingEmailProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingEmailProfile) {
        throw new Error('Email address already registered. Please use a different email or login instead.');
      }

      // Send OTP for new user signup
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          data: {
            name: name,
            email: email,
            account_type: 'user', // Default to user, they can change later
          }
        }
      });

      if (error) throw error;
      console.log('Signup OTP sent to:', formattedPhone, 'for email:', email);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const verifyOtp = async (phone: string, otp: string, name?: string, email?: string) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      setLoading(true);
      
      console.log('Verifying OTP for phone:', formattedPhone, 'code:', otp);
      
      // Before verification, double-check if phone number exists for signup
      if (name) { // This indicates it's a signup verification
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('phone', formattedPhone)
          .maybeSingle();

        if (existingProfile) {
          throw new Error('Phone number already registered. Please login instead.');
        }

        // Also check email if provided
        if (email) {
          const { data: existingEmailProfile } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .maybeSingle();

          if (existingEmailProfile) {
            throw new Error('Email address already registered. Please use a different email.');
          }
        }
      }
      
      const { error, data } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;
      
      console.log('OTP verification successful, user:', data.user?.id);

      // Ensure profile exists and has correct phone/name data
      if (data.user) {
        let profileCreated = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        try {
          // Retry loop to ensure profile is created/found
          while (!profileCreated && attempts < maxAttempts) {
            attempts++;
            console.log(`Profile check attempt ${attempts}/${maxAttempts}`);
            
            // First try to get existing profile
            let profile = await api.getCurrentUser();
            
            if (!profile) {
              console.log('No profile found, creating one...');
              
              // Double-check one more time before creating profile
              const { data: doubleCheckProfile } = await supabase
                .from('profiles')
                .select('id, phone')
                .eq('phone', formattedPhone)
                .maybeSingle();

              if (doubleCheckProfile) {
                console.log('Profile found in double-check');
                profileCreated = true;
                break;
              }

              // Create profile if it truly doesn't exist
              const { error: insertError } = await supabase.from('profiles').insert({
                id: data.user.id,
                email: email || data.user.email || `user_${data.user.id.slice(0, 8)}@phone.auth`,
                name: name || 'User',
                phone: formattedPhone,
                phone_confirmed: true,
                account_type: 'user',
              });
              
              if (insertError) {
                console.error('Failed to create profile:', insertError);
                if (insertError.code === '23505') { // Unique constraint violation
                  if (insertError.message.includes('profiles_phone_key')) {
                    throw new Error('Phone number already registered. Please login instead.');
                  } else if (insertError.message.includes('profiles_email_key')) {
                    console.log('Email constraint violation, retrying...');
                    // Continue with retry for email issues
                  } else {
                    console.log('Profile already exists (constraint violation)');
                    profileCreated = true;
                    break;
                  }
                }
                
                // If not the last attempt, continue retrying
                if (attempts < maxAttempts) {
                  console.log('Will retry profile creation...');
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  continue;
                }
                throw insertError;
              } else {
                console.log('Profile created successfully');
                profileCreated = true;
              }
            } else {
              console.log('Profile found:', profile.id);
              profileCreated = true;
              
              // Update profile with phone if missing
              if (!profile.phone || profile.phone !== formattedPhone) {
                console.log('Updating profile phone data...');
                await api.updateProfile(data.user.id, { 
                  phone: formattedPhone,
                  phone_confirmed: true,
                  ...(name && { name: name })
                });
              } else if (name && (!profile.name || profile.name === 'User')) {
                console.log('Updating profile name...');
                await api.updateProfile(data.user.id, { name: name });
              }
            }
            
            // Small delay before next attempt if needed
            if (!profileCreated && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!profileCreated) {
            throw new Error('Failed to create or verify profile after multiple attempts');
          }
        } catch (updateError) {
          console.error('Failed to ensure profile data:', updateError);
          throw updateError; // Fail the flow if profile creation fails completely
        }
      }

      // Wait for any database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadUserProfile(data.user!.id);

      console.log('OTP verification successful');
    } catch (error) {
      console.error('OTP verification failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationCode = async (phone: string) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;
      console.log('Resend OTP sent to:', formattedPhone);
    } catch (error) {
      console.error('Resend OTP error:', error);
      throw error;
    }
  };
  const logout = async () => {
    try {
      await api.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      setUser(null);
    }
  }
  
  return (
    <AuthContext.Provider value={{
      user, 
      loginWithPhone,
      signUpWithPhone,
      verifyOtp,
      resendVerificationCode,
      logout, 
      loading, 
      refreshUser, 
      updateUserAccountType,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}