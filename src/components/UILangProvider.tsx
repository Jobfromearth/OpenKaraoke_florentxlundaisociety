'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { translations, type UILang, type Translations } from '@/lib/i18n'

interface UILangContextValue {
  lang: UILang
  setLang: (lang: UILang) => void
  t: Translations
}

const UILangContext = createContext<UILangContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: translations.zh,
})

export function UILangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILang>('zh')

  useEffect(() => {
    const saved = localStorage.getItem('uiLang') as UILang | null
    if (saved && saved in translations) setLangState(saved)
  }, [])

  const setLang = (l: UILang) => {
    setLangState(l)
    localStorage.setItem('uiLang', l)
  }

  return (
    <UILangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </UILangContext.Provider>
  )
}

export function useUILang() {
  return useContext(UILangContext)
}
