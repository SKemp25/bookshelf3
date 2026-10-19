"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MONTHS, READ_DATE_CHOICES, choiceFor, readDateFrom, type ReadDate, type ReadDateChoice } from "@/lib/readDates"

export type Rating = "loved" | "liked" | "didnt-like"

export interface DetailsTarget {
  bookId: string
  title: string
  author: string
  /** "finished" when it opens because the book was just marked as read. */
  reason: "finished" | "edit"
}

export interface BookDetails {
  date: ReadDate | null
  rating: Rating | null
  note: string
}

const RATINGS: { id: Rating; label: string }[] = [
  { id: "loved", label: "Loved it" },
  { id: "liked", label: "Liked it" },
  { id: "didnt-like", label: "Not for me" },
]

interface BookDetailsDialogProps {
  target: DetailsTarget | null
  existing: BookDetails
  /** The note field belongs to "Help me remember" and "Most support". */
  showNote: boolean
  onSave: (bookId: string, details: BookDetails) => void
  onClose: () => void
  /** New look: "Not read after all" lives here instead of on the card. */
  onNotRead?: (target: DetailsTarget) => void
}

// Selected state comes from aria-checked via .theme-choice in globals.css.
const pill = "theme-choice min-h-[2.75rem] rounded-xl border-2 px-3 py-2 text-left text-base font-semibold text-gray-900"

/** "When did you finish it?", how it was, and an optional short note. Opens when a book is marked as read. */
export default function BookDetailsDialog({ target, existing, showNote, onSave, onClose, onNotRead }: BookDetailsDialogProps) {
  const now = new Date()
  const [choice, setChoice] = useState<ReadDateChoice | null>(null)
  const [month, setMonth] = useState<number | undefined>()
  const [year, setYear] = useState<number | undefined>()
  const [rating, setRating] = useState<Rating | null>(null)
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!target) return
    const d = existing.date
    setChoice(d ? choiceFor(d, new Date()) : target.reason === "finished" ? "justFinished" : null)
    setMonth(d && "month" in d ? d.month : undefined)
    setYear(d && "year" in d ? d.year : undefined)
    setRating(existing.rating)
    setNote(existing.note)
    // Only when the box opens: `existing` is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const thisYear = now.getFullYear()
  const years = Array.from({ length: 80 }, (_, i) => thisYear - i)
  const monthsThisYear = MONTHS.slice(0, now.getMonth() + 1)

  const save = () => {
    if (!target) return
    // An unfinished month pick keeps whatever date was there before.
    const date = choice ? readDateFrom(choice, now, month, year) ?? existing.date : null
    onSave(target.bookId, { date, rating, note: note.trim() })
    onClose()
  }

  const selectClass = "h-11 rounded-lg border-2 border-gray-300 bg-white px-2 text-base text-gray-900"

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:max-w-lg gap-3">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight">
            When did you finish <i>{target?.title}</i>?
          </DialogTitle>
          <DialogDescription className="text-base text-gray-700">A month is enough. You can change it later.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="When did you finish it?" className="grid grid-cols-2 gap-2">
          {READ_DATE_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={choice === c.id}
              onClick={() => setChoice(choice === c.id ? null : c.id)}
              className={pill}
            >
              <span className="block leading-tight">{c.label}</span>
              <span className="block text-sm font-normal text-gray-600">{c.hint(now)}</span>
            </button>
          ))}
        </div>

        {choice === "earlierThisYear" && (
          <select aria-label="Month" value={month ?? ""} onChange={(e) => setMonth(Number(e.target.value) || undefined)} className={selectClass}>
            <option value="">Month</option>
            {monthsThisYear.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        )}
        {choice === "pickMonth" && (
          <div className="flex gap-2">
            <select aria-label="Month" value={month ?? ""} onChange={(e) => setMonth(Number(e.target.value) || undefined)} className={`${selectClass} flex-1`}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select aria-label="Year" value={year ?? ""} onChange={(e) => setYear(Number(e.target.value) || undefined)} className={`${selectClass} flex-1`}>
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="mb-1 text-base font-bold text-gray-900">How did you find it?</p>
          <div role="radiogroup" aria-label="How did you find it?" className="flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={rating === r.id}
                onClick={() => setRating(rating === r.id ? null : r.id)}
                className={pill}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {showNote && (
          <div>
            <label htmlFor="book-note" className="mb-1 block text-base font-bold text-gray-900">
              Note <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <input
              id="book-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="A character, a scene, who recommended it"
              className="h-11 w-full rounded-lg border-2 border-gray-300 px-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {onNotRead && target?.reason === "edit" && (
            <Button variant="ghost" className="tap-target mr-auto text-base font-bold text-gray-700" onClick={() => onNotRead(target)}>
              Not read after all
            </Button>
          )}
          <Button variant="ghost" className="tap-target text-base font-bold text-gray-700" onClick={onClose}>
            {target?.reason === "finished" ? "Skip for now" : "Cancel"}
          </Button>
          <Button className="tap-target bg-gray-900 text-base font-bold text-white hover:bg-black" onClick={save}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
