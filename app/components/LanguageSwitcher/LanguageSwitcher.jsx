// app/components//LanguageSwitcher.jsx
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

export default function LanguageSwitcher() {
  const { locale, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];
  
  const toggleDropdown = () => setIsOpen(!isOpen);
  
  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button 
        onClick={toggleDropdown}
        className="p-2 rounded-md flex items-center gap-2 hover:bg-black hover:bg-opacity-5"
      >
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline-block">{currentLanguage.name}</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 bg-white shadow-md rounded-md border z-50">
          {languages.map(language => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full text-left p-2 hover:bg-gray-100 flex items-center gap-2 ${locale === language.code ? 'font-bold bg-gray-50' : ''}`}
            >
              <span>{language.flag}</span>
              <span>{language.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}