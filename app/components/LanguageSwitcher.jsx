"use client"
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/translation/languageContext';
import { FaGlobe, FaCheck } from 'react-icons/fa6';

const LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'vm', name: 'Tiếng Việt', flag: '🇻🇳' },
];

export default function LanguageSwitcher({ variant = 'light' }) {
  const { locale, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLanguage = LANGUAGES.find(lang => lang.code === locale) || LANGUAGES[0];

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  // Determine styling based on variant
  const isDark = variant === 'dark';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Language button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
          isDark
            ? 'bg-white/10 border-2 border-white/20 hover:bg-white/20 hover:border-white/40 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Change language"
      >
        <FaGlobe className={`text-lg ${isDark ? 'text-white' : 'text-gray-600'}`} />
        <span className="font-semibold">{currentLanguage.flag}</span>
        <span className="hidden sm:inline font-medium">{currentLanguage.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50 ${
            isDark
              ? 'bg-gray-900/95 backdrop-blur-xl border-2 border-white/20'
              : 'bg-white border border-gray-200'
          }`}
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                isDark
                  ? 'hover:bg-white/10 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              } ${locale === language.code ? (isDark ? 'bg-white/5' : 'bg-gray-50') : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{language.flag}</span>
                <span className="font-medium">{language.name}</span>
              </div>
              {locale === language.code && (
                <FaCheck className={isDark ? 'text-themeGreen' : 'text-green-600'} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
