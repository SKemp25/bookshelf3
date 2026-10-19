"use client"

import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Book } from "@/lib/types"
import { answerFor, findOnShelf, type ShelfStatus } from "@/lib/haveIRead"
import { isToolOn } from "@/lib/usageMode"
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
  onEditNote: (bookId: string, title: string, author: string) => void
  onShowOnShelf: (title: string) => void
}

/**
 * A search at the top of Home that answers one question: is this book marked
 * as read? Shown for "Help me remember" and "Most support".
 */
export default function HaveIReadThis({ books, readBooks, wantToReadBooks, dontWantBooks, bookRatings, bookNotes, onEditNote, onShowOnShelf }: HaveIReadThisProps) {
  const { mode } = useUsageMode()
  const [query, setQuery] = useState("")

  const matches = useMemo(
    () => findOnShelf(query, books, { readBooks, wantToReadBooks, dontWantBooks }),
    [query, books, readBooks, wantToReadBooks, dontWantBooks],
  )

  if (!isToolOn("haveIReadThis", mode) || books.length === 0) return null

  const [best, ...others] = matches
  const typed = query.trim().length > 0
  const rating = best ? bookRatings.get(best.key) : undefined
  const note = best ? bookNotes.get(best.key) : undefined

  return (
    <section className="mb-5 rounded-2xl border-2 border-gray-200 bg-white p-4 md:p-5" aria-labelledby="have-i-read-heading">
      <label id="have-i-read-heading" htmlFor="have-i-read-input" className="mb-2 block text-lg font-bold text-gray-900">
        Have I read this?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input
          id="have-i-read-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a title or author"
          autoComplete="off"
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
              {rating && <p className="mt-1 text-lg text-gray-800">{RATING_TEXT[rating]}</p>}
              {note && (
                <p className="mt-3 whitespace-pre-line border-l-4 theme-bar pl-3 text-lg italic text-gray-900">{note}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="tap-target border-2 border-gray-900 text-base font-bold text-gray-900"
                  onClick={() => onShowOnShelf(best.book.title)}
                >
                  Show on my shelf
                </Button>
                {(note || best.status === "read") && (
                  <Button
                    variant="outline"
                    className="tap-target border-2 border-gray-300 text-base font-bold text-gray-900"
                    onClick={() => onEditNote(best.key, best.book.title, best.book.author)}
                  >
                    {note ? "Edit note" : "Add a note"}
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
    </section>
  )
}
