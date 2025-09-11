import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationData {
  type?: string;
  videoId?: string;
  restaurantId?: string;
  bookingId?: string;
  commentId?: string;
}

class NotificationService {
  private pushToken: string | null = null;

  async initialize() {
    try {
      await this.requestPermissions();
      await this.registerForPushNotifications();
      this.setupNotificationHandlers();
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  private async requestPermissions() {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }

    return true;
  }

  private async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Get the token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '8708efe0-b139-4401-8f97-4c1bbb247e2c',
      });
      
      this.pushToken = tokenData.data;
      console.log('Push token:', this.pushToken);

      // Save token to user profile
      await this.savePushTokenToProfile(this.pushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f29056',
        });
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }

  private async savePushTokenToProfile(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to save push token:', error);
      } else {
        console.log('Push token saved to profile');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  private setupNotificationHandlers() {
    // Handle notification received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    // Handle user tapping on notification
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });

    // Return cleanup function
    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as PushNotificationData;
    
    // You can add navigation logic here based on notification data
    if (data.videoId) {
      // Navigate to video
      console.log('Navigate to video:', data.videoId);
    } else if (data.restaurantId) {
      // Navigate to restaurant
      console.log('Navigate to restaurant:', data.restaurantId);
    } else if (data.bookingId) {
      // Navigate to bookings
      console.log('Navigate to booking:', data.bookingId);
    }
  }

  async sendLocalNotification(title: string, body: string, data?: PushNotificationData) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  getPushToken() {
    return this.pushToken;
  }
}

export const notificationService = new NotificationService();