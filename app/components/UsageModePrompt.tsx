"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isFeatureOn } from "@/lib/features"
import { USAGE_PROMPT_DISMISSED_KEY, type UsageMode } from "@/lib/usageMode"
import UsageModeChoices from "./UsageModeChoices"
import { useUsageMode } from "./useUsageMode"

/**
 * A quiet card above the shelf asking how MyBookshelf should help, shown until
 * the person chooses or taps "Not now". It never pops up over other screens.
 */
export default function UsageModePrompt() {
  const { mode, choose } = useUsageMode()
  const [dismissed, setDismissed] = useState(true)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<UsageMode | null>(null)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(USAGE_PROMPT_DISMISSED_KEY) === "true")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!isFeatureOn("usageMode") || mode || dismissed) return null

  const notNow = () => {
    setDismissed(true)
    try {
      localStorage.setItem(USAGE_PROMPT_DISMISSED_KEY, "true")
    } catch {}
  }

  return (
    <>
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-teal-700 bg-teal-50 p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">How would you like MyBookshelf to help?</h2>
          <p className="text-base text-gray-700">Choose the level of help that suits you. You can change it later in Settings.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="tap-target text-base font-bold text-gray-700" onClick={notNow}>
            Not now
          </Button>
          <Button className="tap-target bg-teal-700 text-base font-bold text-white hover:bg-teal-800" onClick={() => setOpen(true)}>
            Choose
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">How would you like MyBookshelf to help?</DialogTitle>
            <DialogDescription className="text-base">
              Choose the one that fits today. You can change it at any time in Settings.
            </DialogDescription>
          </DialogHeader>
          <UsageModeChoices selected={pending} onChoose={setPending} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" className="tap-target text-base font-bold" onClick={() => setOpen(false)}>
              Decide later
            </Button>
            <Button
              className="tap-target bg-teal-700 text-base font-bold text-white hover:bg-teal-800"
              disabled={!pending}
              onClick={() => {
                if (pending) choose(pending)
                setOpen(false)
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
