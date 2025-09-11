import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';
import { notificationService } from '@/services/notificationService';

interface NotificationBellProps {
  color?: string;
  size?: number;
}

export default function NotificationBell({ color = '#2D3748', size = 24 }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  // Reload count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadUnreadCount();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      
      // Refresh count every 10 seconds for more responsive updates
      const interval = setInterval(loadUnreadCount, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    try {
      const count = await api.getUnreadNotificationCount();
      setUnreadCount(count);
      
      // Update app badge count
      await notificationService.setBadgeCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handlePress = () => {
    router.push('/(tabs)/notifications');
    // Clear the count immediately when user opens notifications
    // The actual count will be updated when they return to this screen
    setUnreadCount(0);
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePress}
    >
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
  },
});