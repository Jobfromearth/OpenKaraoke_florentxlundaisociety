'use client'

import { useUILang } from '@/components/UILangProvider'

interface TranslationToggleProps {
  showTranslation: boolean
  onToggle: () => void
}

export default function TranslationToggle({ showTranslation, onToggle }: TranslationToggleProps) {
  const { t } = useUILang()
  return (
    <button
      onClick={onToggle}
      className="text-xs px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
      style={
        showTranslation
          ? {
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent-border)',
              color: 'var(--color-accent)',
            }
          : {
              background: 'var(--color-surface-2)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--color-text-3)',
            }
      }
    >
      {showTranslation ? t.hideTranslation : t.showTranslation}
    </button>
  )
}
