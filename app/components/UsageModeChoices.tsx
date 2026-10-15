"use client"

import { Check } from "lucide-react"
import { USAGE_MODES, type UsageMode } from "@/lib/usageMode"

interface UsageModeChoicesProps {
  selected: UsageMode | null
  onChoose: (mode: UsageMode) => void
  /** Settings is narrow, so its cards stack; the first-visit question lays them side by side on a tablet. */
  layout?: "stacked" | "row"
}

/** The three "How would you like MyBookshelf to help?" cards. */
export default function UsageModeChoices({ selected, onChoose, layout = "row" }: UsageModeChoicesProps) {
  return (
    <div
      role="radiogroup"
      aria-label="How would you like MyBookshelf to help?"
      className={layout === "row" ? "grid gap-3 md:grid-cols-3" : "grid gap-3"}
    >
      {(Object.entries(USAGE_MODES) as [UsageMode, (typeof USAGE_MODES)[UsageMode]][]).map(([key, mode]) => {
        const isSelected = selected === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChoose(key)}
            className="theme-choice tap-target relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-colors"
          >
            {isSelected && (
              <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center theme-check rounded-full text-white">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <span className="pr-9 text-lg font-bold leading-snug text-gray-900">{mode.title}</span>
            {mode.includes && <span className="text-sm font-bold text-gray-600">{mode.includes}</span>}
            <ul className="list-disc space-y-1 pl-5 text-base text-gray-800">
              {mode.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}
