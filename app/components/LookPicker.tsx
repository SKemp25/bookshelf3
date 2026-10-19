"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { isFeatureOn } from "@/lib/features"
import {
  ACCENTS,
  ACCENT_STORAGE_KEY,
  LOOKS,
  LOOK_STORAGE_KEY,
  OLD_THEME_STORAGE_KEY,
  applyLook,
  normalizeAccent,
  normalizeLook,
  type Accent,
  type Look,
} from "@/lib/look"

/** "Look" (Daytime or Evening) and "Colour" (Penguin orange, green or blue) for the Display settings. Shown with the new look only. */
export default function LookPicker() {
  const [look, setLook] = useState<Look | null>(null)
  const [accent, setAccent] = useState<Accent | null>(null)

  useEffect(() => {
    const read = (key: string) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    }
    setLook(normalizeLook(read(LOOK_STORAGE_KEY)))
    setAccent(normalizeAccent(read(ACCENT_STORAGE_KEY), read(OLD_THEME_STORAGE_KEY)))
  }, [])

  if (!isFeatureOn("newLook") || !look || !accent) return null

  const choose = (nextLook: Look, nextAccent: Accent) => {
    setLook(nextLook)
    setAccent(nextAccent)
    applyLook(nextLook, nextAccent)
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-bold">Look</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Look">
          {(Object.entries(LOOKS) as [Look, (typeof LOOKS)[Look]][]).map(([key, option]) => {
            const Icon = key === "daytime" ? Sun : Moon
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={look === key}
                onClick={() => choose(key, accent)}
                className="theme-choice tap-target flex flex-col items-start gap-2 rounded-2xl border-2 p-3 text-left transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-full items-end gap-1.5 rounded-lg px-3 pb-2"
                  style={{ background: option.colors.bg, boxShadow: `inset 0 0 0 1.5px ${option.colors.line}` }}
                >
                  <span className="h-6 w-3.5 rounded-sm" style={{ background: "#0072BB" }} />
                  <span className="h-8 w-3.5 rounded-sm" style={{ background: key === "daytime" ? ACCENTS[accent].band : ACCENTS[accent].eveningBand }} />
                  <span className="h-5 w-3.5 rounded-sm" style={{ background: "#00845A" }} />
                </span>
                <span className="flex items-center gap-2 text-base font-bold">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {option.label}
                </span>
                <span className="text-sm nl-soft">{option.hint}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-bold">Colour</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Colour">
          {(Object.entries(ACCENTS) as [Accent, (typeof ACCENTS)[Accent]][]).map(([key, option]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={accent === key}
              onClick={() => choose(look, key)}
              className="theme-choice tap-target flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-2 transition-colors"
            >
              <span aria-hidden="true" className="flex h-9 w-9 overflow-hidden rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }}>
                <span className="flex-1" style={{ background: option.band }} />
                <span className="flex-1" style={{ background: option.eveningBand }} />
              </span>
              <span className="text-sm font-bold">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm nl-soft">The colour of the top bar, selected buttons and author names. It stays the same in Daytime and Evening.</p>
      </fieldset>
    </div>
  )
}
