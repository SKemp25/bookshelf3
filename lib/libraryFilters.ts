export type LibraryBookLike = {
  title?: string
  subtitle?: string
  description?: string
  language?: string | string[]
  publisher?: string
  categories?: string[]
  pageCount?: number
  publishedDate?: string | null
}

const ENGLISH_CODES = new Set(["en", "eng", "english", "und", "undetermined"])

const TITLE_SUMMARY_PATTERNS: RegExp[] = [
  /\bsummar(y|ies)\b/i,
  /\bcondensed\b/i,
  /\babridg(e|ed|ement|ment)\b/i,
  /\bspark\s*notes?\b/i,
  /\bcliffs?\s*notes?\b/i,
  /\bstudy\s+guide\b/i,
  /\bstudy\s+notes\b/i,
  /\brevision\s+notes?\b/i,
  /\bexam\s+notes?\b/i,
  /\bbook\s+notes\b/i,
  /\bplot\s+summary\b/i,
  /\bin\s+a\s+nutshell\b/i,
  /\bshortened\s+(version|edition)\b/i,
  /\bbrief\s+(version|edition)\b/i,
  /\breaders?'?\s+digest\b/i,
  /\bshmoop\b/i,
  /\blitcharts\b/i,
  /\bbrightsummaries\b/i,
  /\bbookcaps\b/i,
  /\bthe\s+essentials?\s+of\b/i,
  /\byoung\s+readers?\s+edition\b/i,
  /\bchildren'?s\s+edition\b/i,
]

const SUBTITLE_SUMMARY_PATTERNS: RegExp[] = [
  /^notes$/i,
  /\bstudy\s+notes\b/i,
  /\bcliffs?\s*notes?\b/i,
  /\bspark\s*notes?\b/i,
  /\bstudy\s+guide\b/i,
]

const DESCRIPTION_SUMMARY_PATTERNS: RegExp[] = [
  /\bthis\s+(book|edition|volume)\s+is\s+a\s+summary\b/i,
  /\bthis\s+is\s+a\s+summary\s+of\b/i,
  /\bbook\s+summary\s+of\b/i,
  /\ba\s+condensed\s+version\s+of\b/i,
  /\ban?\s+abridged\s+(version|edition)\s+of\b/i,
  /\bnot\s+the\s+(original|complete)\s+(book|novel|work)\b/i,
  /\bstudy\s+guide\s+for\b/i,
]

const SUMMARY_PUBLISHERS = [
  "sparknotes",
  "spark notes",
  "cliffs notes",
  "cliff notes",
  "cliffsnotes",
  "shmoop",
  "litcharts",
  "brightsummaries",
  "bookcaps",
  "bookrags",
  "gradesaver",
  "enotes",
  "course hero",
]

const SPECIAL_EDITION_INDICATORS = [
  "penguin readers",
  "elt graded reader",
  "graded reader",
  "elt reader",
  "english language teaching",
  "easy reader",
  "beginner reader",
  "intermediate reader",
  "oxford bookworms",
  "macmillan readers",
  "cambridge readers",
  "black cat",
  "green apple",
  "dominoes",
  "abridged",
  "simplified edition",
  "simplified version",
  "adapted edition",
  "adapted version",
  "retold edition",
  "retold by",
]

const TITLE_RERELEASE_KEYWORDS = [
  "tie-in",
  "movie tie-in",
  "tv tie-in",
  "netflix tie-in",
  "film tie-in",
  "media tie-in",
  "movie edition",
  "tv edition",
  "film edition",
  "netflix edition",
  "streaming edition",
  "television edition",
  "anniversary edition",
  "special edition",
  "collector's edition",
  "collectors edition",
  "deluxe edition",
  "premium edition",
  "limited edition",
  "exclusive edition",
  "gift edition",
  "holiday edition",
  "christmas edition",
  "illustrated edition",
  "boxed set",
  "box set",
  "reissue",
  "reprint",
  "new edition",
  "revised edition",
  "updated edition",
  "expanded edition",
  "enhanced edition",
  "second edition",
  "third edition",
  "fourth edition",
  "fifth edition",
  "movie cover",
  "tv cover",
  "film cover",
  "netflix cover",
  "media tie-in",
  "cinematic edition",
  "theatrical edition",
  "director's cut",
  "extended edition",
  "uncut edition",
  "complete edition",
  "definitive edition",
  "author's preferred edition",
  "restored edition",
  "remastered edition",
  "large print edition",
  "large print",
  "mass market edition",
  "book club edition",
  "movie adaptation",
  "film adaptation",
  "tv adaptation",
  "netflix adaptation",
]

const DESCRIPTION_RERELEASE_KEYWORDS = [
  "movie tie-in",
  "tv tie-in",
  "film tie-in",
  "netflix tie-in",
  "media tie-in",
  "tie-in edition",
  "anniversary edition",
  "special edition",
  "collector's edition",
  "deluxe edition",
  "limited edition",
  "this reissue",
  "this reprint",
  "reissued edition",
  "now a major motion picture",
  "now a netflix series",
  "now a tv series",
  "now a major motion picture",
  "movie tie-in edition",
]

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function languageList(book: LibraryBookLike): string[] {
  if (Array.isArray(book.language)) {
    return book.language.filter((value): value is string => typeof value === "string")
  }
  if (typeof book.language === "string" && book.language.trim()) {
    return [book.language]
  }
  return []
}

