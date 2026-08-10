/**
 * Language Switcher Component
 * 
 * Provides UI for switching between English and Amharic languages
 * with persistence of user preference.
 * 
 * @author Senior Full-Stack Engineer
 * @version 1.0.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const currentLanguage = i18n.language;

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm">
      <Globe size={18} className="text-gray-600 dark:text-gray-300" />
      <select
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
      >
        <option value="en">English</option>
        <option value="am">አማርኛ (Amharic)</option>
      </select>
    </div>
  );
}
