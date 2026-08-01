'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

import en from '@/locales/en.json'
import id from '@/locales/id.json'

const translations = { en, id }

type Language = 'en' | 'id'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('appLanguage')
    return stored === 'en' ? 'en' : 'id'
  })

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem('appLanguage', lang)
    document.documentElement.lang = lang
    setLanguageState(lang)
  }, [])

  const t = (key: string): string => {
    const langData = translations[language] as Record<string, string>
    return langData[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
