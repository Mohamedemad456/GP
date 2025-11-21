# i18next Internationalization Guide

This project uses [i18next](https://www.i18next.com/) and [react-i18next](https://react.i18next.com/) for internationalization (i18n) support. This guide will help you understand how to use and maintain the translation system.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Adding New Languages](#adding-new-languages)
- [Adding New Translation Keys](#adding-new-translation-keys)
- [Best Practices](#best-practices)
- [TypeScript Support](#typescript-support)
- [Components](#components)

## Overview

i18next is a powerful internationalization framework for JavaScript that provides:
- Language detection from browser/localStorage
- Namespace support for organizing translations
- Pluralization support
- Interpolation for dynamic values
- TypeScript type safety

## Project Structure

```
src/
├── i18n/
│   ├── config.ts          # i18next configuration
│   ├── types.ts           # TypeScript type definitions
│   └── README.md          # This file
├── locales/
│   ├── en/                # English translations
│   │   ├── common.json    # Common/shared translations
│   │   └── translation.json # Default namespace translations
│   ├── es/                # Spanish translations
│   │   ├── common.json
│   │   └── translation.json
│   └── fr/                # French translations
│       ├── common.json
│       └── translation.json
└── components/
    └── LanguageSwitcher.tsx # Language switching component
```

## Basic Usage

### 1. Using Translations in Components

Use the `useTranslation` hook in your React components:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('welcome')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### 2. Using Namespaces

When using multiple namespaces, specify which one to use:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('common');
  
  return (
    <div>
      <button>{t('save')}</button>
      <button>{t('cancel')}</button>
    </div>
  );
}
```

Or use multiple namespaces:

```tsx
const { t } = useTranslation(['translation', 'common']);

// Access keys from both namespaces
<p>{t('translation:description')}</p>
<p>{t('common:welcome')}</p>
```

### 3. Using Nested Translation Keys

For nested JSON structures, use dot notation:

```tsx
const { t } = useTranslation();

// Access nested keys
<p>{t('navigation.home')}</p>
<button>{t('buttons.submit')}</button>
```

### 4. Interpolation (Dynamic Values)

Pass variables into translations:

```json
{
  "greeting": "Hello, {{name}}!",
  "items": "You have {{count}} items"
}
```

```tsx
const { t } = useTranslation();

<p>{t('greeting', { name: 'John' })}</p>
<p>{t('items', { count: 5 })}</p>
```

### 5. Pluralization

i18next supports plural forms:

```json
{
  "items_zero": "No items",
  "items_one": "One item",
  "items_other": "{{count}} items"
}
```

```tsx
const { t } = useTranslation();

<p>{t('items', { count: 0 })}</p>  // "No items"
<p>{t('items', { count: 1 })}</p>  // "One item"
<p>{t('items', { count: 5 })}</p>  // "5 items"
```

## Advanced Usage

### Programmatically Change Language

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  
  return (
    <button onClick={() => changeLanguage('es')}>
      Switch to Spanish
    </button>
  );
}
```

### Get Current Language

```tsx
const { i18n } = useTranslation();
const currentLanguage = i18n.language; // 'en', 'es', 'fr', etc.
```

### Check if Translation is Ready

```tsx
const { ready } = useTranslation();

if (!ready) {
  return <div>Loading translations...</div>;
}
```

### Using Translation Outside Components

```tsx
import i18n from './i18n/config';

// Get translation
const text = i18n.t('welcome');

// Change language
i18n.changeLanguage('es');

// Check current language
const lang = i18n.language;
```

## Adding New Languages

1. **Create language folder** in `src/locales/`:
   ```
   src/locales/de/  # German example
   ```

2. **Create translation files**:
   - `src/locales/de/common.json`
   - `src/locales/de/translation.json`

3. **Update configuration** in `src/i18n/config.ts`:

```tsx
import deCommon from '../locales/de/common.json';
import deTranslation from '../locales/de/translation.json';

const resources = {
  en: { /* ... */ },
  es: { /* ... */ },
  fr: { /* ... */ },
  de: {
    common: deCommon,
    translation: deTranslation,
  },
};
```

4. **Add to LanguageSwitcher** component (optional):
```tsx
const languages = [
  // ... existing languages
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];
```

## Adding New Translation Keys

1. **Add key to English translation file** (`src/locales/en/translation.json`):
```json
{
  "newKey": "New Translation",
  "nested": {
    "key": "Nested Translation"
  }
}
```

2. **Add same key to all other language files**:
   - `src/locales/es/translation.json`
   - `src/locales/fr/translation.json`
   - etc.

3. **Use in components**:
```tsx
const { t } = useTranslation();
<p>{t('newKey')}</p>
<p>{t('nested.key')}</p>
```

### Pro Tip: Keep Keys Consistent

Always add new keys to all languages at the same time to avoid missing translations.

## Best Practices

### 1. Organize Translations by Feature

For larger applications, organize translations by feature/module:

```
locales/
├── en/
│   ├── common.json        # Shared UI elements
│   ├── auth.json          # Authentication pages
│   ├── dashboard.json     # Dashboard pages
│   └── profile.json       # User profile pages
```

### 2. Use Namespaces Effectively

- `common.json`: Shared UI elements (buttons, labels, messages)
- `translation.json`: Default namespace for general content
- Feature-specific namespaces: Organize by page/feature

### 3. Naming Conventions

- Use camelCase for keys: `saveButton`, `cancelAction`
- Group related keys: `navigation.home`, `navigation.about`
- Be descriptive: `welcomeMessage` instead of `msg1`

### 4. Translation Key Structure

```json
{
  "page": {
    "title": "Page Title",
    "description": "Page description"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "messages": {
    "success": "Operation successful",
    "error": "An error occurred"
  }
}
```

### 5. Handle Missing Translations

i18next will show the translation key if a translation is missing. To debug:

```tsx
const { t, i18n } = useTranslation();

// Check if key exists
if (i18n.exists('myKey')) {
  return <p>{t('myKey')}</p>;
}
```

### 6. Translation Workflow

1. Add keys to English (source language)
2. Mark for translation
3. Export for translators
4. Import translations for other languages
5. Review and test

## TypeScript Support

The project includes TypeScript definitions for type-safe translations:

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

// TypeScript will autocomplete and validate keys
t('welcome'); // ✅ Valid
t('welcomeMessage'); // ✅ Valid if exists
t('invalidKey'); // ⚠️ TypeScript error if key doesn't exist
```

The types are automatically generated from the English translation files. After adding new keys:

1. Update `src/locales/en/*.json`
2. TypeScript will pick up changes automatically
3. Get autocomplete and type checking in your code

## Components

### LanguageSwitcher

A ready-to-use component for switching languages:

```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher';

function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  );
}
```

The component:
- Shows current language with flag emoji
- Provides dropdown to switch languages
- Persists selection in localStorage
- Updates UI immediately when changed

## Language Detection

The configuration automatically detects the user's language in this order:

1. **localStorage** - Previously saved preference
2. **Browser language** - User's browser language setting
3. **HTML lang attribute** - Falls back to HTML tag

The detected language is saved to localStorage as `i18nextLng` for persistence.

## Fallback Language

If a translation key is missing in the current language, i18next will:
1. Check the fallback language (English by default)
2. Show the key itself if not found anywhere

To change the fallback language, update `fallbackLng` in `src/i18n/config.ts`.

## Common Patterns

### Loading State with Translations

```tsx
function LoadingComponent() {
  const { t, ready } = useTranslation();
  
  if (!ready) {
    return <div>Initializing...</div>;
  }
  
  return <div>{t('loading')}</div>;
}
```

### Conditional Translation Based on Count

```tsx
const { t } = useTranslation();

const message = count === 0 
  ? t('items_zero') 
  : count === 1 
  ? t('items_one') 
  : t('items_other', { count });
```

### Date/Number Formatting (Advanced)

For date and number formatting, consider using additional libraries:
- `i18next-icu` for ICU message format
- `date-fns` with locales for date formatting
- Native `Intl` APIs

## Troubleshooting

### Translation Not Showing

1. Check that the key exists in the translation file
2. Verify the namespace is correct
3. Check browser console for i18next errors
4. Ensure i18n config is imported in `main.tsx`

### TypeScript Errors

1. Restart TypeScript server in your IDE
2. Check that keys exist in `src/locales/en/*.json`
3. Verify `src/i18n/types.ts` is properly configured

### Language Not Switching

1. Check browser localStorage
2. Verify language code matches resource keys
3. Check console for errors
4. Ensure `i18n.changeLanguage()` is called correctly

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Best Practices](https://www.i18next.com/principles/best-practices)

## Support

For issues or questions about i18n setup in this project, refer to:
- Project documentation
- i18next official documentation
- Team lead or senior developer

---

**Last Updated**: This documentation reflects the current i18n setup. Update this README when making changes to the translation system.
