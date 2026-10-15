"use client"

import { useEffect, useState } from "react"
import { isFeatureOn } from "@/lib/features"
import {
  TEXT_SIZES,
  TEXT_SIZE_CHANGED_EVENT,
  TEXT_SIZE_STORAGE_KEY,
  applyTextSize,
  normalizeTextSize,
  type TextSize,
} from "@/lib/textSize"

/** "Text and button size" choice for the Display settings. Hidden while its switch is off. */
export default function TextSizePicker() {
  const [size, setSize] = useState<TextSize | null>(null)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    } catch {}
    setSize(normalizeTextSize(saved))
    // Choosing how MyBookshelf helps also sets the size, so follow changes made elsewhere
    const onChange = (e: Event) => setSize(normalizeTextSize((e as CustomEvent).detail))
    window.addEventListener(TEXT_SIZE_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TEXT_SIZE_CHANGED_EVENT, onChange)
  }, [])

  if (!isFeatureOn("largerButtonsAndText")) return null

  const choose = (next: TextSize) => {
    setSize(next)
    applyTextSize(next)
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-gray-900 mb-2">Text and button size</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text and button size">
        {(Object.entries(TEXT_SIZES) as [TextSize, (typeof TEXT_SIZES)[TextSize]][]).map(([key, option], i) => {
          const selected = size === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(key)}
              className={`tap-target flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 transition-colors ${
                selected ? "border-teal-700 bg-teal-50 text-teal-900" : "border-gray-300 bg-white text-gray-800 hover:border-gray-400"
              }`}
            >
              <span aria-hidden="true" className="font-bold leading-none" style={{ fontSize: `${1.1 + i * 0.35}rem` }}>
                Aa
              </span>
              <span className="text-sm font-bold">{option.label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-sm text-gray-600">You can change this any time. It is saved on this device.</p>
    </fieldset>
  )
}
