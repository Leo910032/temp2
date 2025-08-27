// app/[userId]/components/PublicLanguageSwitcher.jsx
"use client"
import { useLanguage } from '@/lib/translation/languageContext';
import { useState } from 'react';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'vm', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
];

export default function PublicLanguageSwitcher() {
  const { locale, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];
  
  const toggleDropdown = () => setIsOpen(!isOpen);
  
  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };
  
  return (
    <div className="fixed top-4 right-4 z-[999] bg-white bg-opacity-20 backdrop-blur-lg rounded-full border border-white border-opacity-30">
      <div className="relative">
        <button 
          onClick={toggleDropdown}
          className="p-3 rounded-full flex items-center gap-2 hover:bg-white hover:bg-opacity-10 transition-all duration-200"
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <span className="hidden sm:inline-block text-white font-medium">{currentLanguage.name}</span>
        </button>
        
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 bg-white shadow-lg rounded-xl border z-50 min-w-[160px] overflow-hidden">
            {languages.map(language => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 transition-colors ${
                  locale === language.code ? 'font-bold bg-gray-50' : ''
                }`}
              >
                <span className="text-lg">{language.flag}</span>
                <span className="text-gray-700">{language.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}