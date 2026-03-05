import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import es from './translations/es.json';
import en from './translations/en.json';
import pt from './translations/pt.json';
import fr from './translations/fr.json';

const LANGUAGE_KEY = '@fdu_language';

const resources = {
  es: { translation: es },
  en: { translation: en },
  pt: { translation: pt },
  fr: { translation: fr },
};

// Storage adapter for web vs native
const getStoredLanguage = async (): Promise<string | null> => {
  // Skip storage access during SSR
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (Platform.OS === 'web' && window.localStorage) {
    return window.localStorage.getItem(LANGUAGE_KEY);
  }
  
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
};

const setStoredLanguage = async (lang: string): Promise<void> => {
  // Skip storage access during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  if (Platform.OS === 'web' && window.localStorage) {
    window.localStorage.setItem(LANGUAGE_KEY, lang);
  } else {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }
};

const initI18n = async () => {
  let savedLanguage = null;
  
  // Only try to get stored language if not in SSR
  if (typeof window !== 'undefined') {
    savedLanguage = await getStoredLanguage();
  }
  
  if (!savedLanguage) {
    // Get device language
    const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';
    savedLanguage = ['es', 'en', 'pt', 'fr'].includes(deviceLanguage) ? deviceLanguage : 'en';
  }

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
};

export const changeLanguage = async (lang: string) => {
  await setStoredLanguage(lang);
  i18n.changeLanguage(lang);
};

initI18n();

export default i18n;