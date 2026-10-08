import { isAllowedLibraryBook } from "@/lib/libraryFilters"

export {
  isAllowedLibraryBook,
  isEnglishLanguage,
  isRerelease,
  isSpecialEdition,
  isSummarizedOrStudyGuide,
  normalizeLanguageCode,
} from "@/lib/libraryFilters"

export function cn(...inputs: (string | undefined | null | boolean | Record<string, boolean>)[]) {
  return inputs
    .filter(Boolean)
    .map((input) => {
      if (typeof input === "string") return input
      if (typeof input === "object" && input !== null) {
        return Object.entries(input)
          .filter(([, value]) => value)
          .map(([key]) => key)
          .join(" ")
      }
      return ""
    })
    .join(" ")
    .trim()
}

// Normalize a title so different editions of the same book match:
// strips series numbers, edition notes, punctuation and a leading article
// (so "Song of Achilles" and "The Song of Achilles" are one book)
export function normalizeTitleForGrouping(title: string): string {
  return title
    .toLowerCase()
    // Remove series information (e.g., ": CORMORAN STRIKE BOOK 7", "BOOK 1", etc.)
    .replace(/:\s*(book|novel|volume|vol\.?)\s*\d+/gi, "")
    .replace(/\s*\(book\s*\d+\)/gi, "")
    .replace(/\s*\[book\s*\d+\]/gi, "")
    // Remove common subtitle separators and everything after them if they indicate series
    .replace(/:\s*[^:]+(?:book|novel|volume|vol\.?)\s*\d+/gi, "")
    // Remove edition indicators from title
    .replace(/\s*\(.*edition.*\)/gi, "")
    .replace(/\s*\[.*edition.*\]/gi, "")
    // Collapse apostrophes so "DON'T" and "DONT" group together
    .replace(/['\u2019]/g, "")
    // Normalize punctuation and whitespace
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "")
}

// Read/want/pass marks and ratings are keyed by "title-author". When two
// editions merge into one card, move marks from the dropped edition's key to
// the surviving card's key so nothing the reader marked is lost.
export function remapMergedBookIds<T>(entries: Map<string, T>, books: any[]): Map<string, T> {
  const currentIds = new Set(books.map((b) => `${b.title}-${b.author}`))
  let changed = false
  const result = new Map<string, T>()
  for (const [id, value] of entries) {
    if (currentIds.has(id)) {
      if (!result.has(id)) result.set(id, value)
      continue
    }
    const match = books.find((b) => {
      const suffix = `-${b.author}`
      return (
        id.endsWith(suffix) &&
        normalizeTitleForGrouping(id.slice(0, -suffix.length)) === normalizeTitleForGrouping(b.title || "")
      )
    })
    if (match) {
      const newId = `${match.title}-${match.author}`
      if (!result.has(newId)) result.set(newId, value)
      changed = true
    } else {
      result.set(id, value)
    }
  }
  return changed ? result : entries
}

export function deduplicateBooks(books: any[], userCountry: string = "US") {
  const bookGroups = new Map<string, any[]>()

  // First, filter out unwanted editions and group books by normalized title+author
  books.forEach((book) => {
    // English originals only: drop other languages, reissues, and summarized versions
    if (!isAllowedLibraryBook(book)) {
      return
    }
    
    const title = book.title?.toLowerCase() || ""
    const description = book.description?.toLowerCase() || ""

    // Filter out free previews, samples
    if (
      title.includes("free preview") ||
      title.includes("sample") ||
      description.includes("free preview") ||
      description.includes("sample chapter")
    ) {
      return
    }

    // Filter out special editions, reprints, and media tie-ins (title only; description often has "bestselling", etc.)
    const unwantedIndicators = [
      "netflix",
      "tv tie-in",
      "movie tie-in",
      "film tie-in",
      "television tie-in",
      "streaming tie-in",
      "now a major motion picture",
      "now a netflix series",
      "now a tv series",
      "now streaming",
      "coming soon to",
      "movie edition",
      "tv edition",
      "film edition",
      "netflix edition",
      "streaming edition",
      "television edition",
      "anniversary edition",
      "special edition",
      "collector's edition",
      "deluxe edition",
      "premium edition",
      "limited edition",
      "commemorative edition",
      "reissue",
      "reprint",
      "new edition",
      "revised edition",
      "updated edition",
      "expanded edition",
      "enhanced edition",
      "movie cover",
      "tv cover",
      "film cover",
      "netflix cover",
      "media tie-in",
      "adaptation",
      "based on the",
      "inspiration for",
      "soon to be a",
      "major motion picture",
      "blockbuster film",
      "hit series",
      "popular series",
      "bestselling series",
      "award-winning series",
    ]

    const hasUnwantedIndicator = unwantedIndicators.some(
      (indicator) => title.includes(indicator)
    )

    if (hasUnwantedIndicator) {
      return
    }

    // Group all editions of the same book together (no publication year in the key)
    const author = (book.authors?.[0] || book.author || "unknown").toLowerCase().trim()
    const key = `${normalizeTitleForGrouping(book.title || "")}|${author}`

    if (!bookGroups.has(key)) {
      bookGroups.set(key, [])
    }
    bookGroups.get(key)!.push(book)
  })

  // For each group, select the best version (original publication)
  const result: any[] = []

  bookGroups.forEach((bookGroup) => {
    if (bookGroup.length === 1) {
      result.push(bookGroup[0])
      return
    }

    // Sort books to prioritize original publications
    // Default to US if no country specified
    const targetCountry = userCountry || "US"
    const countryCodes: Record<string, string> = {
      "united states": "US",
      "usa": "US",
      "us": "US",
      "united kingdom": "UK",
      "uk": "UK",
      "canada": "CA",
      "australia": "AU",
      "new zealand": "NZ",
      "ireland": "IE",
    }
    const normalizedCountry = countryCodes[targetCountry.toLowerCase()] || targetCountry.toUpperCase()

    const sortedBooks = bookGroup.sort((a, b) => {
      // Priority 1: Filter out special editions, reprints, and media tie-ins
      const unwantedIndicators = [
        "netflix", "tv tie-in", "movie tie-in", "film tie-in", "television tie-in",
        "streaming tie-in", "now a major motion picture", "now a netflix series",
        "now a tv series", "now streaming", "movie edition", "tv edition",
        "film edition", "netflix edition", "streaming edition", "television edition",
        "anniversary edition", "special edition", "collector's edition",
        "deluxe edition", "premium edition", "limited edition", "commemorative edition",
        "reissue", "reprint", "new edition", "revised edition", "updated edition",
        "expanded edition", "enhanced edition", "movie cover", "tv cover", "film cover",
        "netflix cover", "media tie-in", "adaptation", "based on the",
        "inspiration for", "soon to be a", "major motion picture", "blockbuster film",
        "hit series", "popular series", "bestselling series", "award-winning series",
      ]
      
      const titleA = (a.title || "").toLowerCase()
      const descA = (a.description || "").toLowerCase()
      const titleB = (b.title || "").toLowerCase()
      const descB = (b.description || "").toLowerCase()
      
      const hasUnwantedA = unwantedIndicators.some(ind => titleA.includes(ind) || descA.includes(ind))
      const hasUnwantedB = unwantedIndicators.some(ind => titleB.includes(ind) || descB.includes(ind))
      
      if (hasUnwantedA && !hasUnwantedB) return 1
      if (!hasUnwantedA && hasUnwantedB) return -1

      // Priority 2: Earlier publication date (original publication)
      const dateA = a.publishedDate ? new Date(a.publishedDate) : new Date("9999-12-31")
      const dateB = b.publishedDate ? new Date(b.publishedDate) : new Date("9999-12-31")

      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime()
      }

      // Priority 3: Prefer original publishers over reprints
      const publisherA = a.publisher?.toLowerCase() || ""
      const publisherB = b.publisher?.toLowerCase() || ""

      // Common original publishers (prioritize these)
      const originalPublishers = [
        "faber and faber",
        "faber & faber",
        "faber",
        "vintage",
        "vintage books",
        "penguin",
        "penguin books",
        "penguin random house",
        "harpercollins",
        "harper collins",
        "simon & schuster",
        "simon and schuster",
        "macmillan",
        "st. martin's press",
        "st martin's press",
        "little, brown",
        "little brown",
        "doubleday",
        "knopf",
        "random house",
        "houghton mifflin",
        "houghton mifflin harcourt",
        "fsg",
        "farrar, straus and giroux",
        "farrar straus giroux",
        "grove press",
        "atlantic monthly press",
        "w. w. norton",
        "ww norton",
        "norton",
      ]

      const isOriginalA = originalPublishers.some((pub) => publisherA.includes(pub))
      const isOriginalB = originalPublishers.some((pub) => publisherB.includes(pub))

      if (isOriginalA && !isOriginalB) return -1
      if (!isOriginalA && isOriginalB) return 1

      // Priority 4: Prefer books without special edition indicators (already filtered above, but double-check)
      const specialIndicators = ["edition", "reprint", "reissue", "anniversary", "special", "collector", "deluxe", "premium", "limited", "commemorative"]
      const hasSpecialA = specialIndicators.some(
        (indicator) => a.title?.toLowerCase().includes(indicator) || a.description?.toLowerCase().includes(indicator),
      )
      const hasSpecialB = specialIndicators.some(
        (indicator) => b.title?.toLowerCase().includes(indicator) || b.description?.toLowerCase().includes(indicator),
      )

      if (hasSpecialA && !hasSpecialB) return 1
      if (!hasSpecialA && hasSpecialB) return -1

      // Priority 5: Prefer books with more complete information (description weighted higher than thumbnail)
      const completenessA = (a.description ? 2 : 0) + (a.pageCount ? 1 : 0) + (a.thumbnail ? 1 : 0) + (a.isbn ? 1 : 0)
      const completenessB = (b.description ? 2 : 0) + (b.pageCount ? 1 : 0) + (b.thumbnail ? 1 : 0) + (b.isbn ? 1 : 0)

      if (completenessA !== completenessB) {
        return completenessB - completenessA
      }

      return 0
    })

    // Take the best book (first in sorted array), filling any missing
    // description, cover or page count from the other copies of the same book
    const best = { ...sortedBooks[0] }
    for (const other of sortedBooks.slice(1)) {
      if (!best.description && other.description) best.description = other.description
      if (!best.thumbnail && other.thumbnail) best.thumbnail = other.thumbnail
      if (!best.pageCount && other.pageCount) best.pageCount = other.pageCount
    }
    result.push(best)
  })

  return result
}
