import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native'; 
import CountryPicker from './CountryPicker';

// Default country list for the picker
const defaultCountry = {
  code: 'US',
  name: 'United States',
  dialCode: '+1'
};

interface PhoneNumberInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

// Create a ref type for the TextInput
type TextInputRef = React.RefObject<TextInput>;

export default function PhoneNumberInput({ 
  value, 
  onChangeText, 
  placeholder = "Phone Number", 
  error 
}: PhoneNumberInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const phoneInputRef = useRef<TextInput>(null);
  
  // When country changes, update the parent component with the full number
  const handleCountrySelect = (country: any) => {
    setSelectedCountry(country);
    
    // Get the local number part without country code
    let localNumber = '';
    
    // First remove all spaces from current value
    const cleanValue = value.replace(/\s+/g, '');
    
    // If the value already has a country code, extract just the number part
    if (cleanValue.startsWith('+')) {
      // Find the local part by removing any existing country code
      localNumber = cleanValue.replace(/^\+\d+/, '');
    } else {
      // If no country code, use the whole value as local number
      localNumber = cleanValue;
    }
    
    // Pass the full number (country code + local number) to the parent
    const fullNumber = country.dialCode + localNumber;
    console.log('Setting full number with country code:', fullNumber);
    onChangeText(fullNumber);
  };
  
  // When phone number input changes
  const handlePhoneChange = (text: string) => {
    // Always remove spaces first
    let cleanedText = text.replace(/\s+/g, '');
    
    if (text.startsWith('+')) {
      // If they're typing a full international number, use that directly
      onChangeText(cleanedText);
      console.log('User entered full number with country code:', cleanedText);
    } else {
      // Prepend the selected country code to the local number
      const fullNumber = selectedCountry.dialCode + cleanedText;
      console.log('Adding country code to number:', fullNumber);
      onChangeText(fullNumber); 
    }
  };
  
  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      <View style={styles.inputContainer}>
        <CountryPicker
          selectedCountry={selectedCountry}
          onSelectCountry={(country) => {
            // Important: Call handleCountrySelect with no delay
            // to immediately update the phone number
            handleCountrySelect(country); 
            // Force focus on the phone input after country selection
            setTimeout(() => {
              if (phoneInputRef.current) {
                phoneInputRef.current.focus();
              }
            }, 100);
          }}
        />
        
        <TextInput
          ref={phoneInputRef}
          style={styles.input}
          value={value.replace(selectedCountry.dialCode, '').trim()}
          onChangeText={(text) => {
            // Remove any spaces to prevent formatting issues
            handlePhoneChange(text.replace(/\s+/g, ''));
          }}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dialCode: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    marginLeft: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    marginBottom: 8,
  },
});