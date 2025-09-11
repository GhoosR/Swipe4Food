import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LanguageSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export default function LanguageSelector({ visible, onClose }: LanguageSelectorProps) {
  const { locale, setLocale, t, supportedLocales } = useLanguage();

  const handleLanguageSelect = async (code: string) => {
    await setLocale(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('language.selectLanguage')}</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#2D3748" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {supportedLocales.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageOption,
                locale === language.code && styles.selectedLanguage
              ]}
              onPress={() => handleLanguageSelect(language.code)}
            >
              <Text style={[
                styles.languageName,
                locale === language.code && styles.selectedLanguageName
              ]}>
                {t(`language.${language.code}`)}
              </Text>
              {language.code !== 'en' && (
                <Text style={[
                  styles.nativeName,
                  locale === language.code && styles.selectedNativeName
                ]}>
                  {language.name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  languageOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedLanguage: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  languageName: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
  },
  selectedLanguageName: {
    color: 'white',
    fontFamily: 'Poppins-SemiBold',
  },
  nativeName: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginTop: 4,
  },
  selectedNativeName: {
    color: 'rgba(255, 255, 255, 0.8)',
  }
});