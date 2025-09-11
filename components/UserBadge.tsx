import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface UserBadgeProps {
  badgeName?: string;
  badgeIcon?: string;
  badgeColor?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function UserBadge({ 
  badgeName, 
  badgeIcon, 
  badgeColor, 
  size = 'medium',
  showLabel = true 
}: UserBadgeProps) {
  if (!badgeName || !badgeIcon) return null;

  const sizeStyles = {
    small: {
      container: styles.smallContainer,
      icon: styles.smallIcon,
      text: styles.smallText,
    },
    medium: {
      container: styles.mediumContainer,
      icon: styles.mediumIcon,
      text: styles.mediumText,
    },
    large: {
      container: styles.largeContainer,
      icon: styles.largeIcon,
      text: styles.largeText,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[styles.container, currentSize.container]}>
      <View 
        style={[
          styles.iconContainer, 
          { backgroundColor: badgeColor || '#FFD700' }
        ]}
      >
        <Text style={[styles.iconText, currentSize.icon]}>
          {badgeIcon}
        </Text>
      </View>
      {showLabel && (
        <Text style={[styles.badgeText, currentSize.text]} numberOfLines={1}>
          {badgeName}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconText: {
    textAlign: 'center',
  },
  badgeText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  // Small size
  smallContainer: {
    gap: 4,
  },
  smallIcon: {
    fontSize: 12,
  },
  smallText: {
    fontSize: 10,
  },
  // Medium size
  mediumContainer: {
    gap: 6,
  },
  mediumIcon: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 12,
  },
  // Large size
  largeContainer: {
    gap: 8,
  },
  largeIcon: {
    fontSize: 18,
  },
  largeText: {
    fontSize: 14,
  },
});