import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface RestaurantBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface RestaurantBadgesProps {
  badges: RestaurantBadge[];
  layout?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium';
}

export default function RestaurantBadges({ 
  badges, 
  layout = 'horizontal',
  size = 'medium' 
}: RestaurantBadgesProps) {
  const { t } = useLanguage();
  
  if (!badges || badges.length === 0) return null;

  const isSmall = size === 'small';

  return (
    <View style={[
      styles.container,
      layout === 'vertical' ? styles.verticalLayout : styles.horizontalLayout
    ]}>
      {badges.map((badge) => (
        <View 
          key={badge.id} 
          style={[
            styles.badge,
            { backgroundColor: badge.color },
            isSmall && styles.smallBadge
          ]}
        >
          <Text style={[styles.badgeIcon, isSmall && styles.smallIcon]}>
            {badge.icon}
          </Text>
          <Text style={[styles.badgeText, isSmall && styles.smallText]} numberOfLines={1}>
            {badge.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
  },
  horizontalLayout: {
    flexDirection: 'row',
    gap: 8,
  },
  verticalLayout: {
    flexDirection: 'column',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 14,
  },
  smallIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  smallText: {
    fontSize: 10,
  },
});