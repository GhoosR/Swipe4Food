import { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Restaurant = Database['public']['Tables']['restaurants']['Row'];
export type Video = Database['public']['Tables']['videos']['Row'];
export type Booking = Database['public']['Tables']['bookings']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Like = Database['public']['Tables']['likes']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Favorite = Database['public']['Tables']['favorites']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type VideoAnalytics = Database['public']['Tables']['video_analytics']['Row'];
export type BadgeDefinition = Database['public']['Tables']['badge_definitions']['Row'];
export type UserBadge = Database['public']['Tables']['user_badges']['Row'];
export type RestaurantBadge = Database['public']['Tables']['restaurant_badges']['Row'];

export type UserReview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  restaurants: {
    id: string;
    name: string;
    cuisine: string;
    image_url?: string;
    city: string;
    country: string;
  };
};