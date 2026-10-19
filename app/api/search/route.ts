import { NextRequest, NextResponse } from "next/server"
import { filterLibraryBooks, isEnglishLanguage, normalizeLanguageCode } from "@/lib/libraryFilters"

// Backup lookups fetch details book by book, which can take longer than the default limit
export const maxDuration = 60

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
    // New and very old books often have no Google cover; Open Library may have one
    // by ISBN (default=false gives a 404, so the app shows its placeholder instead of a blank)
    const thumb =
      volumeInfo?.imageLinks?.thumbnail?.replace("http:", "https:") ||
      volumeInfo?.imageLinks?.smallThumbnail?.replace("http:", "https:") ||
      (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : "")

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

// Book details rarely change, so identical lookups are answered from Vercel's cache
// for a day instead of spending the Google quota again (only successful answers are kept)
const CACHE_A_DAY = { next: { revalidate: 60 * 60 * 24 } }

// When Google refuses (daily quota used up, key problem), stop asking it for a while:
// every refused call still counts against the quota and slows the shelf down
let googlePausedUntil = 0

function googleAvailable(): boolean {
  return Date.now() >= googlePausedUntil
}

async function fetchGoogleJson(url: URL): Promise<any | null> {
  if (!googleAvailable()) return null
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (apiKey) url.searchParams.set("key", apiKey)
  const resp = await fetch(url.toString(), { ...CACHE_A_DAY, signal: AbortSignal.timeout(8000) })
  if (!resp.ok) {
    if (resp.status === 429 || resp.status === 403 || resp.status === 400) {
      googlePausedUntil = Date.now() + 10 * 60 * 1000
    }
    return null
  }
  return resp.json()
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
  const data = await fetchGoogleJson(googleUrl)
  if (!data) return null
  return mapGoogleItems(data?.items)
}

