import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { notificationService } from './notificationService';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Video = Database['public']['Tables']['videos']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Comment = Database['public']['Tables']['comments']['Row'];
type Like = Database['public']['Tables']['likes']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export class SupabaseAPI {
  // Auth methods
  async signUpWithPhone(phone: string, name: string, accountType: 'user' | 'business') {
    // Format phone number
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    // Use database function to check phone existence (bypasses RLS)
    const { data: phoneExists, error: phoneCheckError } = await supabase
      .rpc('check_phone_exists', { phone_input: phone });

    if (phoneCheckError) {
      console.error('Phone check error during signup:', phoneCheckError);
      throw new Error('Unable to verify phone number. Please try again.');
    }

    if (phoneExists) {
      throw new Error('An account with this phone number already exists');
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: {
          name,
          account_type: accountType,
        },
      },
    });

    if (error) throw error;
    
    // The user will need to verify the OTP next
    return data;
  }

  async verifyPhoneOtp(phone: string, otp: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;
    
    // Profile will be created automatically by the trigger
    return data.user;
  }

  /*async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data.user;
  }*/

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Auth error:', userError);
      
      // Check if this is a stale JWT token error
      if (userError.message?.includes('User from sub claim in JWT does not exist')) {
        console.log('Stale JWT detected in auth error, clearing session...');
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('Failed to sign out stale session:', signOutError);
        }
      }
      
      return null;
    }
    
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Profile doesn't exist yet - this can happen right after signup
        console.log('Profile not found for user:', user.id);
        return null;
      } else {
        console.error('Profile fetch error:', profileError);
        return null;
      }
    }

    return profile;
  }

  async updateProfile(userId: string, updates: Partial<Database['public']['Tables']['profiles']['Update']>) {
    console.log('Updating profile for user:', userId, 'with updates:', updates);
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      throw error;
    }
    
    console.log('Profile updated successfully:', data);
    return data;
  }

  async getUserProfile(userId: string) {
    console.log('API: Fetching user profile for ID:', userId); // Debug log
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('API: Error fetching user profile:', error); // Debug log
      if (error.code === 'PGRST116') {
        // User not found
        return null;
      }
      throw error;
    }
    
    console.log('API: Retrieved user profile:', data); // Debug log
    return data;
  }

  // Restaurant methods
  async getRestaurants(userLat?: number, userLng?: number, limit = 50) {
    let query = supabase
      .from('restaurants')
      .select(`
        *,
        videos (
          id,
          title,
          video_url,
          thumbnail_url,
          likes_count,
          comments_count,
          views_count
        )
      `)
      .eq('is_active', true)
      .limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    // Sort by distance if coordinates provided
    if (userLat && userLng && data) {
      return data.sort((a, b) => {
        if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) return 0;
        
        const distA = this.calculateDistance(userLat, userLng, a.latitude, a.longitude);
        const distB = this.calculateDistance(userLat, userLng, b.latitude, b.longitude);
        
        return distA - distB;
      });
    }

    return data || [];
  }

  async getRestaurant(id: string) {
    const { data, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        videos (
          id,
          title,
          description,
          video_url,
          thumbnail_url,
          duration,
          likes_count,
          comments_count,
          views_count,
          created_at
        ),
        menu_items (
          id,
          name,
          description,
          price,
          category,
          image_url,
          is_available,
          sort_order
        ),
        profiles (
          name,
          avatar_url
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Sort videos by creation date (newest first) to ensure consistent ordering
    if (data && data.videos) {
      data.videos.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    
    return data;
  }

  async getRestaurantByOwnerId(ownerId: string) {
    const { data, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        videos (
          id,
          title,
          description,
          video_url,
          thumbnail_url,
          duration,
          likes_count,
          comments_count,
          views_count,
          created_at
        )
      `)
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  }

  async createRestaurant(restaurantData: Omit<Database['public']['Tables']['restaurants']['Insert'], 'owner_id'>) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    if (user.account_type !== 'business') throw new Error('Only business accounts can create restaurants');

    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        ...restaurantData,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateRestaurant(restaurantId: string, updates: Partial<Database['public']['Tables']['restaurants']['Update']>) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('owner_id')
      .eq('id', restaurantId)
      .single();

    if (!restaurant || restaurant.owner_id !== user.id) {
      throw new Error('Not authorized to update this restaurant');
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Video methods
  async getVideos(
    limit = 20, 
    offset = 0, 
    userLat?: number, 
    userLng?: number, 
    radiusKm?: number,
    cuisine?: string
  ) {
    console.log(`Loading videos: limit=${limit}, offset=${offset}, cuisine=${cuisine}, radius=${radiusKm}km`);
    
    let query = supabase
      .from('videos')
      .select(`
        *,
        restaurants (
          id,
          name,
          cuisine,
          price_range,
          city,
          country,
          rating,
          address,
          latitude,
          longitude,
          available_slots,
          owner_id,
          is_active,
          image_url
        )
      `)
      .eq('status', 'published')
      .eq('restaurants.is_active', true);

    // Add cuisine filter if specified
    if (cuisine) {
      query = query.ilike('restaurants.cuisine', `%${cuisine}%`);
    }

    // Execute query with ordering and pagination
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    // Filter out videos from inactive restaurants (extra safety check)
    let filteredData = (data || []).filter(video => 
      video.restaurants && (video.restaurants as any).is_active
    );

    // Apply distance filter if user location and radius are provided
    if (userLat && userLng && radiusKm && filteredData.length > 0) {
      filteredData = filteredData.filter(video => {
        const restaurant = video.restaurants as any;
        if (!restaurant.latitude || !restaurant.longitude) return true; // Include if no coords
        
        const distance = this.calculateDistance(
          userLat,
          userLng,
          restaurant.latitude,
          restaurant.longitude
        );
        
        return distance <= radiusKm;
      });

      // Sort by distance if coordinates are available
      filteredData.sort((a, b) => {
        const restaurantA = a.restaurants as any;
        const restaurantB = b.restaurants as any;
        
        if (!restaurantA.latitude || !restaurantA.longitude || 
            !restaurantB.latitude || !restaurantB.longitude) {
          return 0; // Keep original order if coordinates missing
        }
        
        const distanceA = this.calculateDistance(userLat, userLng, restaurantA.latitude, restaurantA.longitude);
        const distanceB = this.calculateDistance(userLat, userLng, restaurantB.latitude, restaurantB.longitude);
        
        return distanceA - distanceB;
      });
    }
    
    console.log(`Loaded ${filteredData.length} videos after filtering`);
    return filteredData;
  }

  async getVideo(id: string) {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        restaurants (
          id,
          name,
          cuisine,
          price_range,
          city,
          country,
          rating,
          address,
          latitude,
          longitude,
          available_slots,
          owner_id,
          is_active
        )
      `)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error) throw error;
    
    // Ensure the restaurant is active
    if (!data.restaurants || !(data.restaurants as any).is_active) {
      throw new Error('Video not found or restaurant is inactive');
    }
    
    return data;
  }

  async getVideosByRestaurant(restaurantId: string) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createVideo(videoData: Omit<Database['public']['Tables']['videos']['Insert'], 'restaurant_id'>, restaurantId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    if (user.account_type !== 'business') throw new Error('Only business accounts can create videos');

    // Verify restaurant ownership and completeness
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) {
      throw new Error('Restaurant not found or not owned by user');
    }

    // Check if restaurant is active
    if (!restaurant.is_active) {
      throw new Error('Restaurant profile is inactive. Please activate it in your profile settings.');
    }

    const { data, error } = await supabase
      .from('videos')
      .insert({
        ...videoData,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async uploadVideo(file: File, fileName: string) {
    console.log('Uploading video to Supabase Storage:', fileName);
    
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);

    console.log('Video uploaded successfully:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  }

  async uploadVideoFromUri(videoUri: string, fileName: string, mimeType?: string) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      console.log('Uploading video from URI:', fileName);
      
      // Create user-specific folder path
      const filePath = `${user.id}/videos/${fileName}`;
      console.log('📁 Video upload path:', filePath);
      
      let fileData: Uint8Array;
      
      if (Platform.OS === 'web') {
        // On web, convert the URI to binary data
        console.log('📄 Web platform: fetching video data...');
        const response = await fetch(videoUri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      } else {
        // On mobile, use expo-file-system
        console.log('📄 Mobile platform: reading video file as base64...');
        const base64 = await FileSystem.readAsStringAsync(videoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('💾 Converting base64 to binary data...');
        // Convert base64 to Uint8Array
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        fileData = new Uint8Array(byteNumbers);
      }
      
      console.log('Video file size:', fileData.length);
      
      // Validate file size (100MB limit for videos)
      const maxSize = 100 * 1024 * 1024;
      if (fileData.length > maxSize) {
        throw new Error(`Video too large (${(fileData.length / 1024 / 1024).toFixed(1)}MB). Please select a video smaller than 100MB`);
      }
      
      console.log('☁️ Uploading to Supabase storage...');
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, fileData, {
          contentType: this.getValidVideoMimeType(mimeType),
          upsert: false,
        });

      if (error) {
        console.error('❌ Supabase video upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('✅ Video upload successful:', data);

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(data.path);

      console.log('🔗 Video public URL:', publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
      
    } catch (error) {
      console.error('❌ Video upload error:', error);
      throw error;
    }
  }

  async uploadImage(imageUri: string, fileName: string, mimeType?: string, folder: string = 'avatars') {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      console.log('🖼️ Starting image upload:', fileName, 'to folder:', folder);
      
      // Create user-specific folder path
      const filePath = `${user.id}/${folder}/${fileName}`;
      console.log('📁 Upload path:', filePath);

      let fileData: Uint8Array;
      
      if (Platform.OS === 'web') {
        // On web, convert the URI to a File object or use fetch
        console.log('📄 Web platform: fetching image data...');
        const response = await fetch(imageUri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      } else {
        // On mobile, use expo-file-system
        console.log('📄 Mobile platform: reading file as base64...');
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('📄 Base64 length:', base64.length);
        
        // Convert base64 to binary data
        const byteCharacters = atob(base64);
        fileData = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          fileData[i] = byteCharacters.charCodeAt(i);
        }
      }
      
      console.log('💾 Final file size:', fileData.length, 'bytes');
      
      // Validate file size (10MB limit)
      const sizeLimit = 10 * 1024 * 1024;
      if (fileData.length > sizeLimit) {
        throw new Error(`Image too large (${(fileData.length / 1024 / 1024).toFixed(1)}MB). Please select an image smaller than 10MB`);
      }
      
      console.log('☁️ Uploading to Supabase storage...');
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, fileData, {
          contentType: this.getValidImageMimeType(mimeType),
          upsert: false,
        });

      if (error) {
        console.error('❌ Supabase storage error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('✅ Upload successful! Path:', data.path);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(data.path);

      console.log('🔗 Public URL:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error('❌ Image upload error:', error);
      throw error;
    }
  }

  // Get valid video MIME type
  private getValidVideoMimeType(mimeType?: string): string {
    const validTypes = [
      'video/mp4',
      'video/quicktime', 
      'video/x-msvideo',
      'video/webm',
      'video/mov',
      'video/avi'
    ];
    
    if (mimeType && validTypes.includes(mimeType)) {
      return mimeType;
    }
    
    // Default to mp4
    return 'video/mp4';
  }
  
  // Get valid image MIME type
  private getValidImageMimeType(mimeType?: string): string {
    const validTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff'
    ];
    
    if (mimeType && validTypes.includes(mimeType)) {
      return mimeType;
    }
    
    // Default to jpeg
    return 'image/jpeg';
  }

  // Booking methods
  async createBooking(bookingData: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...bookingData,
        user_id: user.id,
      })
      .select(`
        *,
        restaurants (
          name,
          owner_id
        )
      `)
      .single();

    if (error) throw error;

    // Notification is handled by database trigger - no need to create manually

    return data;
  }

  async getUserBookings(userId?: string) {
    const user = userId || (await this.getCurrentUser())?.id;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        restaurants (
          name,
          image_url,
          city,
          country
        )
      `)
      .eq('user_id', user)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform the data to match the expected format
    return (data || []).map(booking => ({
      ...booking,
      restaurantName: booking.restaurants?.name || 'Unknown Restaurant',
      date: booking.booking_date,
      time: booking.booking_time,
    }));
  }

  async getRestaurantBookings(restaurantId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles (
          name,
          email,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });

    if (error) throw error;
    
    // Transform the data to match the expected format
    return (data || []).map(booking => ({
      ...booking,
      date: booking.booking_date,
      time: booking.booking_time,
    }));
  }

  async getBooking(bookingId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        restaurants (
          name,
          image_url,
          city,
          country,
          owner_id
        ),
        profiles (
          name,
          email,
          avatar_url
        )
      `)
      .eq('id', bookingId)
      .single();

    if (error) throw error;
    
    // Check if user has permission to view this booking
    const isCustomer = data.user_id === user.id;
    const isRestaurantOwner = (data.restaurants as any)?.owner_id === user.id;
    
    if (!isCustomer && !isRestaurantOwner) {
      throw new Error('Not authorized to view this booking');
    }
    
    // Transform the data to match the expected format
    return {
      ...data,
      restaurantName: data.restaurants?.name || 'Unknown Restaurant',
      date: data.booking_date,
      time: data.booking_time,
    };
  }

  async updateBookingStatus(bookingId: string, status: Database['public']['Tables']['bookings']['Row']['status']) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Verify the user can update this booking (either the customer or restaurant owner)
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        restaurants (
          name,
          owner_id
        )
      `)
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error('Booking not found');
    
    // Check if user is either the customer or restaurant owner
    const isCustomer = booking.user_id === user.id;
    const isRestaurantOwner = (booking.restaurants as any)?.owner_id === user.id;
    
    if (!isCustomer && !isRestaurantOwner) {
      throw new Error('Not authorized to update this booking');
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select(`
        *,
        restaurants (name)
      `)
      .single();

    if (error) throw error;

    // Notification is handled by database trigger - no need to create manually

    return data;
  }

  // Like methods
  async toggleLike(videoId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    console.log('Toggling like for video:', videoId, 'by user:', user.id);

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      console.log('Unliking video - removing like:', existingLike.id);
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);

      if (error) throw error;
      console.log('Successfully unliked video');
      return false;
    } else {
      console.log('Liking video - creating new like');
      // Like
      const { data, error } = await supabase
        .from('likes')
        .insert({
          video_id: videoId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      console.log('Successfully liked video, new like:', data);
      return true;
    }
  }

  async isVideoLiked(videoId: string) {
    const user = await this.getCurrentUser();
    if (!user) return false;

    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .maybeSingle();

    return !!data;
  }

  // Comment methods
  async getComments(videoId: string) {
    console.log('Loading comments for video:', videoId);
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        video_id,
        user_id,
        parent_id,
        depth,
        text,
        created_at,
        updated_at,
        profiles (
          id,
          name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    console.log('Loaded comments:', data?.length || 0);
    
    // Transform flat array into threaded structure
    const comments = data || [];
    const threaded = this.buildCommentTree(comments);
    
    console.log('Threaded comments:', threaded.length);
    return threaded;
  }

  private buildCommentTree(comments: any[]): any[] {
    const commentMap = new Map();
    const topLevelComments: any[] = [];
    
    // First pass: create map and add replies array
    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });
    
    // Second pass: build tree structure
    comments.forEach(comment => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        topLevelComments.push(comment);
      }
    });
    
    return topLevelComments;
  }

  async addComment(videoId: string, text: string, parentId?: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Adding comment to video:', videoId, 'by user:', user.id);
    
    let depth = 0;
    if (parentId) {
      console.log('This is a reply to comment:', parentId);
      // Get parent comment to determine depth
      const { data: parentComment } = await supabase
        .from('comments')
        .select('depth')
        .eq('id', parentId)
        .single();
      
      if (parentComment) {
        depth = Math.min((parentComment.depth || 0) + 1, 3); // Max 3 levels deep
      }
    }

    console.log('Inserting comment with depth:', depth);
    
    const { data, error } = await supabase
      .from('comments')
      .insert({
        video_id: videoId,
        user_id: user.id,
        text,
        parent_id: parentId || null,
        depth,
      })
      .select(`
        *,
        profiles (
          id,
          name,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    
    console.log('Successfully added comment:', data);
    
    // Add empty replies array for consistency
    if (data) {
      data.replies = [];
    }
    
    return data;
  }

  // Get fresh video counts from database
  async getVideoCounts(videoId: string) {
    console.log('Refreshing counts for video:', videoId);
    const { data, error } = await supabase
      .from('videos')
      .select('likes_count, comments_count, views_count')
      .eq('id', videoId)
      .single();

    if (error) throw error;
    
    console.log('Current video counts:', data);
    return {
      likes_count: data.likes_count || 0,
      comments_count: data.comments_count || 0,
      views_count: data.views_count || 0
    };
  }

  // Review methods
  async createReview(reviewData: {
    restaurant_id: string;
    rating: number;
    comment: string;
    images?: string[];
  }) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // First check if user has a confirmed booking for this restaurant
    const { count: bookingCount, error: bookingError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', reviewData.restaurant_id)
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'completed'])
      .maybeSingle();
    
    if (bookingError) {
      console.error('Error checking booking status:', bookingError);
    }
    
    if (bookingCount === 0) {
      throw new Error('You can only review restaurants after you have visited with a confirmed booking');
    }

    // Validate input data
    if (!reviewData.comment || reviewData.comment.trim().length === 0) {
      throw new Error('Review comment cannot be empty');
    }

    if (reviewData.rating < 1 || reviewData.rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars');
    }

    // Check if user already has a review for this restaurant
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('restaurant_id', reviewData.restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingReview) {
      throw new Error('You have already reviewed this restaurant');
    }

    // Check if user owns this restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('owner_id')
      .eq('id', reviewData.restaurant_id)
      .single();

    if (restaurant && restaurant.owner_id === user.id) {
      throw new Error('You cannot review your own restaurant');
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        restaurant_id: reviewData.restaurant_id,
        user_id: user.id,
        rating: reviewData.rating,
        comment: reviewData.comment.trim(),
        images: reviewData.images || [],
      })
      .select(`
        *,
        profiles (
          name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('Review creation error:', error);
      if (error.code === '23505') {
        throw new Error('You have already reviewed this restaurant');
      } else if (error.code === '23514') {
        throw new Error('Invalid review data. Please check your rating and comment.');
      } else {
        throw new Error('Failed to submit review. Please try again.');
      }
    }

    // Wait a moment for the trigger to update the restaurant rating
    await new Promise(resolve => setTimeout(resolve, 500));
    return data;
  }

  async getReviews(restaurantId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles (
          name,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getUserReviews(userId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        restaurants (
          id,
          name,
          cuisine,
          image_url,
          city,
          country
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Notification methods
  async createNotification(
    userId: string,
    type: Database['public']['Tables']['notifications']['Row']['type'],
    title: string,
    message: string,
    data: any = {}
  ) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
      })
      .select()
      .single();

    if (error) throw error;

    // Send push notification to mobile device
    try {
      await this.sendPushNotification(userId, title, message, data);
    } catch (pushError) {
      console.error('Failed to send push notification:', pushError);
      // Don't fail the whole operation if push notification fails
    }

    return notification;
  }

  private async sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('No session found, skipping push notification');
        return;
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          title,
          body,
          data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Push notification API error:', errorData);
      } else {
        console.log('Push notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send push notification via API:', error);
    }
  }

  async getNotifications() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  }

  async getUnreadNotificationCount() {
    const user = await this.getCurrentUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  }

  // Analytics
  async trackVideoEvent(videoId: string, eventType: Database['public']['Tables']['video_analytics']['Row']['event_type']) {
    const user = await this.getCurrentUser();
    
    const { error } = await supabase
      .from('video_analytics')
      .insert({
        video_id: videoId,
        user_id: user?.id,
        event_type: eventType,
      });

    if (error) console.error('Analytics error:', error);
  }

  // Menu methods
  async getMenuItems(restaurantId: string) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .order('category')
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async createMenuItem(menuItem: Omit<Database['public']['Tables']['menu_items']['Insert'], 'restaurant_id'>, restaurantId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    if (user.account_type !== 'business') throw new Error('Only business accounts can create menu items');

    // Verify restaurant ownership
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('owner_id')
      .eq('id', restaurantId)
      .single();

    if (!restaurant || restaurant.owner_id !== user.id) {
      throw new Error('Not authorized to add menu items to this restaurant');
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        ...menuItem,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMenuItem(menuItemId: string, updates: Partial<Database['public']['Tables']['menu_items']['Update']>) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership through restaurant
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select(`
        restaurant_id,
        restaurants!inner (
          owner_id
        )
      `)
      .eq('id', menuItemId)
      .single();

    if (!menuItem || (menuItem.restaurants as any)?.owner_id !== user.id) {
      throw new Error('Not authorized to update this menu item');
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', menuItemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMenuItem(menuItemId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership through restaurant
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select(`
        restaurant_id,
        restaurants!inner (
          owner_id
        )
      `)
      .eq('id', menuItemId)
      .single();

    if (!menuItem || (menuItem.restaurants as any)?.owner_id !== user.id) {
      throw new Error('Not authorized to delete this menu item');
    }

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', menuItemId);

    if (error) throw error;
  }

  async getMenuCategories(restaurantId: string) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('category')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true);

    if (error) throw error;
    
    // Get unique categories
    const categories = [...new Set((data || []).map(item => item.category))];
    return categories.sort();
  }

  // Badge methods
  async getUserBadges(userId: string) {
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        *,
        badge_definitions (
          name,
          icon,
          color,
          description
        )
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getUserReviewCount(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_review_count', { user_uuid: userId });

    if (error) {
      console.error('Failed to get user review count:', error);
      return 0;
    }
    
    return data || 0;
  }

  async getUserHighestBadge(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_highest_badge', { user_uuid: userId });

    if (error) throw error;
    return data?.[0] || null;
  }

  async hasConfirmedBooking(restaurantId: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user) return false;

    const { count, error } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'completed']);

    if (error) {
      console.error('Error checking for confirmed booking:', error);
      return false;
    }

    return count > 0;
  }

  async getRestaurantBadges(restaurantId: string) {
    const { data, error } = await supabase
      .from('restaurant_badges')
      .select(`
        *,
        badge_definitions (
          name,
          icon,
          color,
          description
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAllBadgeDefinitions() {
    const { data, error } = await supabase
      .from('badge_definitions')
      .select('*')
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }
  
  // Favorites methods
  async toggleFavoriteRestaurant(restaurantId: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    // Check if already favorited
    const isFavorited = await this.isRestaurantFavorited(restaurantId);
    
    if (isFavorited) {
      // Remove from favorites
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id);
        
      if (error) throw error;
      return false;
    } else {
      // Add to favorites
      const { data, error } = await supabase
        .from('favorites')
        .insert({
          restaurant_id: restaurantId,
          user_id: user.id,
        })
        .select()
        .single();
        
      if (error) throw error;
      return true;
    }
  }
  
  async isRestaurantFavorited(restaurantId: string) {
    const user = await this.getCurrentUser();
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
    
    return !!data;
  }
  
  async getRestaurantFavoritesCount(restaurantId: string) {
    const { data, error } = await supabase
      .rpc('get_restaurant_favorites_count', { p_restaurant_id: restaurantId });
      
    if (error) {
      console.error('Error getting favorites count:', error);
      return 0;
    }
    
    return data || 0;
  }
  
  async getUserFavoriteRestaurants() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        restaurant_id,
        created_at,
        restaurants (
          id,
          name,
          cuisine,
          city,
          country,
          rating,
          review_count,
          image_url,
          price_range
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Transform data to simplify structure
    return (data || []).map(item => ({
      id: item.restaurant_id,
      ...item.restaurants,
      favorited_at: item.created_at
    }));
  }

  // Sync account type with subscription status
  async syncAccountTypeWithSubscription() {
    const user = await this.getCurrentUser();
    if (!user) return;

    try {
      // Get user's subscription status
      const { data: subscription } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status')
        .maybeSingle();

      const hasActiveSubscription = subscription && 
        ['active', 'trialing'].includes(subscription.subscription_status);

      // Determine what account type should be
      const shouldBeBusinessAccount = hasActiveSubscription;
      const currentAccountType = user.account_type;

      // Only update if there's a mismatch
      if (shouldBeBusinessAccount && currentAccountType !== 'business') {
        console.log('User has active subscription, upgrading to business account');
        await this.updateProfile(user.id, { account_type: 'business' });
      } else if (!shouldBeBusinessAccount && currentAccountType === 'business') {
        // Only downgrade if they explicitly don't have a subscription
        // (not if we can't check - to avoid accidental downgrades)
        if (subscription && !hasActiveSubscription) {
          console.log('User subscription expired, downgrading to user account');
          await this.updateProfile(user.id, { account_type: 'user' });
        }
      }
    } catch (error) {
      console.error('Failed to sync account type with subscription:', error);
      // Don't throw error - this shouldn't break the user experience
    }
  }

  // Utility methods
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const api = new SupabaseAPI();