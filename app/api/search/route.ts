import { NextRequest, NextResponse } from "next/server"
import { filterLibraryBooks, isEnglishLanguage, normalizeLanguageCode } from "@/lib/libraryFilters"

type NormalizedBook = {
  id: string
  title: string
  subtitle: string
  author: string
  authors: string[]
  publishedDate: string
  description: string
  thumbnail: string
  language: string
  isbn: string
  publisher: string
  categories: string[]
}

function normalizeLang(lang: string | null | undefined): string {
  return normalizeLanguageCode(lang) || "en"
}

function toPublishedDate(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}-01-01`
  }
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return "Unknown Date"
    if (/^\d{4}$/.test(s)) return `${s}-01-01`
    return s
  }
  return "Unknown Date"
}

function asArrayStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string") as string[]
  return []
}

function mapGoogleItems(items: any[] | undefined): NormalizedBook[] {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    const volumeInfo = item?.volumeInfo || {}
    const authors = asArrayStrings(volumeInfo.authors)
    const author = authors[0] || "Unknown Author"
    const isbn =
      volumeInfo?.industryIdentifiers?.find((id: any) => id?.type === "ISBN_13")?.identifier ||
      volumeInfo?.industryIdentifiers?.find((id: any) => id?.type === "ISBN_10")?.identifier ||
      ""
    const thumb =
      volumeInfo?.imageLinks?.thumbnail?.replace("http:", "https:") ||
      volumeInfo?.imageLinks?.smallThumbnail?.replace("http:", "https:") ||
      ""

    return {
      id: String(item?.id || `GB-${(volumeInfo?.title || "unknown").replace(/\s+/g, "")}-${author.replace(/\s+/g, "")}`),
      title: String(volumeInfo?.title || "Unknown Title"),
      subtitle: String(volumeInfo?.subtitle || ""),
      author,
      authors: authors.length > 0 ? authors : [author],
      publishedDate: toPublishedDate(volumeInfo?.publishedDate),
      description: String(volumeInfo?.description || ""),
      thumbnail: String(thumb || ""),
      language: normalizeLang(volumeInfo?.language),
      isbn: String(isbn || ""),
      publisher: String(volumeInfo?.publisher || ""),
      categories: asArrayStrings(volumeInfo?.categories),
    }
  })
}

function mapOpenLibraryDocs(docs: any[] | undefined): NormalizedBook[] {
  if (!Array.isArray(docs)) return []
  return docs.map((doc) => {
    const authors = asArrayStrings(doc?.author_name)
    const author = authors[0] || "Unknown Author"
    const workKey: string = typeof doc?.key === "string" ? doc.key : ""
    const coverId = doc?.cover_i
    const isbn = Array.isArray(doc?.isbn) && typeof doc.isbn[0] === "string" ? doc.isbn[0] : ""
    const coverEdition = typeof doc?.cover_edition_key === "string" ? doc.cover_edition_key : ""
    // default=false makes Open Library return 404 (so the app shows its placeholder)
    // instead of a blank 1x1 image when it has no cover
    const thumbnail =
      typeof coverId === "number"
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : coverEdition
          ? `https://covers.openlibrary.org/b/olid/${coverEdition}-L.jpg?default=false`
          : isbn
            ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
            : ""
    const publisher =
      Array.isArray(doc?.publisher) && typeof doc.publisher[0] === "string" ? doc.publisher[0] : ""
    const languages = asArrayStrings(doc?.language)
    const languageRaw = languages.find((lang) => isEnglishLanguage(lang)) || languages[0] || ""

    return {
      id: workKey ? `OL${workKey}` : `OL-${String(doc?.edition_key?.[0] || doc?.cover_edition_key || doc?.title || "unknown")}`,
      title: String(doc?.title || "Unknown Title"),
      subtitle: String(doc?.subtitle || ""),
      author,
      authors: authors.length > 0 ? authors : [author],
      publishedDate: toPublishedDate(doc?.first_publish_year),
      description: "",
      thumbnail,
      language: normalizeLang(languageRaw),
      isbn,
      publisher,
      categories: asArrayStrings(doc?.subject).slice(0, 20),
    }
  })
}

function mergeById(...lists: NormalizedBook[][]): NormalizedBook[] {
  const seen = new Set<string>()
  const merged: NormalizedBook[] = []
  for (const list of lists) {
    for (const book of list) {
      if (seen.has(book.id)) continue
      seen.add(book.id)
      merged.push(book)
    }
  }
  return merged
}

function newestFirst(books: NormalizedBook[]): NormalizedBook[] {
  const year = (b: NormalizedBook) => parseInt(b.publishedDate, 10) || 0
  return [...books].sort((a, b) => year(b) - year(a))
}

async function fetchGoogleOnce(
  query: string,
  maxResults: number,
  orderBy: "relevance" | "newest",
): Promise<NormalizedBook[] | null> {
  const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes")
  googleUrl.searchParams.set("q", query)
  googleUrl.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 40)))
  googleUrl.searchParams.set("printType", "books")
  googleUrl.searchParams.set("langRestrict", "en")
  googleUrl.searchParams.set("orderBy", orderBy)
  // Without a key Google Books shares a tiny anonymous quota and usually answers 429,
  // which pushes every search onto the Open Library fallback (no descriptions, year-only dates).
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (apiKey) googleUrl.searchParams.set("key", apiKey)

  const resp = await fetch(googleUrl.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) })
  if (!resp.ok) return null
  const data = await resp.json()
  return mapGoogleItems(data?.items)
}

