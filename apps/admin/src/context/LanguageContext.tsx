'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import en from '@/locales/en.json'
import id from '@/locales/id.json'

export const languageCatalog = {
  id: { label: 'Bahasa Indonesia', locale: 'id-ID', messages: id },
  en: { label: 'English', locale: 'en-US', messages: en },
} as const

export type Language = keyof typeof languageCatalog
export type TranslationValues = Record<string, string | number>
export type TranslationOptions = {
  fallback?: string
  values?: TranslationValues
}
export type TranslationFunction = (key: string, options?: TranslationOptions) => string

export const DEFAULT_LANGUAGE: Language = 'id'

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && value in languageCatalog
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationFunction
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('appLanguage')
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE
  })

  useEffect(() => {
    document.documentElement.lang = languageCatalog[language].locale
  }, [language])

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem('appLanguage', lang)
    document.documentElement.lang = languageCatalog[lang].locale
    setLanguageState(lang)
  }, [])

  const t = useCallback<TranslationFunction>((key, options) => {
    const langData = languageCatalog[language].messages as Record<string, string>
    const fallbackData = languageCatalog[DEFAULT_LANGUAGE].messages as Record<string, string>
    const message = langData[key] ?? fallbackData[key] ?? options?.fallback ?? key
    return interpolate(message, options?.values)
  }, [language])

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
