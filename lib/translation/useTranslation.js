// lib/useTranslation.js
"use client"
import { useLanguage } from './languageContext';
import { useMemo, useCallback } from 'react';

// Import translations
import enTranslations from '@/locales/en/common.json';
import frTranslations from '@/locales/fr/common.json';
import esTranslations from '@/locales/es/common.json';
import viTranslations from '@/locales/vm/common.json';
import zhTranslations from '@/locales/ch/common.json';

const translations = {
  en: enTranslations,
  fr: frTranslations,
  es: esTranslations,
  vm: viTranslations,  // Add this line
  zh: zhTranslations
};

export const useTranslation = () => {
  const { locale, isInitialized } = useLanguage();
  
  // Memoize the translation function to prevent unnecessary re-renders
  const t = useCallback((key) => {
    try {
      // Split the key by dots to navigate nested objects
      const keys = key.split('.');
      
      // Start with the translations for the current locale or fallback to English
      let result = translations[locale] || translations.en;
      
      // Navigate through the nested object
      for (const k of keys) {
        if (result[k] === undefined) {
          // If translation not found, return the key
          return key;
        }
        result = result[k];
      }
      
      return result;
    } catch (error) {
      // If any error occurs during translation, return the key
      console.error(`Translation error for key: ${key}`, error);
      return key;
    }
  }, [locale]); // Only depend on locale
  
  // Memoize the return value
  const returnValue = useMemo(() => ({
   t,
    locale,
    currentLanguage: locale, // ✅ Add this for backward compatibility
    isInitialized
  }), [t, locale, isInitialized]);
  
  return returnValue;
};

export default useTranslation;