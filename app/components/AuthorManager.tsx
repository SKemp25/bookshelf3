"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Plus, Trash2, Search, Upload, BookPlus } from "lucide-react"
import type { Book } from "@/lib/types"
import AuthorImport from "./AuthorImport"
import { saveUserAuthors } from "@/lib/database"
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics"
import { deduplicateBooks, isAllowedLibraryBook } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { fetchAuthorBooksWithCache } from "@/lib/apiCache"

// Helper function to convert HTTP URLs to HTTPS
function ensureHttps(url: string): string {
  if (!url) return url
  return url.replace(/^http:\/\//, "https://")
}
import { Card, CardContent } from "@/components/ui/card"

interface AuthorManagerProps {
  authors: string[]
  setAuthors: (authors: string[]) => void
  onBooksFound: (books: Book[]) => void
  onAuthorsChange?: (authors: string[]) => void
  userId?: string
}

// Helper function to extract last name for sorting
const getLastName = (fullName: string): string => {
  // Handle cases where fullName might not be a string
  if (!fullName || typeof fullName !== "string") {
    return ""
  }

  const nameParts = fullName.trim().split(" ")
  return nameParts[nameParts.length - 1].toLowerCase()
}

export const normalizeAuthorName = (name: string): string => {
  const normalized = name
    .trim()
    .split(" ")
    .map((word) => {
      // Handle words with apostrophes (like O'Farrell, D'Angelo, etc.)
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part, index) => {
            if (index === 0) {
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            } else {
              return "'" + part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            }
          })
          .join("")
      }
      // Regular word capitalization
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")

  // Handle common author name corrections
  const corrections: { [key: string]: string } = {
    "Phillip Pullman": "Philip Pullman",
    "Phillip Pulman": "Philip Pullman",
    "Philip Pulman": "Philip Pullman",
    "Kristin Hanna": "Kristin Hannah",
    "Kristen Hannah": "Kristin Hannah",
    "Steven King": "Stephen King",
    "J K Rowling": "J.K. Rowling",
    "Jk Rowling": "J.K. Rowling",
    "Maggie O'Farrell": "Maggie O'Farrell", // Ensure proper capitalization
  }

  return corrections[normalized] || normalized
}

/** Same author if they have the same set of words (handles "Kristin Hannah" vs "Hannah, Kristin"). */
function authorNamesMatch(a: string, b: string): boolean {
  const toWords = (s: string) =>
    s
      .toLowerCase()
      .replace(/[,.]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .sort()
  const wordsA = toWords(normalizeAuthorName(a))
  const wordsB = toWords(normalizeAuthorName(b))
  if (wordsA.length !== wordsB.length) return false
  return wordsA.every((w, i) => w === wordsB[i])
}

/** Key that treats case, punctuation and "Last, First" order as the same author. */
function authorGroupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .sort()
    .join(" ")
}

/** Most common "First Last" spelling among a group's variants. */
function pickDisplayName(counts: Map<string, number>): string {
  const entries = Array.from(counts.entries()).sort((a, b) => {
    const aComma = a[0].includes(",") ? 1 : 0
    const bComma = b[0].includes(",") ? 1 : 0
    if (aComma !== bComma) return aComma - bComma
    return b[1] - a[1]
  })
  return entries[0][0]
}

