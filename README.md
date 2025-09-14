# 🍽️ Swipe4Food - Restaurant Video Discovery App

A modern React Native app built with Expo that allows users to discover restaurants through short video content, similar to TikTok but for food discovery.

## ✨ Features

- **Video Discovery**: Swipe through restaurant videos to discover new places
- **Restaurant Management**: Restaurant owners can upload videos and manage their profiles
- **User Authentication**: Phone number verification with OTP
- **Location-based Search**: Find restaurants within a specified radius
- **Video Upload**: Upload videos with custom thumbnails (60-second limit)
- **Real-time Notifications**: Push notifications for bookings and updates
- **Multi-language Support**: Available in multiple languages
- **Subscription System**: Monthly and yearly subscription plans (Stripe integration)

## 🚀 Tech Stack

- **Frontend**: React Native with Expo SDK 54
- **Navigation**: Expo Router
- **Backend**: Supabase (Database, Auth, Storage)
- **Payments**: Stripe
- **State Management**: React Context
- **Animations**: React Native Reanimated
- **Notifications**: Expo Notifications

## 📱 Screenshots

*Add screenshots of your app here*

## 🛠️ Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)
- Supabase account
- Stripe account

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GhoosR/Swipe4Food.git
   cd Swipe4Food
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_ACCESS_TOKEN=your_expo_access_token
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/`
   - Set up storage buckets for images and videos
   - Configure authentication settings

5. **Set up Stripe**
   - Create a Stripe account
   - Get your API keys
   - Set up webhooks
   - Configure subscription products

## 🚀 Running the App

### Development Build
```bash
# Start the development server
npx expo start

# For development build
npx expo start --dev-client
```

### Expo Go (Limited functionality)
```bash
npx expo start --go
```

## 📁 Project Structure

```
├── app/                    # App screens (Expo Router)
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── restaurant/        # Restaurant-related screens
│   └── subscription/      # Subscription screens
├── components/            # Reusable components
├── contexts/              # React Context providers
├── hooks/                 # Custom React hooks
├── services/              # API services
├── supabase/              # Database migrations and functions
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL migrations in `supabase/migrations/`
3. Set up storage buckets:
   - `images` (for user avatars, restaurant images, video thumbnails)
   - `videos` (for video files)
4. Configure RLS policies
5. Set up Edge Functions for Stripe integration

### Stripe Setup
1. Create products and prices in Stripe Dashboard
2. Set up webhook endpoints
3. Configure environment variables
4. Test with Stripe test mode first

## 📱 Building for Production

### EAS Build
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### App Store Deployment
1. Build production versions
2. Submit to App Store Connect (iOS)
3. Submit to Google Play Console (Android)

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Expo
EXPO_ACCESS_TOKEN=your_expo_access_token

# Stripe (for production)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

## 📝 Database Schema

The app uses the following main tables:
- `profiles` - User profiles
- `restaurants` - Restaurant information
- `videos` - Video content
- `bookings` - Restaurant bookings
- `subscriptions` - User subscriptions
- `comments` - Video comments
- `likes` - Video likes

## 🚀 Deployment

### Supabase Functions
Deploy the Edge Functions:
```bash
supabase functions deploy
```

### Environment Setup
1. Set up production environment variables
2. Configure Stripe live mode
3. Set up production Supabase project
4. Configure app store settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@swipe4food.com or create an issue in this repository.

## 🔄 Recent Updates

- ✅ Upgraded to Expo SDK 54
- ✅ Fixed all native module compatibility issues
- ✅ Implemented custom video thumbnail upload
- ✅ Added 60-second video duration limit
- ✅ Fixed notification toggle functionality
- ✅ Replaced buggy radius slider with button interface
- ✅ Added restaurant website clickable links
- ✅ Fixed all React Native bridge issues

## 📞 Contact

- **Developer**: Rik
- **GitHub**: [@GhoosR](https://github.com/GhoosR)
- **Repository**: [Swipe4Food](https://github.com/GhoosR/Swipe4Food)

---

Made with ❤️ using React Native and Expo