export function normalizeLanguageCode(lang: string | null | undefined): string {
  const raw = (lang || "").toLowerCase().trim().replace(/_/g, "-")
  if (!raw) return ""
  if (raw === "eng" || raw === "english") return "en"
  if (raw.startsWith("en-") || raw === "en") return "en"
  return raw
}

export function isEnglishLanguage(lang: string | string[] | null | undefined): boolean {
  const values = Array.isArray(lang) ? lang : [lang || ""]
  if (values.every((value) => !value)) return true
  return values.some((value) => {
    const normalized = normalizeLanguageCode(value)
    return !normalized || ENGLISH_CODES.has(normalized) || normalized === "en"
  })
}

export function editionIdentityText(book: LibraryBookLike): string {
  const categories = Array.isArray(book.categories) ? book.categories.join(" ") : ""
  return [book.title, book.subtitle, book.publisher, categories].filter(Boolean).join(" ").toLowerCase()
}

export function isSummarizedOrStudyGuide(book: LibraryBookLike): boolean {
  const identity = editionIdentityText(book)
  const description = asText(book.description).toLowerCase()
  const publisher = asText(book.publisher).toLowerCase()
  const subtitle = asText(book.subtitle)

  if (SUMMARY_PUBLISHERS.some((name) => publisher.includes(name) || identity.includes(name))) {
    return true
  }
  if (TITLE_SUMMARY_PATTERNS.some((pattern) => pattern.test(identity))) {
    return true
  }
  if (SUBTITLE_SUMMARY_PATTERNS.some((pattern) => pattern.test(subtitle))) {
    return true
  }
  if (DESCRIPTION_SUMMARY_PATTERNS.some((pattern) => pattern.test(description))) {
    return true
  }
  return false
}

export function isCollectedEdition(book: LibraryBookLike): boolean {
  const title = asText(book.title)
  const subtitle = asText(book.subtitle)
  const identity = `${title} ${subtitle}`
  if (/\s\/\s/.test(identity)) return true
  if (/\bomnibus\b/i.test(identity)) return true
  if (/\b(box|boxed)\s+set\b/i.test(identity)) return true
  if (/\bcomplete\s+(trilogy|series|collection|quartet)\b/i.test(identity)) return true
  return false
}

export function isSpecialEdition(book: LibraryBookLike): boolean {
  const identity = editionIdentityText(book)
  const description = asText(book.description).toLowerCase()
  const combined = `${identity} ${description}`
  const title = asText(book.title).toLowerCase()
  const pageCount = book.pageCount || 0

  if (isSummarizedOrStudyGuide(book)) {
    return true
  }

  if (SPECIAL_EDITION_INDICATORS.some((indicator) => combined.includes(indicator))) {
    return true
  }

  if (/\blevel\s+\d+\b/i.test(title) || /\blevel\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(title)) {
    return true
  }

  if (
    pageCount > 0 &&
    pageCount < 100 &&
    (/\breader\b/i.test(combined) || combined.includes("graded") || /\belt\b/i.test(combined) || /\blevel\b/i.test(combined))
  ) {
    return true
  }

  if (/\belt\b/i.test(combined) || combined.includes("english language teaching")) {
    return true
  }

  return false
}

function isLikelyFutureOriginal(book: LibraryBookLike): boolean {
  if (!book.publishedDate) return false
  const year = new Date(book.publishedDate).getFullYear()
  const nextYear = new Date().getFullYear() + 1
  return !Number.isNaN(year) && year >= nextYear
}

const TITLE_PROMO_KEYWORDS = [
  "free preview",
  "sample chapter",
  "preview edition",
  "advance reader",
  "uncorrected proof",
  "not for sale",
  "review copy",
]

const DESCRIPTION_PROMO_PATTERNS: RegExp[] = [
  /\bthis\s+is\s+a\s+free\s+preview\b/i,
  /\badvance\s+reader\s+copy\b/i,
  /\buncorrected\s+proof\b/i,
]

export function isPromotionalCopy(book: LibraryBookLike): boolean {
  const identity = editionIdentityText(book)
  const description = asText(book.description).toLowerCase()
  if (TITLE_PROMO_KEYWORDS.some((keyword) => identity.includes(keyword))) {
    return true
  }
  return DESCRIPTION_PROMO_PATTERNS.some((pattern) => pattern.test(description))
}

export function isRerelease(book: LibraryBookLike): boolean {
  if (isLikelyFutureOriginal(book)) {
    return false
  }

  const identity = editionIdentityText(book)
  const description = asText(book.description).toLowerCase()

  if (TITLE_RERELEASE_KEYWORDS.some((keyword) => identity.includes(keyword))) {
    return true
  }
  if (DESCRIPTION_RERELEASE_KEYWORDS.some((keyword) => description.includes(keyword))) {
    return true
  }
  return false
}

export function isAllowedLibraryBook(book: LibraryBookLike): boolean {
  if (!isEnglishLanguage(book.language)) return false
  if (isSummarizedOrStudyGuide(book)) return false
  if (isCollectedEdition(book)) return false
  if (isSpecialEdition(book)) return false
  if (isRerelease(book)) return false
  if (isPromotionalCopy(book)) return false
  return true
}

export function filterLibraryBooks<T extends LibraryBookLike>(books: T[]): T[] {
  return books.filter((book) => isAllowedLibraryBook(book))
}
