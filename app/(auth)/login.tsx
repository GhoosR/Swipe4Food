import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import PhoneNumberInput from '@/components/PhoneNumberInput';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { loginWithPhone } = useAuth();

  const handleLogin = async () => {
    const trimmedPhone = phone.trim();

    if (!trimmedPhone) {
      setErrorMessage('Please enter your phone number');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const userExists = await loginWithPhone(phone);
      
      if (userExists) {
        console.log('User exists, proceeding to verification');
        router.replace({
          pathname: '/(auth)/verify',
          params: { 
            phone,
            mode: 'login'
          }
        });
      } else {
        console.log('User does not exist, redirecting to signup');
        setErrorMessage('No account found with this phone number. Please sign up first.');
        setTimeout(() => {
          setErrorMessage('');
        router.replace({
          pathname: '/(auth)/signup',
          params: { phone }
        });
        }, 2000);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setErrorMessage(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <LinearGradient
      colors={['#faf6ee', '#f5f0e6', '#f0ebe0']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image 
            source={require('../../assets/images/front-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Discover amazing restaurants near your.</Text>
        </View>

        <View style={styles.form}>
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <PhoneNumberInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone Number"
          />

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.disabledButton]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Checking...' : 'Login'}
            </Text>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.signupButton}
            onPress={() => router.replace('/(auth)/signup')}
          >
            <Text style={styles.signupButtonText}>
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
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
  logo: {
    width: 600,
    height: 240,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  signupButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  signupButtonText: {
    fontSize: 14,
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
    opacity: 0.6,
  },
});