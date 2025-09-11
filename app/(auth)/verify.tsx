import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MessageSquare, Loader } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyScreen() {
  const router = useRouter();
  const { phone, name, mode } = useLocalSearchParams<{ 
    phone: string; 
    name?: string;
    email?: string;
    mode: 'login' | 'signup';
  }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(60); // 60 second countdown
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { verifyOtp, resendVerificationCode } = useAuth();

  useEffect(() => {
    if (!phone) {
      router.replace('/(auth)/login');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phone]);

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the verification code');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      console.log('Verifying OTP for mode:', mode, 'phone:', phone);
      const { email } = useLocalSearchParams<{ 
        phone: string; 
        name?: string;
        email?: string;
        mode: 'login' | 'signup';
      }>();
      
      await verifyOtp(phone as string, otpCode, mode === 'signup' ? name : undefined, mode === 'signup' ? email : undefined);

      console.log('OTP verification completed, determining next step...');
      
      // Navigate based on mode
      if (mode === 'signup') {
        console.log('Signup verification successful, going to account type selection');
        router.replace('/(auth)/account-type');
      } else {
        console.log('Login verification successful, going to main app');
        router.replace('/(tabs)');
      }
      
    } catch (err: any) {
      console.error('Verification failed:', err);
      const errorMessage = err?.message || 'Invalid verification code. Please try again.';
      setErrorMessage(errorMessage);
      
      // If it's a session/profile error, guide user back to signup
      if (errorMessage.includes('session') || errorMessage.includes('profile')) {
        setTimeout(() => {
          setErrorMessage('Please try signing up again.');
          router.replace('/(auth)/signup');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string, index: number) => {
    if (text.length > 1) {
      // If user pastes a code, distribute it across the inputs
      if (text.length === 6 && /^\d+$/.test(text)) {
        const digits = text.split('');
        setOtp(digits);
        // Focus last input
        inputRefs.current[5]?.focus();
        return;
      }
      text = text.slice(0, 1);
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input when this one is filled
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && index > 0 && otp[index] === '') {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setLoading(true);
    setErrorMessage('');
    setCanResend(false);
    setTimeLeft(60); // 60 seconds for resend timeout

    try {
      await resendVerificationCode(phone!);

      // Start countdown timer again
      let timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={['#faf6ee', '#f5f0e6', '#f0ebe0']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#2D3748" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MessageSquare size={48} color="#f29056" />
        </View>
        
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to {phone}
          {mode === 'signup' && name && (
            <Text style={styles.nameText}> for {name}</Text>
          )}
        </Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handleInputChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              selectionColor="#f29056"
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.disabledButton]}
          onPress={handleVerify}
          disabled={loading || otp.some(digit => digit === '')}
        >
          {loading ? (
            <Loader size={24} color="white" />
          ) : (
            <Text style={styles.verifyButtonText}>
              {otp.some(digit => digit === '') ? 'Enter 6-digit code' : 'Verify Code'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive a code? {canResend ? '' : `Wait ${timeLeft}s`}
          </Text>
          <TouchableOpacity
            onPress={handleResendCode}
            disabled={!canResend || loading}
          >
            <Text
              style={[
                styles.resendLink,
                (!canResend || loading) && styles.disabledText,
              ]}
            >
              Resend Code
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    width: '100%',
    gap: 8,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    backgroundColor: 'white',
    color: '#2D3748',
  },
  verifyButton: {
    backgroundColor: '#f29056',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    shadowColor: '#f29056',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  verifyButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  resendLink: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
  },
  disabledText: {
    color: '#9CA3AF',
  },
});