// Google Books answers intermittently, so give each query one retry
async function fetchGoogle(
  query: string,
  maxResults: number,
  orderBy: "relevance" | "newest",
): Promise<NormalizedBook[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const books = await fetchGoogleOnce(query, maxResults, orderBy)
      if (books && books.length > 0) return books
      if (books && attempt === 1) return books
    } catch {
      // timeout or network error: retry once
    }
  }
  return null
}

function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
}

// True when one of the book's authors has the same words as the searched name
// ("Kate Atkinson" matches "Atkinson, Kate" but not "Robert Atkinson")
function isByAuthor(book: { authors: string[]; author: string }, searched: string): boolean {
  const target = nameWords(searched).join(" ")
  const names = book.authors.length > 0 ? book.authors : [book.author]
  return names.some((name) => nameWords(name).join(" ") === target)
}

// Google often returns nothing for a query made only of field filters such as
// inauthor:"Kate Atkinson", so ask in several forms and keep the author's books
async function searchGoogleByAuthor(author: string, maxResults: number): Promise<NormalizedBook[] | null> {
  const lastName = author.trim().split(/\s+/).pop() || author
  const queries: Array<[string, "relevance" | "newest"]> = [
    [author, "relevance"],
    [`${author} inauthor:${lastName}`, "relevance"],
    [`inauthor:"${author}"`, "relevance"],
    [author, "newest"],
  ]
  const results = await Promise.all(queries.map(([query, orderBy]) => fetchGoogle(query, maxResults, orderBy)))
  if (results.every((list) => list === null)) return null
  const merged = mergeById(...results.map((list) => list || []))
  return merged.filter((book) => isByAuthor(book, author))
}

// Open Library search results carry no description; the work record does.
async function fetchOpenLibraryDescription(workKey: string): Promise<string> {
  if (!workKey.startsWith("/works/")) return ""
  try {
    const resp = await fetch(`https://openlibrary.org${workKey}.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (!resp.ok) return ""
    const work = await resp.json()
    if (typeof work?.description === "string") return work.description
    if (typeof work?.description?.value === "string") return work.description.value
  } catch {
    // description is optional
  }
  return ""
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const q = (searchParams.get("q") || "").trim()
  const author = (searchParams.get("author") || "").trim()
  const title = (searchParams.get("title") || "").trim()
  const maxResults = Math.min(Math.max(parseInt(searchParams.get("maxResults") || "10", 10) || 10, 1), 40)

  const googleQuery = (() => {
    if (q) return q
    if (author && title) return `intitle:${title} inauthor:${author}`
    if (author) return `inauthor:"${author}"`
    if (title) return `intitle:${title}`
    return ""
  })()

  if (!googleQuery) {
    return NextResponse.json({ error: "Provide q, title, author, or a combination." }, { status: 400 })
  }

  // 1) Try Google Books first (fast + rich metadata)
  try {
    if (author && !title && !q) {
      // Relevance and newest-first are both asked for, so new releases are not buried
      const byAuthor = await searchGoogleByAuthor(author, 40)
      const books = newestFirst(filterLibraryBooks(byAuthor || [])).slice(0, maxResults)
      if (books.length > 0) return NextResponse.json(books)
    } else {
      // A plain-words query first: Google often returns nothing for filter-only queries
      const plain = [q, title, author].filter(Boolean).join(" ")
      const [relevant, filtered] = await Promise.all([
        fetchGoogle(plain, maxResults * 2, "relevance"),
        googleQuery !== plain ? fetchGoogle(googleQuery, maxResults * 2, "relevance") : Promise.resolve(null),
      ])
      let found = mergeById(filtered || [], relevant || [])
      if (author) found = found.filter((book) => isByAuthor(book, author))
      const books = filterLibraryBooks(found).slice(0, maxResults)
      if (books.length > 0) return NextResponse.json(books)
    }

    // If rate-limited or otherwise failing, fall through to OpenLibrary.
  } catch {
    // ignore and fall back
  }

  // 2) Fallback: OpenLibrary Search API (no key; server-side avoids browser CORS blocks)
  try {
    const olUrl = new URL("https://openlibrary.org/search.json")
    olUrl.searchParams.set("limit", String(Math.min(maxResults * 5, 100)))
    if (author) olUrl.searchParams.set("author", author)
    if (title) olUrl.searchParams.set("title", title)
    if (!author && !title && q) {
      // OpenLibrary uses 'q' for general search
      olUrl.searchParams.set("q", q)
    }
    olUrl.searchParams.set("language", "eng")

    const resp = await fetch(olUrl.toString(), { cache: "no-store" })
    if (!resp.ok) {
      return NextResponse.json([], { status: 200 })
    }
    const data = await resp.json()
    // Newest first before trimming, so recent books are not cut off the list
    const books = newestFirst(filterLibraryBooks(mapOpenLibraryDocs(data?.docs))).slice(0, maxResults)
    const descriptions = await Promise.all(
      books.map((book) => fetchOpenLibraryDescription(book.id.replace(/^OL/, ""))),
    )
    books.forEach((book, i) => {
      book.description = descriptions[i]
    })
    return NextResponse.json(books, { status: 200 })
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