export default function AuthorManager({ authors, setAuthors, onBooksFound, onAuthorsChange, userId }: AuthorManagerProps) {
  const [newAuthor, setNewAuthor] = useState("")
  const [searchTitle, setSearchTitle] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [isAddingAuthor, setIsAddingAuthor] = useState(false)
  const [addingBookId, setAddingBookId] = useState<string | null>(null)
  const [foundBooks, setFoundBooks] = useState<Book[]>([])
  const [showAuthorVerification, setShowAuthorVerification] = useState(false)
  const [authorCandidates, setAuthorCandidates] = useState<Array<{name: string, sampleBooks: Book[], allBooks: Book[], bookCount: number}>>([])
  const [pendingAuthorName, setPendingAuthorName] = useState<string>("")
  const { toast } = useToast()

  // Clear found books when user manually clears the search field
  useEffect(() => {
    if (searchTitle.trim() === "") {
      setFoundBooks([])
    }
  }, [searchTitle])

  // Backup: always clear "Adding..." after 15s so the UI never stays stuck
  useEffect(() => {
    if (!isAddingAuthor) return
    const backup = setTimeout(() => {
      setIsAddingAuthor(false)
    }, 15_000)
    return () => clearTimeout(backup)
  }, [isAddingAuthor])

  const ADD_AUTHOR_SAFETY_MS = 12_000

  const addAuthor = async () => {
    if (newAuthor.trim() && !authors.some((author) => author.toLowerCase() === newAuthor.toLowerCase())) {
      setIsAddingAuthor(true)

      const normalizedName = normalizeAuthorName(newAuthor)
      const searchedNameLower = normalizedName.toLowerCase()

      const safetyTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ADD_AUTHOR_TIMEOUT")), ADD_AUTHOR_SAFETY_MS)
      })

      try {
        // Use cached API call to check for multiple authors BEFORE adding (race with safety timeout so UI never stays stuck)
        const apiResults = await Promise.race([
          fetchAuthorBooksWithCache(normalizedName),
          safetyTimeout,
        ])
        
        // Filter out books where author name appears in title but author is different
        // Only include books where the author field actually matches EXACTLY
        const validBooks = apiResults.filter((item: any) => {
          const apiAuthor = item.volumeInfo?.authors?.[0] || item.author || ""
          if (!apiAuthor) return false
          
          const bookTitle = (item.volumeInfo?.title || item.title || "").toLowerCase()
          const bookAuthor = normalizeAuthorName(apiAuthor).toLowerCase()
          
          // Exclude books where the searched name appears in title but author is different
          if (bookTitle.includes(searchedNameLower) && !authorNamesMatch(apiAuthor, normalizedName)) {
            return false
          }
          
          // Exact match (same string after normalization)
          if (bookAuthor === searchedNameLower) return true
          
          // Same author by words (handles "Kristin Hannah" vs "Hannah, Kristin" from Open Library etc.)
          if (authorNamesMatch(apiAuthor, normalizedName)) return true
          
          // Allow for suffixes like "Jr.", "Sr.", "III" - check if base name matches
          const searchedBaseName = searchedNameLower.replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "").trim()
          const bookBaseName = bookAuthor.replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "").trim()
          if (searchedBaseName === bookBaseName && searchedBaseName.length > 0) return true
          
          return false
        })
        
        // Group books by author so the picker only appears for genuinely different names.
        // Spelling/case variants ("Barbara Kingsolver", "BARBARA KINGSOLVER", "Kingsolver, Barbara")
        // share one key and are merged into a single author.
        const authorGroups = new Map<string, Book[]>()
        const variantCounts = new Map<string, Map<string, number>>()

        validBooks.forEach((item: any) => {
          const apiAuthor = item.volumeInfo?.authors?.[0] || item.author || ""
          if (!apiAuthor) return

          const key = authorGroupKey(apiAuthor)
          if (!authorGroups.has(key)) {
            authorGroups.set(key, [])
            variantCounts.set(key, new Map())
          }
          authorGroups.get(key)!.push(item)
          const display = normalizeAuthorName(apiAuthor)
          const counts = variantCounts.get(key)!
          counts.set(display, (counts.get(display) || 0) + 1)
        })

        // If multiple distinct authors found, show verification dialog WITHOUT adding author yet
        if (authorGroups.size > 1) {
          const candidates = Array.from(authorGroups.entries()).map(([key, books]) => ({
            name: pickDisplayName(variantCounts.get(key)!),
            sampleBooks: books.slice(0, 3),
            allBooks: books, // Store all books for this candidate
            bookCount: books.length
          }))
          setAuthorCandidates(candidates)
          setShowAuthorVerification(true)
          setIsAddingAuthor(false)
          // Store the pending author name for later use
          setPendingAuthorName(normalizedName)
          return
        }
        
        // Only one author found - proceed with adding (deduplicate first)
        const uniqueAuthors = Array.from(new Set([...authors, normalizedName]))
        const updatedAuthors = uniqueAuthors.sort((a, b) => getLastName(a).localeCompare(getLastName(b)))
        setAuthors(updatedAuthors)
        setNewAuthor("")

        try {
          if (userId) {
            await saveUserAuthors(userId, updatedAuthors)

            await trackEvent(userId, {
              event_type: ANALYTICS_EVENTS.AUTHOR_ADDED,
              event_data: {
                author_name: normalizedName,
                total_authors: updatedAuthors.length,
                timestamp: new Date().toISOString(),
              },
            })
          }
        } catch (error) {
          console.error("Error saving authors to database:", error)
        }
        
        // Use the already-filtered validBooks instead of re-filtering apiResults
        // This ensures we get all books that matched the author, not just exact matches
        // First, process raw API data into Book format if needed
        const processedBooks = validBooks.map((item: any) => {
          // If already processed (has title directly), return as-is
          if (item.title && !item.volumeInfo) {
            return item
          }
          
          // Process raw API data
          const volumeInfo = item.volumeInfo || {}
          let publishedDate = volumeInfo.publishedDate
          if (publishedDate && publishedDate.length === 4) {
            publishedDate = `${publishedDate}-01-01`
          }
          
          return {
            id: item.id,
            title: volumeInfo.title || item.title || "Unknown Title",
            subtitle: volumeInfo.subtitle || item.subtitle || "",
            author: volumeInfo.authors?.[0] || item.author || "Unknown Author",
            authors: volumeInfo.authors || item.authors || [],
            publishedDate: publishedDate || item.publishedDate || "Unknown Date",
            description: volumeInfo.description || item.description || "",
            categories: volumeInfo.categories || item.categories || [],
            language: volumeInfo.language || item.language || "en",
            pageCount: volumeInfo.pageCount || item.pageCount || 0,
            publisher: volumeInfo.publisher || item.publisher || "",
            imageUrl: ensureHttps(volumeInfo.imageLinks?.thumbnail || item.thumbnail || ""),
            thumbnail: ensureHttps(volumeInfo.imageLinks?.thumbnail || item.thumbnail || ""),
            previewLink: ensureHttps(volumeInfo.previewLink || ""),
            infoLink: ensureHttps(volumeInfo.infoLink || ""),
            canonicalVolumeLink: ensureHttps(volumeInfo.canonicalVolumeLink || ""),
          }
        })

        const filteredBooks = processedBooks.filter((book) => isAllowedLibraryBook(book))

        // Get user country from localStorage if available, default to US
        let userCountry = "US"
        try {
          const userPrefsKey = `bookshelf_user_${userId}`
          const userPrefsData = localStorage.getItem(userPrefsKey)
          if (userPrefsData) {
            const userPrefs = JSON.parse(userPrefsData)
            userCountry = userPrefs.country || "US"
          }
        } catch (error) {
          // Default to US if unable to get user country
        }
        
        const deduplicatedBooks = deduplicateBooks(filteredBooks, userCountry)

        onBooksFound(deduplicatedBooks)
        
        toast({
          title: "Author Added Successfully!",
          description: `Found ${deduplicatedBooks.length} books for ${normalizedName}`,
          duration: 4000, // Auto-dismiss after 4 seconds
        })
      } catch (error) {
        const isTimeout = (error as Error)?.message === "ADD_AUTHOR_TIMEOUT"
        if (isTimeout) {
          toast({
            title: "Request took too long",
            description: "The search is taking longer than usual. Please try again in a moment.",
            variant: "destructive",
          })
        } else {
          console.error("Error fetching books for author:", error)
          toast({
            title: "Error Adding Author",
            description: "Failed to fetch books. Please try again.",
            variant: "destructive",
          })
        }
      } finally {
        setIsAddingAuthor(false)
      }
    }
  }

  const removeAuthor = async (authorName: string) => {
    const updatedAuthors = authors.filter((author) => author !== authorName)
    setAuthors(updatedAuthors)

    try {
      if (userId) {
        await saveUserAuthors(userId, updatedAuthors)

        await trackEvent(userId, {
          event_type: ANALYTICS_EVENTS.AUTHOR_REMOVED,
          event_data: {
            author_name: authorName,
            total_authors: updatedAuthors.length,
            timestamp: new Date().toISOString(),
          },
        })
      }
    } catch (error) {
      console.error("Error removing author from database:", error)
    }
  }

  const addAuthorFromBook = async (book: Book) => {
    const authorName = book.author || book.authors?.[0] || "Unknown"
    
    if (!authors.some((author) => author.toLowerCase() === authorName.toLowerCase())) {
      setIsAddingAuthor(true)
      try {
        const normalizedName = normalizeAuthorName(authorName)
        const newAuthorsList = [...authors, normalizedName].sort((a, b) => getLastName(a).localeCompare(getLastName(b)))
        setAuthors(newAuthorsList)
        
        // Also update the parent component's authors list
        onAuthorsChange?.(newAuthorsList)

        // Fetch all books by this author first
        const authorBooks = await fetchAuthorBooksWithCache(normalizedName)
        if (authorBooks && authorBooks.length > 0) {
          // Add all books by this author at once
          onBooksFound(authorBooks)
        } else {
          // If no books found, just add the specific book
          onBooksFound([book])
        }

        if (userId) {
          await saveUserAuthors(userId, newAuthorsList)
          await trackEvent(userId, {
            event_type: ANALYTICS_EVENTS.AUTHOR_ADDED,
            event_data: {
              author_name: normalizedName,
              source: "book_search",
              timestamp: new Date().toISOString(),
            },
          })
        }

        toast({
          title: "Author Added",
          description: `${normalizedName} has been added to your authors list.`,
          duration: 4000, // Auto-dismiss after 4 seconds
        })

        // Clear the found books since we've added the author
        setFoundBooks([])
      } catch (error) {
        console.error("Error adding author:", error)
        toast({
          title: "Error",
          description: "Failed to add author. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsAddingAuthor(false)
      }
    } else {
      toast({
        title: "Author Already Exists",
        description: `${authorName} is already in your authors list.`,
      })
    }
  }

  const addBookOnly = (book: Book) => {
    setAddingBookId(book.id)
    try {
      onBooksFound([book])
      toast({
        title: "Book added",
        description: `"${book.title}" has been added to your bookshelf.`,
      })
    } finally {
      setAddingBookId(null)
    }
  }

  const searchBooks = async () => {
    if (!searchTitle.trim()) return

    console.log("🔍 Starting search for:", searchTitle.trim())
    setIsSearching(true)

    if (userId) {
      await trackEvent(userId, {
        event_type: ANALYTICS_EVENTS.BOOK_SEARCH,
        event_data: {
          search_query: searchTitle.trim(),
          timestamp: new Date().toISOString(),
        },
      })
    }

    try {
      // Use server search API: newest-first so recent publications are never buried (with timeout so UI doesn't stall)
      const apiUrl = `/api/search?title=${encodeURIComponent(searchTitle.trim())}&maxResults=10&lang=en`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25_000)
      const response = await fetch(apiUrl, { cache: "no-store", signal: controller.signal })
      clearTimeout(timeoutId)
      const data = await response.json()
      const rawBooks: Book[] = (Array.isArray(data) ? data : []).filter((book: Book) => isAllowedLibraryBook(book))

      if (rawBooks.length > 0) {
        const searchTerm = searchTitle.trim().toLowerCase()
        const sortedBooks = [...rawBooks].sort((a, b) => {
          const aTitle = (a.title || "").toLowerCase()
          const bTitle = (b.title || "").toLowerCase()
          if (aTitle === searchTerm && bTitle !== searchTerm) return -1
          if (bTitle === searchTerm && aTitle !== searchTerm) return 1
          const aDate = a.publishedDate ? new Date(a.publishedDate).getTime() : 0
          const bDate = b.publishedDate ? new Date(b.publishedDate).getTime() : 0
          return bDate - aDate
        })
        setFoundBooks(sortedBooks.slice(0, 10))
      } else {
        setFoundBooks([])
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        console.warn("Book search timed out")
      } else {
        console.error("Error searching books:", error)
      }
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Author */}
      <div className="space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <Input
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
            placeholder="Enter author name..."
            onKeyPress={(e) => e.key === "Enter" && addAuthor()}
            className="flex-1 min-w-[180px] border-orange-200 focus:border-orange-400"
            disabled={isAddingAuthor}
          />
          <Button
            onClick={addAuthor}
            disabled={!newAuthor.trim() || isAddingAuthor}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isAddingAuthor ? "Adding..." : "Add"}
          </Button>
          {isAddingAuthor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => setIsAddingAuthor(false)}
            >
              Cancel
            </Button>
          )}
        </div>

        <Button
          onClick={() => setShowImport(true)}
          variant="outline"
          className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Authors
        </Button>
      </div>

      {/* Search Books */}
      <div className="border-t border-orange-200 pt-6">
        <div className="mb-3">
          <h4 className="font-semibold text-orange-800 mb-2">Add Books by Title</h4>
          <p className="text-sm text-orange-600">
            Enter a book title to find and add it to your bookshelf. You can then choose to add the author to your authors list.
          </p>
        </div>
        <div className="flex gap-3">
          <Input
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="Type a book title here (e.g., 'The Great Gatsby')"
            onKeyPress={(e) => e.key === "Enter" && searchBooks()}
            className="flex-1 border-orange-200 focus:border-orange-400"
          />
          <Button
            onClick={searchBooks}
            disabled={!searchTitle.trim() || isSearching}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Search className="w-4 h-4 mr-2" />
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Found Books */}
      {foundBooks.length > 0 && (
        <div className="border-t border-orange-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-orange-800">Found Books ({foundBooks.length})</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFoundBooks([])}
              className="text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              Clear Results
            </Button>
          </div>
          <div className="space-y-3">
            {foundBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex-1">
                  <div className="font-medium text-orange-900">{book.title}</div>
                  <div className="text-sm text-orange-700">by {book.author}</div>
                  {book.publishedDate && (
                    <div className="text-xs text-orange-500">
                      Published: {new Date(book.publishedDate).getFullYear()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  {!authors.some((author) => author.toLowerCase() === book.author.toLowerCase()) ? (
                    <Button
                      size="sm"
                      onClick={() => addAuthorFromBook(book)}
                      disabled={isAddingAuthor}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Author
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addBookOnly(book)}
                        disabled={addingBookId === book.id}
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <BookPlus className="w-3 h-3 mr-1" />
                        {addingBookId === book.id ? "Adding…" : "Add Book"}
                      </Button>
                      <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded">
                        Author on list
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-orange-600">
            💡 New author? Click "Add Author" to add them and their books. Author already on your list? Click "Add Book" to add just this title to your shelf.
          </div>
        </div>
      )}

      {/* Authors List */}
      {authors.length > 0 && (
        <div className="border-t border-orange-200 pt-6">
          <h4 className="font-semibold text-orange-800 mb-4">Your Authors ({authors.length})</h4>
          <div className="space-y-2">
            {Array.from(new Set(authors))
              .sort((a, b) => getLastName(a).localeCompare(getLastName(b)))
              .map((author, index) => (
                <div
                  key={`${author}-${index}`}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <span className="font-medium text-orange-900">{author}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAuthor(author)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Author Verification Dialog */}
      <Dialog open={showAuthorVerification} onOpenChange={(open) => {
        setShowAuthorVerification(open)
        if (!open) {
          // Clear pending author name when dialog is closed without selection
          setPendingAuthorName("")
        }
      }}>
        <DialogContent
          className="sm:max-w-2xl bg-white border-orange-200 rounded-2xl max-h-[80vh] overflow-y-auto z-[60]"
          overlayClassName="z-[60]"
        >
          <DialogHeader>
            <DialogTitle className="text-orange-800 font-display text-xl">Multiple Authors Found</DialogTitle>
            <DialogDescription>
              We found multiple authors with similar names. Please select the correct author:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {authorCandidates.map((candidate, index) => (
              <Card key={index} className="border-orange-200 hover:border-orange-400 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-orange-900 mb-2">{candidate.name}</h4>
                      <p className="text-sm text-orange-600 mb-3">{candidate.bookCount} books found</p>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-orange-700">Sample books:</p>
                        {candidate.sampleBooks.map((book: any, bookIndex: number) => (
                          <div key={bookIndex} className="text-xs text-orange-600 pl-2 border-l-2 border-orange-200">
                            • {book.title || book.volumeInfo?.title || 'Unknown Title'} ({book.publishedDate ? new Date(book.publishedDate).getFullYear() : 'Unknown year'})
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={async () => {
                        const selectedAuthor = candidate.name
                        setShowAuthorVerification(false)
                        setIsAddingAuthor(true)
                        
                        try {
                          // Check if author already exists (in case user clicked add before verification)
                          if (authors.some((author) => author.toLowerCase() === selectedAuthor.toLowerCase())) {
                            toast({
                              title: "Author Already Exists",
                              description: `${selectedAuthor} is already in your authors list.`,
                            })
                            setIsAddingAuthor(false)
                            setPendingAuthorName("")
                            return
                          }
                          
                          // Deduplicate authors before adding
                          const uniqueAuthors = Array.from(new Set([...authors, selectedAuthor]))
                          const updatedAuthors = uniqueAuthors.sort((a, b) => getLastName(a).localeCompare(getLastName(b)))
                          setAuthors(updatedAuthors)
                          setNewAuthor("") // Clear the input field
                          setPendingAuthorName("") // Clear pending name
                          
                          if (userId) {
                            await saveUserAuthors(userId, updatedAuthors)
                            await trackEvent(userId, {
                              event_type: ANALYTICS_EVENTS.AUTHOR_ADDED,
                              event_data: {
                                author_name: selectedAuthor,
                                total_authors: updatedAuthors.length,
                                timestamp: new Date().toISOString(),
                              },
                            })
                          }
                          
                          // Use the books that were already grouped for this specific candidate author
                          // This ensures we only get books by the selected author, not from cache of broader search
                          const candidateBooks = candidate.allBooks || []
                          
                          // Process the books to ensure they're in the correct format
                          const processedBooks = candidateBooks.map((item: any) => {
                            // Handle both raw API data and processed Book objects
                            if (item.volumeInfo) {
                              // Raw API data - convert to Book format
                              let publishedDate = item.volumeInfo.publishedDate
                              if (publishedDate && publishedDate.length === 4) {
                                publishedDate = `${publishedDate}-01-01`
                              }
                              return {
                                id: item.id,
                                title: item.volumeInfo.title || "Unknown Title",
                                subtitle: item.volumeInfo.subtitle || "",
                                author: item.volumeInfo.authors?.[0] || "Unknown Author",
                                authors: item.volumeInfo.authors || [],
                                publishedDate: publishedDate || "Unknown Date",
                                description: item.volumeInfo.description || "",
                                categories: item.volumeInfo.categories || [],
                                language: item.volumeInfo.language || "en",
                                pageCount: item.volumeInfo.pageCount || 0,
                                publisher: item.volumeInfo.publisher || "",
                                imageUrl: item.volumeInfo.imageLinks?.thumbnail || "",
                                thumbnail: item.volumeInfo.imageLinks?.thumbnail || "",
                                previewLink: item.volumeInfo.previewLink || "",
                                infoLink: item.volumeInfo.infoLink || "",
                                canonicalVolumeLink: item.volumeInfo.canonicalVolumeLink || "",
                              }
                            } else {
                              // Already processed Book object
                              return item
                            }
                          })
                          
                          const allowedBooks = processedBooks.filter((book: Book) => isAllowedLibraryBook(book))
                          
                          if (allowedBooks && allowedBooks.length > 0) {
                            onBooksFound(allowedBooks)
                          }
                          
                          toast({
                            title: "Author Added",
                            description: `${selectedAuthor} has been added to your authors list.`,
                          })
                        } catch (error) {
                          console.error("Error adding author:", error)
                          toast({
                            title: "Error",
                            description: "Failed to add author. Please try again.",
                            variant: "destructive",
                          })
                        } finally {
                          setIsAddingAuthor(false)
                        }
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-white ml-4"
                    >
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-md bg-white border-orange-200 rounded-2xl z-[60]" overlayClassName="z-[60]">
          <DialogHeader>
            <DialogTitle className="text-orange-800 font-display text-xl">Import Authors</DialogTitle>
          </DialogHeader>
          <AuthorImport 
            onBulkImport={async (books, importedAuthors) => {
              try {
                // Add imported authors to the authors list
                const newAuthorNames = importedAuthors.map(author => author.name)
                const updatedAuthors = [...new Set([...authors, ...newAuthorNames])]
                setAuthors(updatedAuthors)
                
                // Save to database
                if (userId) {
                  await saveUserAuthors(userId, updatedAuthors)
                }
                
                // Add books to the bookshelf
                if (books.length > 0) {
                  onBooksFound(books)
                }
                
                // Track analytics
                if (userId) {
                  await trackEvent(userId, {
                    event_type: ANALYTICS_EVENTS.AUTHOR_ADDED,
                    event_data: {
                      method: 'bulk_import',
                      count: importedAuthors.length,
                      books_count: books.length,
                      timestamp: new Date().toISOString(),
                    },
                  })
                }
                
                toast({
                  title: "Import Successful!",
                  description: `Added ${importedAuthors.length} authors and ${books.length} books`,
                })
              } catch (error) {
                console.error("Error during bulk import:", error)
                toast({
                  title: "Import Error",
                  description: "Failed to save imported data. Please try again.",
                  variant: "destructive",
                })
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
