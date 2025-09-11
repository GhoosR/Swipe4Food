import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface LogoProps {
  size?: number;
  containerStyle?: any;
}

export default function Logo({ size = 40, containerStyle }: LogoProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={require('../assets/images/logo-s4f.png')}
        style={{ width: size * 2.5, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});