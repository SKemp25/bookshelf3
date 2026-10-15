"use client"

import { isFeatureOn } from "@/lib/features"
import UsageModeChoices from "./UsageModeChoices"
import { useUsageMode } from "./useUsageMode"

/** "How MyBookshelf helps" in Display settings. Hidden while its switch is off. */
export default function UsageModeSetting() {
  const { mode, choose } = useUsageMode()
  if (!isFeatureOn("usageMode")) return null

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-base font-bold text-gray-900">How MyBookshelf helps</legend>
      <UsageModeChoices selected={mode} onChoose={choose} layout="stacked" />
      <p className="text-sm text-gray-600">Choosing one also sets the text size. You can change either at any time.</p>
    </fieldset>
  )
}
