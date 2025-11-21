import 'react-i18next';

// Import the default json module
import enCommon from '../../locales/en/common.json';
import enTranslation from '../../locales/en/translation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof enTranslation;
      common: typeof enCommon;
    };
  }
}
