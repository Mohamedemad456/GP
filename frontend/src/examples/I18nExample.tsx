import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components';
import { useI18n } from '../hooks/useI18n';

export const I18nExample = () => {
  // Basic usage
  const { t } = useTranslation();
  
  // Advanced usage with custom hook
  const {
    currentLanguage,
    changeLanguage,
    hasTranslation,
    availableLanguages,
  } = useI18n();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">i18next Examples</h1>
      
      {/* Language Switcher */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Language Switcher</h2>
        <LanguageSwitcher />
      </div>

      {/* Basic Translations */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Basic Translations (Common Namespace)</h2>
        <p className="mb-2"><strong>{t('common:welcome')}</strong></p>
        <p className="mb-2">{t('common:hello')}</p>
        <p>{t('common:goodbye')}</p>
      </section>

      {/* Namespace Usage */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Default Namespace</h2>
        <p className="mb-2"><strong>{t('title')}</strong></p>
        <p>{t('description')}</p>
      </section>

      {/* Common Namespace */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Common Namespace</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-500 text-white rounded">
            {t('common:save')}
          </button>
          <button className="px-4 py-2 bg-gray-500 text-white rounded">
            {t('common:cancel')}
          </button>
        </div>
      </section>

      {/* Nested Keys */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Nested Translation Keys</h2>
        <nav className="flex gap-4">
          <a href="#" className="text-blue-600">{t('navigation.home')}</a>
          <a href="#" className="text-blue-600">{t('navigation.about')}</a>
          <a href="#" className="text-blue-600">{t('navigation.contact')}</a>
        </nav>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 bg-green-500 text-white rounded">
            {t('buttons.submit')}
          </button>
          <button className="px-4 py-2 bg-red-500 text-white rounded">
            {t('buttons.delete')}
          </button>
        </div>
      </section>

      {/* Interpolation Example */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Interpolation</h2>
        <p>{t('greeting', { name: 'John' })}</p>
        <p className="mt-2">{t('items', { count: 5 })}</p>
      </section>

      {/* Language Information */}
      <section className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Language Information</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Current Language:</strong> {currentLanguage}</p>
          <p><strong>Available Languages:</strong> {availableLanguages.join(', ')}</p>
          <p><strong>Has 'common:welcome' key:</strong> {hasTranslation('common:welcome') ? 'Yes' : 'No'}</p>
        </div>
      </section>

      {/* Programmatic Language Change */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Programmatic Language Change</h2>
        <div className="flex gap-2">
          <button
            onClick={() => changeLanguage('en')}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            English
          </button>
          <button
            onClick={() => changeLanguage('ar')}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            العربية
          </button>
        </div>
      </section>
    </div>
  );
};
