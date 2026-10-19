/**
 * "Have I read this?" — finds books on the person's shelf that match what they
 * typed and says plainly whether each one is marked as read.
 */

export type ShelfStatus = "read" | "want" | "passed" | "none"

export interface ShelfBook {
  title: string
  author: string
}

export interface ShelfMatch<B extends ShelfBook = ShelfBook> {
  book: B
  key: string
  status: ShelfStatus
}

export interface ShelfMarks {
  readBooks: Set<string>
  wantToReadBooks: Set<string>
  dontWantBooks: Set<string>
}

/** The key the shelf uses for a book's Read / Want / Pass marks. */
export function shelfKey(book: ShelfBook): string {
  return `${book.title}-${book.author}`
}

/** Lowercase, drop accents and punctuation, and ignore a leading "the", "a" or "an". */
export function normalizeForMatch(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "")
}

function words(text: string): string[] {
  return text.split(" ").filter(Boolean)
}

// Lower score = better match. null = no match.
function score(query: string, book: ShelfBook): number | null {
  const q = normalizeForMatch(query)
  if (!q) return null
  const title = normalizeForMatch(book.title)
  const author = normalizeForMatch(book.author)
  if (title === q) return 0
  if (title.startsWith(q)) return 1
  const titleWords = words(title)
  const queryWords = words(q)
  if (queryWords.every((w) => titleWords.some((t) => t.startsWith(w)))) return 2
  const both = `${title} ${author}`
  if (queryWords.every((w) => words(both).some((t) => t.startsWith(w)))) return 3
  return null
}

function statusOf(key: string, marks: ShelfMarks): ShelfStatus {
  if (marks.readBooks.has(key)) return "read"
  if (marks.wantToReadBooks.has(key)) return "want"
  if (marks.dontWantBooks.has(key)) return "passed"
  return "none"
}

/**
 * Shelf books matching the query, best first. Among equally good matches,
 * books marked as read come first, since that is the question being asked.
 */
export function findOnShelf<B extends ShelfBook>(query: string, books: B[], marks: ShelfMarks, limit = 5): ShelfMatch<B>[] {
  const seen = new Set<string>()
  const scored: { match: ShelfMatch<B>; score: number }[] = []
  for (const book of books) {
    const key = shelfKey(book)
    if (seen.has(key)) continue
    const s = score(query, book)
    if (s === null) continue
    seen.add(key)
    scored.push({ match: { book, key, status: statusOf(key, marks) }, score: s })
  }
  const rank = (m: ShelfMatch<B>) => (m.status === "read" ? 0 : 1)
  scored.sort((a, b) => a.score - b.score || rank(a.match) - rank(b.match) || a.match.book.title.localeCompare(b.match.book.title))
  return scored.slice(0, limit).map((s) => s.match)
}

/** The short, plain answer shown for a match. */
export function answerFor(status: ShelfStatus): string {
  switch (status) {
    case "read":
      return "Yes, you've read this."
    case "want":
      return "Not read yet. It's on your Want to Read list."
    case "passed":
      return "Not read. You marked it Pass."
    default:
      return "Not marked as read."
  }
}