// Google Books answers intermittently, so give each query one retry
async function fetchGoogle(
  query: string,
  maxResults: number,
  orderBy: "relevance" | "newest",
): Promise<NormalizedBook[] | null> {
  for (let attempt = 0; attempt < 2 && googleAvailable(); attempt++) {
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

function titleKey(title: string): string {
  return title
    .toLowerCase()
    .split(":")[0]
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "")
}

// When Google's author search fails, Open Library still lists the author's books
// but without descriptions. Google answers a plain "title author" query reliably,
// so fill each book's missing details from that.
async function fillFromGoogle(book: NormalizedBook): Promise<void> {
  if (!googleAvailable()) return
  try {
    const found = await fetchGoogleOnce(`${book.title} ${book.author}`, 5, "relevance")
    const matches = (found || []).filter(
      (candidate) => titleKey(candidate.title) === titleKey(book.title) && isByAuthor(candidate, book.author),
    )
    const match = matches.find((candidate) => candidate.description) || matches[0]
    if (!match) return
    if (!book.description) book.description = match.description
    if (!book.thumbnail) book.thumbnail = match.thumbnail
    if (!book.isbn) book.isbn = match.isbn
    if (!book.publisher) book.publisher = match.publisher
    if (book.categories.length === 0) book.categories = match.categories
    // Open Library's first-publication year is usually right; take Google's full date when it is the same year
    if (parseInt(match.publishedDate, 10) === parseInt(book.publishedDate, 10)) {
      book.publishedDate = match.publishedDate
    }
  } catch {
    // details are optional
  }
}

// Open Library search results carry no description; the work record does.
async function fetchOpenLibraryDescription(workKey: string): Promise<string> {
  if (!workKey.startsWith("/works/")) return ""
  try {
    const resp = await fetch(`https://openlibrary.org${workKey}.json`, {
      ...CACHE_A_DAY,
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

// Find the Open Library work for a book Google found, then read its description
async function openLibraryDescriptionFor(book: NormalizedBook): Promise<string> {
  try {
    const url = new URL("https://openlibrary.org/search.json")
    url.searchParams.set("title", book.title)
    url.searchParams.set("author", book.author)
    url.searchParams.set("fields", "key,title,author_name")
    url.searchParams.set("limit", "5")
    const resp = await fetch(url.toString(), { ...CACHE_A_DAY, signal: AbortSignal.timeout(4000) })
    if (!resp.ok) return ""
    const data = await resp.json()
    const work = mapOpenLibraryDocs(data?.docs).find(
      (candidate) => titleKey(candidate.title) === titleKey(book.title) && isByAuthor(candidate, book.author),
    )
    return work ? await fetchOpenLibraryDescription(work.id.replace(/^OL/, "")) : ""
  } catch {
    return ""
  }
}

// Descriptions from Google's volume pages and Apple Books carry HTML such as <p> and <br>
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// Google's search results sometimes leave out a description that the
// volume's own page has, especially for recent books
async function googleVolumeDescription(volumeId: string): Promise<string> {
  if (!volumeId || volumeId.startsWith("OL") || volumeId.startsWith("GB-")) return ""
  try {
    const data = await fetchGoogleJson(new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`))
    return typeof data?.volumeInfo?.description === "string" ? plainText(data.volumeInfo.description) : ""
  } catch {
    return ""
  }
}

// Apple Books lists most recent fiction with the publisher's description, needs no key
async function appleBooksDescription(book: NormalizedBook): Promise<string> {
  try {
    const url = new URL("https://itunes.apple.com/search")
    url.searchParams.set("term", `${book.title} ${book.author}`)
    url.searchParams.set("media", "ebook")
    url.searchParams.set("limit", "5")
    url.searchParams.set("country", "US")
    const resp = await fetch(url.toString(), { ...CACHE_A_DAY, signal: AbortSignal.timeout(4000) })
    if (!resp.ok) return ""
    const data = await resp.json()
    const results: any[] = Array.isArray(data?.results) ? data.results : []
    const match = results.find(
      (item) =>
        typeof item?.description === "string" &&
        titleKey(String(item?.trackName || "")) === titleKey(book.title) &&
        isByAuthor({ authors: [String(item?.artistName || "")], author: "" }, book.author),
    )
    return match ? plainText(match.description) : ""
  } catch {
    return ""
  }
}

function copyKey(book: NormalizedBook): string {
  return `${titleKey(book.title)}|${nameWords(book.author).join(" ")}`
}

// Google lists each edition separately and often only some carry a description,
// so let every copy of the same book use the details another copy has
function shareDetailsAcrossCopies(books: NormalizedBook[]): void {
  const best = new Map<string, NormalizedBook>()
  for (const book of books) {
    const key = copyKey(book)
    const found = best.get(key)
    if (!found || (!found.description && book.description)) best.set(key, book)
  }
  for (const book of books) {
    const source = best.get(copyKey(book))
    if (!source || source === book) continue
    if (!book.description) book.description = source.description
    if (!book.thumbnail) book.thumbnail = source.thumbnail
  }
}

// Books that still have no description are looked up one by one: the book's own
// Open Library or Google page, then Apple Books, then Google and Open Library by
// title and author. Apple comes before Google's search so Google's daily quota
// lasts. Stops waiting after budgetMs so the
// shelf is never held up; whatever was found by then is kept.
async function fillMissingDescriptions(books: NormalizedBook[], budgetMs: number): Promise<void> {
  shareDetailsAcrossCopies(books)
  const missing = new Map<string, NormalizedBook>()
  for (const book of books) {
    if (!book.description && !missing.has(copyKey(book))) missing.set(copyKey(book), book)
  }
  if (missing.size === 0) return
  const lookups = Array.from(missing.values())
    .slice(0, 15)
    .map(async (book) => {
      const isOpenLibrary = book.id.startsWith("OL/works/")
      book.description = isOpenLibrary
        ? plainText(await fetchOpenLibraryDescription(book.id.replace(/^OL/, "")))
        : await googleVolumeDescription(book.id)
      if (!book.description) book.description = await appleBooksDescription(book)
      if (!book.description) await fillFromGoogle(book)
      if (!book.description && !isOpenLibrary) book.description = await openLibraryDescriptionFor(book)
    })
  await Promise.race([Promise.all(lookups), new Promise((resolve) => setTimeout(resolve, budgetMs))])
  shareDetailsAcrossCopies(books)
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
      const byAuthor = filterLibraryBooks(await searchGoogleByAuthor(author, 40) || [])
      // Share descriptions before trimming, so a kept edition can use one that is cut
      shareDetailsAcrossCopies(byAuthor)
      const books = newestFirst(byAuthor).slice(0, maxResults)
      if (books.length > 0) {
        await fillMissingDescriptions(books, 8000)
        return NextResponse.json(books)
      }
    } else {
      // A plain-words query first: Google often returns nothing for filter-only queries
      const plain = [q, title, author].filter(Boolean).join(" ")
      const [relevant, filtered] = await Promise.all([
        fetchGoogle(plain, maxResults * 2, "relevance"),
        googleQuery !== plain ? fetchGoogle(googleQuery, maxResults * 2, "relevance") : Promise.resolve(null),
      ])
      let found = mergeById(filtered || [], relevant || [])
      if (author) found = found.filter((book) => isByAuthor(book, author))
      found = filterLibraryBooks(found)
      shareDetailsAcrossCopies(found)
      const books = found.slice(0, maxResults)
      if (books.length > 0) {
        await fillMissingDescriptions(books, 8000)
        return NextResponse.json(books)
      }
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

    const resp = await fetch(olUrl.toString(), { ...CACHE_A_DAY, signal: AbortSignal.timeout(10000) })
    if (!resp.ok) {
      return NextResponse.json([], { status: 200 })
    }
    const data = await resp.json()
    // Open Library's author search also matches other people ("Daniel Gregory Mason" for "Daniel Mason")
    let olBooks = mapOpenLibraryDocs(data?.docs)
    if (author) olBooks = olBooks.filter((book) => isByAuthor(book, author))
    // Open Library often lists the same book several times; keep the earliest so the
    // card shows the first publication and the lookups below are not wasted.
    // Same title by different authors are different books ("Circe" by Madeline Miller and others).
    const firstYear = (b: NormalizedBook) => parseInt(b.publishedDate, 10) || 9999
    const earliest = new Map<string, NormalizedBook>()
    for (const book of olBooks) {
      const key = copyKey(book)
      const kept = earliest.get(key)
      if (!kept || firstYear(book) < firstYear(kept)) earliest.set(key, book)
    }
    olBooks = filterLibraryBooks(Array.from(earliest.values()))
    // An author's books go newest first so recent ones are not cut off the list;
    // a title search keeps Open Library's best matches at the top
    const books = (author && !title ? newestFirst(olBooks) : olBooks).slice(0, maxResults)
    await fillMissingDescriptions(books, 8000)
    return NextResponse.json(books, { status: 200 })
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

