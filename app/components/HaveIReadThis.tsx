"use client"

import { useMemo, useState } from "react"
import { Search, SearchCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Book } from "@/lib/types"
import { answerFor, findOnShelf, type ShelfStatus } from "@/lib/haveIRead"
import { isToolOn } from "@/lib/usageMode"
import { formatReadDate, type ReadDate } from "@/lib/readDates"
import { useUsageMode } from "./useUsageMode"

type Rating = "loved" | "liked" | "didnt-like"

const RATING_TEXT: Record<Rating, string> = {
  loved: "You marked it Loved.",
  liked: "You marked it Liked.",
  "didnt-like": "You marked it Didn't like.",
}

const SHORT_STATUS: Record<ShelfStatus, string> = {
  read: "Read",
  want: "Want to read",
  passed: "Passed",
  none: "Not marked",
}

interface HaveIReadThisProps {
  books: Book[]
  readBooks: Set<string>
  wantToReadBooks: Set<string>
  dontWantBooks: Set<string>
  bookRatings: Map<string, Rating>
  bookNotes: Map<string, string>
  readDates: Map<string, ReadDate>
  onEditNote: (bookId: string, title: string, author: string) => void
  onShowOnShelf: (title: string) => void
}

/**
 * A header button that opens a search answering one question: is this book marked
 * as read? Shown for every help choice.
 */
export default function HaveIReadThis({ books, readBooks, wantToReadBooks, dontWantBooks, bookRatings, bookNotes, readDates, onEditNote, onShowOnShelf }: HaveIReadThisProps) {
  const { mode } = useUsageMode()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  // Every visit starts with an empty search.
  const setOpenAndReset = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  const matches = useMemo(
    () => findOnShelf(query, books, { readBooks, wantToReadBooks, dontWantBooks }),
    [query, books, readBooks, wantToReadBooks, dontWantBooks],
  )

  if (!isToolOn("haveIReadThis", mode) || books.length === 0) return null

  const [best, ...others] = matches
  const typed = query.trim().length > 0
  const rating = best ? bookRatings.get(best.key) : undefined
  const note = best ? bookNotes.get(best.key) : undefined
  const date = best ? readDates.get(best.key) : undefined

  return (
    <>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setOpen(true)}
      aria-label="Have I read this?"
      title="Have I read this?"
      className="tap-target flex h-auto flex-shrink-0 flex-col items-center gap-0.5 px-2 py-1 text-white hover:bg-white/20 xl:flex-row xl:gap-2"
    >
      <SearchCheck className="h-5 w-5" />
      {/* Two short lines on tablets so the words always show without crowding the search box. */}
      <span className="text-[0.7rem] font-semibold leading-tight xl:text-sm">
        Have I <br className="xl:hidden" />read this?
      </span>
    </Button>
    <Dialog open={open} onOpenChange={setOpenAndReset}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-2xl">
          <label htmlFor="have-i-read-input">Have I read this?</label>
        </DialogTitle>
      </DialogHeader>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input
          id="have-i-read-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a title or author"
          autoComplete="off"
          autoFocus
          className="h-14 w-full rounded-xl border-2 border-gray-300 bg-white pl-12 pr-14 text-lg text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {typed && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div aria-live="polite">
        {typed && !best && (
          <p className="mt-4 text-lg text-gray-800">
            No book on your shelf matches “{query.trim()}”. It may be by an author you haven't added yet.
          </p>
        )}

        {best && (
          <div className="mt-4 flex gap-4 rounded-xl border-2 theme-prompt p-4">
            {best.book.thumbnail ? (
              <img src={best.book.thumbnail} alt="" className="h-32 w-[5.5rem] flex-shrink-0 rounded-md object-cover shadow" />
            ) : (
              <div className="h-32 w-[5.5rem] flex-shrink-0 rounded-md bg-gray-200" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight text-gray-900">{answerFor(best.status)}</p>
              <p className="mt-2 text-lg text-gray-800">
                <span className="font-bold">{best.book.title}</span> by {best.book.author}
                {best.book.publishedDate ? `, ${best.book.publishedDate.slice(0, 4)}` : ""}.
              </p>
              {date && (
                <p className="mt-1 text-lg text-gray-800">
                  {"before" in date ? `You read it before ${date.before}.` : `You finished it in ${formatReadDate(date)}.`}
                </p>
              )}
              {rating && <p className="mt-1 text-lg text-gray-800">{RATING_TEXT[rating]}</p>}
              {note && (
                <p className="mt-3 whitespace-pre-line border-l-4 theme-bar pl-3 text-lg italic text-gray-900">{note}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="tap-target border-2 border-gray-900 text-base font-bold text-gray-900"
                  onClick={() => {
                    onShowOnShelf(best.book.title)
                    setOpenAndReset(false)
                  }}
                >
                  Show on my shelf
                </Button>
                {best.status === "read" && (
                  <Button
                    variant="outline"
                    className="tap-target border-2 border-gray-300 text-base font-bold text-gray-900"
                    onClick={() => {
                      onEditNote(best.key, best.book.title, best.book.author)
                      setOpenAndReset(false)
                    }}
                  >
                    {note || date || rating ? "Edit details" : "Add details"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-base font-bold text-gray-700">Other books that match</h3>
            <ul className="flex flex-col gap-2">
              {others.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => setQuery(m.book.title)}
                    className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-left hover:border-gray-400"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold text-gray-900">{m.book.title}</span>
                      <span className="block truncate text-base text-gray-600">{m.book.author}</span>
                    </span>
                    <span className={`flex-shrink-0 text-base font-bold ${m.status === "read" ? "text-gray-900" : "text-gray-500"}`}>
                      {SHORT_STATUS[m.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
