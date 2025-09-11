import React from 'react';
import { Text, TextProps } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface TranslatedTextProps extends TextProps {
  i18nKey: string;
  options?: any;
  fallback?: string;
}

/**
 * A component that displays translated text based on the current language context
 */
export default function TranslatedText({ 
  i18nKey, 
  options, 
  fallback = '',
  style,
  ...props 
}: TranslatedTextProps) {
  const { t } = useLanguage();
  
  const translatedText = t(i18nKey, options) || fallback;
  
  return (
    <Text style={style} {...props}>
      {translatedText}
    </Text>
  );
}