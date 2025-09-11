export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          name: string
          avatar_url: string | null
          account_type: 'user' | 'business'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          name: string
          avatar_url?: string | null
          account_type?: 'user' | 'business'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          name?: string
          avatar_url?: string | null
          account_type?: 'user' | 'business'
          created_at?: string
          updated_at?: string
        }
      }
      restaurants: {
        Row: {
          id: string
          owner_id: string
          name: string
          cuisine: string
          description: string | null
          phone: string | null
          website: string | null
          address: string
          city: string
          country: string
          latitude: number | null
          longitude: number | null
          price_range: '€' | '€€' | '€€€' | '€€€€'
          opening_hours: Json
          available_slots: string[]
          rating: number
          review_count: number
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          cuisine: string
          description?: string | null
          phone?: string | null
          website?: string | null
          address: string
          city: string
          country: string
          latitude?: number | null
          longitude?: number | null
          price_range?: '€' | '€€' | '€€€' | '€€€€'
          opening_hours?: Json
          available_slots?: string[]
          rating?: number
          review_count?: number
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          cuisine?: string
          description?: string | null
          phone?: string | null
          website?: string | null
          address?: string
          city?: string
          country?: string
          latitude?: number | null
          longitude?: number | null
          price_range?: '€' | '€€' | '€€€' | '€€€€'
          opening_hours?: Json
          available_slots?: string[]
          rating?: number
          review_count?: number
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          restaurant_id: string
          title: string
          description: string | null
          video_url: string
          thumbnail_url: string | null
          duration: number | null
          likes_count: number
          comments_count: number
          views_count: number
          is_featured: boolean
          status: 'draft' | 'published' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          title: string
          description?: string | null
          video_url: string
          thumbnail_url?: string | null
          duration?: number | null
          likes_count?: number
          comments_count?: number
          views_count?: number
          is_featured?: boolean
          status?: 'draft' | 'published' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          title?: string
          description?: string | null
          video_url?: string
          thumbnail_url?: string | null
          duration?: number | null
          likes_count?: number
          comments_count?: number
          views_count?: number
          is_featured?: boolean
          status?: 'draft' | 'published' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          booking_date: string
          booking_time: string
          guests: number
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          special_requests: string | null
          contact_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          booking_date: string
          booking_time: string
          guests: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          special_requests?: string | null
          contact_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string
          booking_date?: string
          booking_time?: string
          guests?: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          special_requests?: string | null
          contact_phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      likes: {
        Row: {
          id: string
          video_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          user_id?: string
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          video_id: string
          user_id: string
          text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          user_id: string
          text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          user_id?: string
          text?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'new_comment' | 'new_like' | 'new_follower'
          title: string
          message: string
          data: Json
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'new_comment' | 'new_like' | 'new_follower'
          title: string
          message: string
          data?: Json
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'new_comment' | 'new_like' | 'new_follower'
          title?: string
          message?: string
          data?: Json
          read?: boolean
          created_at?: string
        }
      }
      video_analytics: {
        Row: {
          id: string
          video_id: string
          user_id: string | null
          event_type: 'view' | 'like' | 'comment' | 'share' | 'book'
          session_id: string | null
          user_agent: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          user_id?: string | null
          event_type: 'view' | 'like' | 'comment' | 'share' | 'book'
          session_id?: string | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          user_id?: string | null
          event_type?: 'view' | 'like' | 'comment' | 'share' | 'book'
          session_id?: string | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          description: string | null
          price: number
          category: string
          image_url: string | null
          is_available: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          description?: string | null
          price: number
          category: string
          image_url?: string | null
          is_available?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string
          image_url?: string | null
          is_available?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}