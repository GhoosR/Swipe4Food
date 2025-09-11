import React, { createContext, useContext, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { notificationService } from '@/services/notificationService';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface NotificationContextType {
  // Add any methods you might need to expose
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Initialize notifications when user is logged in
    if (user) {
      // Delay notification initialization to avoid blocking startup
      setTimeout(() => {
        notificationService.initialize();
      }, 2000);
    }

    // Handle notification responses (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      // Navigate based on notification data
      if (data.videoId) {
        router.push(`/video/${data.videoId}`);
      } else if (data.restaurantId) {
        router.push(`/restaurant/${data.restaurantId}`);
      } else if (data.bookingId) {
        router.push('/(tabs)/bookings');
      } else {
        // Default to notifications screen
        router.push('/(tabs)/notifications');
      }
    });

    return () => {
      responseSubscription.remove();
    };
  }, [user]);

  // Update badge count when user changes
  useEffect(() => {
    if (user) {
      // Update badge count periodically
      const updateBadge = async () => {
        try {
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
          
          await notificationService.setBadgeCount(count || 0);
        } catch (error) {
          console.error('Failed to update badge count:', error);
        }
      };

      updateBadge();
      const interval = setInterval(updateBadge, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}