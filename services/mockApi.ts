import { User, Restaurant, Video, Comment, Like, Booking, Notification } from '@/types';

// Mock data storage (in real app, this would be replaced with actual API calls)
class MockAPI {
  private users: User[] = [
    {
      id: '1',
      email: 'user@example.com',
      name: 'John Doe',
      avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg',
      accountType: 'user',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      email: 'restaurant@example.com',
      name: 'Bella Vista Owner',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
      accountType: 'business',
      createdAt: new Date().toISOString(),
    },
  ];

  private restaurants: Restaurant[] = [
    {
      id: '1',
      name: 'Bella Vista',
      cuisine: 'Italian',
      rating: 4.8,
      reviewCount: 324,
      distance: '0.5 km',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      image: 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg',
      location: 'Calle Real 123, Granada, Spain',
      priceRange: '€€€',
      availableSlots: ['19:00', '19:30', '20:00', '20:30'],
      ownerId: '2',
      description: 'Experience authentic Italian flavors in the heart of Granada.',
      phone: '+34 958 123 456',
      website: 'www.bellavista.es',
      openingHours: {
        monday: '12:00 - 23:00',
        tuesday: '12:00 - 23:00',
        wednesday: '12:00 - 23:00',
        thursday: '12:00 - 23:00',
        friday: '12:00 - 24:00',
        saturday: '12:00 - 24:00',
        sunday: '12:00 - 22:00',
      },
      coordinates: { latitude: 37.1773, longitude: -3.5986 },
    },
  ];

  private videos: Video[] = [
    {
      id: '1',
      restaurantId: '1',
      thumbnail: 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Fresh Pasta Making',
      duration: '0:45',
      likes: 234,
      comments: 45,
      createdAt: new Date().toISOString(),
    },
  ];

  private comments: Comment[] = [
    {
      id: '1',
      videoId: '1',
      userId: '1',
      userName: 'John Doe',
      userAvatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg',
      text: 'This looks absolutely delicious! Can\'t wait to try it.',
      createdAt: new Date().toISOString(),
    },
  ];

  private likes: Like[] = [
    {
      id: '1',
      videoId: '1',
      userId: '1',
      createdAt: new Date().toISOString(),
    },
  ];

  private bookings: Booking[] = [
    {
      id: '1',
      restaurantId: '1',
      restaurantName: 'Bella Vista',
      userId: '1',
      date: '2025-01-15',
      time: '19:30',
      guests: 4,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    },
  ];

  private notifications: Notification[] = [];

  private currentUser: User | null = null;

  // Auth methods
  async login(email: string, password: string): Promise<User> {
    const user = this.users.find(u => u.email === email);
    if (!user) throw new Error('User not found');
    this.currentUser = user;
    return user;
  }

  async signup(email: string, password: string, name: string, accountType: 'user' | 'business'): Promise<User> {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      accountType,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.currentUser = newUser;
    return newUser;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  // Restaurant methods
  async getRestaurants(): Promise<Restaurant[]> {
    return this.restaurants;
  }

  async getRestaurant(id: string): Promise<Restaurant | null> {
    return this.restaurants.find(r => r.id === id) || null;
  }

  // Video methods
  async getVideos(): Promise<Video[]> {
    return this.videos;
  }

  async getVideosByRestaurant(restaurantId: string): Promise<Video[]> {
    return this.videos.filter(v => v.restaurantId === restaurantId);
  }

  // Like methods
  async toggleLike(videoId: string, userId: string): Promise<boolean> {
    const existingLike = this.likes.find(l => l.videoId === videoId && l.userId === userId);
    
    if (existingLike) {
      this.likes = this.likes.filter(l => l.id !== existingLike.id);
      const video = this.videos.find(v => v.id === videoId);
      if (video) video.likes--;
      return false;
    } else {
      const newLike: Like = {
        id: Date.now().toString(),
        videoId,
        userId,
        createdAt: new Date().toISOString(),
      };
      this.likes.push(newLike);
      const video = this.videos.find(v => v.id === videoId);
      if (video) video.likes++;
      return true;
    }
  }

  async isVideoLiked(videoId: string, userId: string): Promise<boolean> {
    return this.likes.some(l => l.videoId === videoId && l.userId === userId);
  }

  // Comment methods
  async getComments(videoId: string): Promise<Comment[]> {
    return this.comments.filter(c => c.videoId === videoId);
  }

  async addComment(videoId: string, userId: string, text: string): Promise<Comment> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');

    const newComment: Comment = {
      id: Date.now().toString(),
      videoId,
      userId,
      userName: user.name,
      userAvatar: user.avatar,
      text,
      createdAt: new Date().toISOString(),
    };

    this.comments.push(newComment);
    const video = this.videos.find(v => v.id === videoId);
    if (video) video.comments++;

    return newComment;
  }

  // Booking methods
  async createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'status'>): Promise<Booking> {
    const newBooking: Booking = {
      ...booking,
      id: Date.now().toString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.bookings.push(newBooking);

    // Create notification for restaurant owner
    const restaurant = this.restaurants.find(r => r.id === booking.restaurantId);
    if (restaurant) {
      await this.createNotification(
        restaurant.ownerId,
        'booking_request',
        'New Booking Request',
        `New booking request for ${booking.date} at ${booking.time}`,
        { bookingId: newBooking.id }
      );
    }

    return newBooking;
  }

  async getBookings(userId: string): Promise<Booking[]> {
    return this.bookings.filter(b => b.userId === userId);
  }

  async getRestaurantBookings(restaurantId: string): Promise<Booking[]> {
    return this.bookings.filter(b => b.restaurantId === restaurantId);
  }

  async updateBookingStatus(bookingId: string, status: Booking['status']): Promise<Booking> {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.status = status;

    // Create notification for user
    await this.createNotification(
      booking.userId,
      status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled',
      status === 'confirmed' ? 'Booking Confirmed' : 'Booking Cancelled',
      `Your booking at ${booking.restaurantName} has been ${status}`,
      { bookingId }
    );

    return booking;
  }

  // Notification methods
  async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data?: any
  ): Promise<Notification> {
    const notification: Notification = {
      id: Date.now().toString(),
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.notifications.push(notification);
    return notification;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.filter(n => n.userId === userId).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return this.notifications.filter(n => n.userId === userId && !n.read).length;
  }
}

export const api = new MockAPI();