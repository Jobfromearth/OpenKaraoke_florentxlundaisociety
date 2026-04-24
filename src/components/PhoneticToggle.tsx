'use client'

import { useUILang } from '@/components/UILangProvider'

interface PhoneticToggleProps {
  showPhonetic: boolean
  onToggle: () => void
}

export default function PhoneticToggle({ showPhonetic, onToggle }: PhoneticToggleProps) {
  const { t } = useUILang()

  return (
    <button
      onClick={onToggle}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        showPhonetic
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-gray-50 border-gray-300 text-gray-500'
      }`}
    >
      {showPhonetic ? t.hidePhoneticLabel : t.showPhoneticLabel}
    </button>
  )
}
