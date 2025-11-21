import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector/cjs';

// Import translation files
import enCommon from '../../locales/en/common.json';
import enTranslation from '../../locales/en/translation.json';
import arCommon from '../../locales/ar/common.json';
import arTranslation from '../../locales/ar/translation.json';

const resources = {
  en: {
    common: enCommon,
    translation: enTranslation,
  },
  ar: {
    common: arCommon,
    translation: arTranslation,
  },
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    
    // Namespace configuration
    ns: ['translation', 'common'],
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Language detection options
    detection: {
      // Order of language detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Keys to lookup language from
      lookupLocalStorage: 'i18nextLng',
      
      // Cache user language
      caches: ['localStorage'],
    },
    
    // React specific options
    react: {
      useSuspense: false,
    },
  });

// Update HTML direction for RTL languages
i18n.on('languageChanged', (lng) => {
  const html = document.documentElement;
  if (lng === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', lng);
  }
});

// Set initial direction
if (i18n.language === 'ar') {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.setAttribute('lang', 'ar');
} else {
  document.documentElement.setAttribute('dir', 'ltr');
  document.documentElement.setAttribute('lang', i18n.language);
}

export default i18n;
