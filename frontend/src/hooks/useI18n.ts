import { useTranslation } from 'react-i18next';

/**
 * Custom hook for i18n with common utilities
 * Provides easy access to translation function and language utilities
 */
export const useI18n = () => {
  const { t, i18n, ready } = useTranslation();

  /**
   * Change language programmatically
   */
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  /**
   * Get current language code
   */
  const currentLanguage = i18n.language;

  /**
   * Check if a translation key exists
   */
  const hasTranslation = (key: string) => {
    return i18n.exists(key);
  };

  /**
   * Get available languages
   */
  const availableLanguages = Object.keys(i18n.options.resources || {});

  return {
    t,
    i18n,
    ready,
    changeLanguage,
    currentLanguage,
    hasTranslation,
    availableLanguages,
  };
};
