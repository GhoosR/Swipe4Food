import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import { api } from '@/services/supabaseApi';
import { useAuth } from './AuthContext';

// Import translations
import en from '@/translations/en.json';
import nl from '@/translations/nl.json';
import es from '@/translations/es.json';
import fr from '@/translations/fr.json';
import de from '@/translations/de.json';
import it from '@/translations/it.json';

// Create the i18n instance
export const i18n = new I18n({
  en,
  nl,
  es,
  fr,
  de,
  it
});

// Set the default locale
i18n.defaultLocale = 'en';
i18n.locale = Localization.locale ? Localization.locale.split('-')[0] : 'en';
i18n.enableFallback = true;

// Define the context type
type LanguageContextType = {
  locale: string;
  t: (scope: string, options?: any) => string;
  setLocale: (locale: string) => Promise<void>;
  isRTL: boolean;
  supportedLocales: { code: string; name: string }[];
};

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Supported locales
const supportedLocales = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' }
];

// Create the provider
export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState(i18n.locale);

  // Check if the current locale is RTL
  const isRTL = ['ar', 'he'].includes(locale);

  useEffect(() => {
    // Load user's preferred language from profile if available
    const loadUserLanguage = async () => {
      if (user) {
        try {
          const profile = await api.getCurrentUser();
          if (profile?.language && profile.language !== locale) {
            i18n.locale = profile.language;
            setLocaleState(profile.language);
          }
        } catch (error) {
          console.error('Failed to load user language preference:', error);
        }
      }
    };

    loadUserLanguage();
  }, [user]);

  // Function to change the locale
  const setLocale = async (newLocale: string) => {
    if (!supportedLocales.some(l => l.code === newLocale)) {
      console.warn(`Unsupported locale: ${newLocale}, falling back to English`);
      newLocale = 'en';
    }

    i18n.locale = newLocale;
    setLocaleState(newLocale);

    // Save user's language preference if logged in
    if (user) {
      try {
        try {
          await api.updateProfile(user.id, { language: newLocale });
        } catch (error: any) {
          // Handle PGRST204 error (schema cache issue)
          if (error?.message?.includes('PGRST204') || error?.code === 'PGRST204') {
            console.warn('Schema cache issue detected when saving language. Setting will work after app restart.');
            // We'll still set the language in memory, but the database update failed
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

  // Translation function
  const t = (scope: string, options?: any) => {
    return i18n.t(scope, options);
  };

  return (
    <LanguageContext.Provider 
      value={{ 
        locale, 
        t, 
        setLocale, 
        isRTL,
        supportedLocales
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// Create the hook
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};