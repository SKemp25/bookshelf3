"use client"

import { useCallback, useEffect, useState } from "react"
import { applyTextSize } from "@/lib/textSize"
import { USAGE_MODES, USAGE_MODE_STORAGE_KEY, normalizeUsageMode, type UsageMode } from "@/lib/usageMode"

const CHANGED_EVENT = "bookshelf:usage-mode-changed"

/** The person's saved choice (null until they choose), shared by every component that shows it. */
export function useUsageMode() {
  const [mode, setMode] = useState<UsageMode | null>(null)

  useEffect(() => {
    try {
      setMode(normalizeUsageMode(localStorage.getItem(USAGE_MODE_STORAGE_KEY)))
    } catch {}
    const onChange = (e: Event) => setMode(normalizeUsageMode((e as CustomEvent).detail))
    window.addEventListener(CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CHANGED_EVENT, onChange)
  }, [])

  const choose = useCallback((next: UsageMode) => {
    try {
      localStorage.setItem(USAGE_MODE_STORAGE_KEY, next)
    } catch {}
    // Each choice comes with a text size; it can still be changed separately afterwards
    applyTextSize(USAGE_MODES[next].textSize)
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: next }))
  }, [])

  return { mode, choose }
}
