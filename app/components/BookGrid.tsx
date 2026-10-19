"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BookCheck,
  BookmarkPlus,
  BookX,
  RotateCcw,
  Globe,
  FileText,
  Calendar,
  Headphones,
  ShoppingCart,
  Send,
  BookOpen,
  User,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Check,
  List,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { Book, Platform } from "@/lib/types"
import { formatReadDate, type ReadDate } from "@/lib/readDates"
import { formatBookDate, isJustOut } from "@/lib/bookDates"
import { updateBookStatus } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { isFeatureOn } from "@/lib/features"

interface BookGridProps {
  books: Book[]
  sortBy: string
  readBooks: Set<string>
  wantToReadBooks: Set<string>
  dontWantBooks: Set<string>
  sharedBooks: Set<string>
  friends: string[]
  platforms: Platform[]
  onMarkAsRead: (bookId: string, title: string, author: string) => void
  onUnmarkAsRead?: (bookId: string, title: string, author: string) => void
  onMarkAsWant: (bookId: string, title: string, author: string) => void
  onToggleDontWant: (bookId: string, title: string, author: string) => void
  onSetBookRating?: (bookId: string, rating: "loved" | "liked" | "didnt-like" | null) => void
  bookRatings?: Map<string, "loved" | "liked" | "didnt-like">
  userId?: string // Added userId for database operations
  onBookClick?: (bookId: string) => void // Track recently viewed
  onAuthorClick?: (author: string) => void // New look: show only this author's books
  highContrast?: boolean // High contrast mode
  recommendedAuthors?: Set<string> // Authors that came from recommendations
  onAddAuthor?: (authorName: string) => void // Add all books by an author
  memoryAids?: string[] // Memory aid preferences
  viewMode?: "grid" | "list" // View mode for displaying books
  onSortChange?: (sortBy: string) => void // Callback to change sorting
  emptyStateIconClass?: string // Theme-aware icon class for empty state
  emptyStateTitleClass?: string // Theme-aware title class for empty state
  emptyStateDescClass?: string // Theme-aware description class for empty state
  bookNotes?: Map<string, string> // The reader's own notes, keyed like readBooks
  readDates?: Map<string, ReadDate> // When each book was read
  canEditDetails?: boolean // Whether the "When did you finish it?" box is available
  onEditNote?: (bookId: string, title: string, author: string) => void
}

export default function BookGrid({
  books,
  sortBy,
  readBooks,
  wantToReadBooks,
  dontWantBooks,
  sharedBooks,
  friends,
  platforms,
  onMarkAsRead,
  onUnmarkAsRead,
  onMarkAsWant,
  onToggleDontWant,
  onSetBookRating,
  bookRatings = new Map(),
  userId,
  onBookClick,
  onAuthorClick,
  highContrast = false,
  recommendedAuthors = new Set(),
  onAddAuthor,
  memoryAids = [],
  viewMode = "grid",
  onSortChange,
  emptyStateIconClass = "text-orange-400",
  emptyStateTitleClass = "text-orange-800",
  emptyStateDescClass = "text-orange-600",
  bookNotes = new Map(),
  readDates = new Map(),
  canEditDetails = false,
  onEditNote,
}: BookGridProps) {
  const showCovers = memoryAids.includes("Show book covers")
  const newLook = isFeatureOn("newLook")

  // When it was read and the reader's note sit above the publisher's description.
  // Tapping either opens the "When did you finish it?" box to change them.
  const renderNote = (bookId: string, book: Book) => {
    if (!readBooks.has(bookId)) return null
    const note = bookNotes.get(bookId)
    const date = readDates.get(bookId)
    if (!note && !date && !canEditDetails) return null
    const edit = (e: React.MouseEvent) => {
      e.stopPropagation()
      onEditNote?.(bookId, book.title, book.author)
    }
    return (
      <div className="space-y-1">
        {date ? (
          <button type="button" onClick={edit} className="block min-h-[2.75rem] w-full text-left text-sm font-semibold text-gray-800">
            {"before" in date ? "Read" : "Finished"} {formatReadDate(date).replace("Before", "before")}
            <span className="ml-2 font-normal text-gray-500 underline">Edit</span>
          </button>
        ) : canEditDetails ? (
          <button type="button" onClick={edit} className="block min-h-[2.75rem] w-full text-left text-sm font-semibold text-gray-700 underline">
            Add when you read it
          </button>
        ) : null}
        {note && (
          <button
            type="button"
            onClick={edit}
            className="block w-full rounded-lg border-l-4 theme-bar bg-gray-50 px-3 py-2 text-left"
            aria-label={`Your note on ${book.title}. Tap to edit.`}
          >
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-600">Your note</span>
            <span className="block whitespace-pre-line text-sm italic text-gray-900">{note}</span>
          </button>
        )}
      </div>
    )
  }
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const [expandedMobileDescriptions, setExpandedMobileDescriptions] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set())
  const [showSeriesForBookId, setShowSeriesForBookId] = useState<string | null>(null)
  const { toast } = useToast()
  const isMobile = useIsMobile()
  
  const toggleMobileDescription = (bookId: string) => {
    setExpandedMobileDescriptions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookId)) {
        newSet.delete(bookId)
      } else {
        newSet.add(bookId)
      }
      return newSet
    })
  }

  const handleMarkAsRead = async (bookId: string, title: string, author: string) => {
    if (isUpdating.has(bookId)) return

    setIsUpdating((prev) => new Set([...prev, bookId]))

    try {
      if (userId) {
        await updateBookStatus(userId, bookId, "read")
      }
      onMarkAsRead(bookId, title, author)
      toast({
        title: "Book Marked as Read!",
        description: `"${title}" by ${author}`,
      })
    } catch (error) {
      console.error("Error updating book status to read:", error)
      toast({
        title: "Error",
        description: "Failed to update book status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating((prev) => {
        const newSet = new Set(prev)
        newSet.delete(bookId)
        return newSet
      })
    }
  }

  const handleUnmarkAsRead = async (bookId: string, title: string, author: string) => {
    if (isUpdating.has(bookId)) return

    setIsUpdating((prev) => new Set([...prev, bookId]))

    try {
      if (userId) {
        await updateBookStatus(userId, bookId, "unread")
      }
      onUnmarkAsRead?.(bookId, title, author)
      toast({
        title: "Book Unmarked",
        description: `"${title}" by ${author} is now unread`,
      })
    } catch (error) {
      console.error("Error updating book status to unread:", error)
      toast({
        title: "Error",
        description: "Failed to update book status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating((prev) => {
        const newSet = new Set(prev)
        newSet.delete(bookId)
        return newSet
      })
    }
  }

  const handleMarkAsWant = async (bookId: string, title: string, author: string) => {
    if (isUpdating.has(bookId)) return

    setIsUpdating((prev) => new Set([...prev, bookId]))

    try {
      if (userId) {
        await updateBookStatus(userId, bookId, "want")
      }
      onMarkAsWant(bookId, title, author)
      toast({
        title: "Added to Want to Read!",
        description: `"${title}" by ${author}`,
      })
    } catch (error) {
      console.error("Error updating book status to want:", error)
      toast({
        title: "Error",
        description: "Failed to update book status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating((prev) => {
        const newSet = new Set(prev)
        newSet.delete(bookId)
        return newSet
      })
    }
  }

  const handleToggleDontWant = async (bookId: string, title: string, author: string) => {
    if (isUpdating.has(bookId)) return

    setIsUpdating((prev) => new Set([...prev, bookId]))

    try {
      if (userId) {
        const newStatus = dontWantBooks.has(bookId) ? "unread" : "dont-want"
        await updateBookStatus(userId, bookId, newStatus)
      }
      onToggleDontWant(bookId, title, author)
      
      // Show toast notification
      const isCurrentlyPassed = dontWantBooks.has(bookId)
      toast({
        title: isCurrentlyPassed ? "Book Removed from Pass List!" : "Book Marked as Pass!",
        description: `"${title}" by ${author}`,
      })
    } catch (error) {
      console.error("Error updating book status:", error)
      toast({
        title: "Error",
        description: "Failed to update book status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating((prev) => {
        const newSet = new Set(prev)
        newSet.delete(bookId)
        return newSet
      })
    }
  }

  const getReadingStatus = (bookId: string) => {
    if (readBooks.has(bookId)) return "read"
    if (wantToReadBooks.has(bookId)) return "want"
    if (dontWantBooks.has(bookId)) return "pass"
    return "unread"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "read":
        return "bg-green-100 text-green-800 border-green-200"
      case "want":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pass":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "read":
        return "Read"
      case "want":
        return "Want"
      case "pass":
        return "Pass"
      default:
        return "Unread"
    }
  }

  const openPlatformLink = (book: Book, platform: Platform) => {
    let url = platform.url

    // Construct platform-specific URLs for direct book access
    switch (platform.name.toLowerCase()) {
      case "kindle":
        // Amazon Kindle - search by title and author for best match
        const amazonQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://www.amazon.com/s?k=${encodeURIComponent(amazonQuery)}&i=digital-text&ref=nb_sb_noss`
        break

      case "audible":
        // Audible - search by title and author
        const audibleQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://www.audible.com/search?keywords=${encodeURIComponent(audibleQuery)}&ref=a_search_c1_lProduct_1_1&pf_rd_p=073d8370-97e5-4b7b-be04-aa6cf4b9e3a4&pf_rd_r=&pageLoadId=&creativeId=`
        break

      case "books":
      case "print":
        // Google Books or general book search
        const bookQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(bookQuery + " book")}`
        break

      case "apple books":
      case "ibooks":
        // Apple Books
        const appleQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://books.apple.com/search?term=${encodeURIComponent(appleQuery)}`
        break

      case "kobo":
        // Kobo
        const koboQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://www.kobo.com/search?query=${encodeURIComponent(koboQuery)}`
        break

      case "barnes & noble":
      case "nook":
        // Barnes & Noble
        const bnQuery = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = `https://www.barnesandnoble.com/s/${encodeURIComponent(bnQuery)}`
        break

      case "library":
      case "local library":
      case "overdrive":
      case "libby":
        // Smart library URL handling - detect common platforms and construct proper search URLs
        if (platform.url && platform.url !== "") {
          const title = book.title.replace(/[^\w\s]/g, " ").trim()
          const author = getAuthorName(book).replace(/[^\w\s]/g, " ").trim()
          
          // Create multiple search strategies for better results
          const searchStrategies = [
            `"${title}" "${author}"`,  // Exact phrase search
            `${title} ${author}`,      // Combined search
            title,                     // Title only
            author,                    // Author only
            `${author} ${title}`       // Author first
          ]
          
          const encodedTitle = encodeURIComponent(title)
          const encodedAuthor = encodeURIComponent(author)
          const encodedQuery = encodeURIComponent(searchStrategies[0]) // Use best strategy first
          
          // Check if URL contains template variables (user knows how to use them)
          if (platform.url.includes("{") && platform.url.includes("}")) {
            url = platform.url
              .replace("{title}", encodedTitle)
              .replace("{author}", encodedAuthor)
              .replace("{query}", encodedQuery)
          } else {
            // Smart detection for common library platforms
            const urlLower = platform.url.toLowerCase()
            
            if (urlLower.includes("libbyapp.com") || urlLower.includes("libby") || urlLower.includes("overdrive.com")) {
              // Libby/OverDrive - convert Libby URL to OverDrive base URL if needed
              let overdriveBase = platform.url
              
              // If it's a Libby URL, extract library code and convert to OverDrive format
              // Example: https://libbyapp.com/library/mcplmd -> https://mcplmd.overdrive.com
              if (urlLower.includes("libbyapp.com/library/")) {
                const libraryMatch = platform.url.match(/library\/([^\/\?]+)/i)
                if (libraryMatch && libraryMatch[1]) {
                  const libraryCode = libraryMatch[1]
                  overdriveBase = `https://${libraryCode}.overdrive.com`
                } else {
                  // Fallback if library code not found
                  overdriveBase = "https://www.overdrive.com"
                }
              } else if (urlLower.includes("overdrive.com") && !urlLower.includes("www.overdrive.com")) {
                // Already an OverDrive base URL (e.g., https://mclpmd.overdrive.com)
                // Clean up the URL to ensure it's just the base
                overdriveBase = platform.url.replace(/\/$/, "").split("?")[0].split("#")[0]
              } else if (urlLower.includes("www.overdrive.com")) {
                // Generic OverDrive, try to extract library code from Libby URL if available
                // For now, use generic OverDrive
                overdriveBase = "https://www.overdrive.com"
              }
              
              // Construct OverDrive search URL: {overdriveBase}/search/title?query={bookTitle}
              // OverDrive uses /search/title?query= format for title searches
              url = `${overdriveBase}/search/title?query=${encodedTitle}`
            } else if (urlLower.includes("hoopladigital.com") || urlLower.includes("hoopla")) {
              // Hoopla - use title search first
              url = `https://www.hoopladigital.com/search?q=${encodedTitle}`
            } else if (urlLower.includes("worldcat.org")) {
              // WorldCat - use advanced search format
              url = `https://www.worldcat.org/search?q=ti%3A${encodedTitle}+au%3A${encodedAuthor}&qt=results_page`
            } else if (urlLower.includes("catalog") || urlLower.includes("library")) {
              // Generic library catalog - try multiple search parameters
              const separator = platform.url.includes("?") ? "&" : "?"
              url = `${platform.url}${separator}search=${encodedTitle}&author=${encodedAuthor}`
            } else {
              // Generic library - try to append search parameters
              const separator = platform.url.includes("?") ? "&" : "?"
              url = `${platform.url}${separator}q=${encodedQuery}`
            }
          }
        } else {
          // Default to WorldCat with advanced search if no custom URL provided
          // This ensures library platforms always search for the selected book
          const title = book.title.replace(/[^\w\s]/g, " ").trim()
          const author = getAuthorName(book).replace(/[^\w\s]/g, " ").trim()
          const encodedTitle = encodeURIComponent(title)
          const encodedAuthor = encodeURIComponent(author)
          url = `https://www.worldcat.org/search?q=ti%3A${encodedTitle}+au%3A${encodedAuthor}&qt=results_page`
        }
        break

      default:
        // For custom platforms, use the existing template replacement
        const query = `${book.title} ${getAuthorName(book)}`.replace(/[^\w\s]/g, " ").trim()
        url = platform.url
          .replace("{title}", encodeURIComponent(book.title))
          .replace("{author}", encodeURIComponent(getAuthorName(book)))
          .replace("{query}", encodeURIComponent(query))
          .replace("{isbn}", encodeURIComponent(book.isbn || ""))
    }

    window.open(url, "_blank")
  }


  const getAuthorName = (book: Book): string => {
    if (typeof (book as any).author === "string" && (book as any).author) {
      return (book as any).author as any
    }
    if ((book as any).author && typeof (book as any).author === "object" && "name" in ((book as any).author as any)) {
      return (((book as any).author as any).name as string) || "Unknown Author"
    }
    if (Array.isArray((book as any).authors) && (book as any).authors.length > 0) {
      return ((book as any).authors[0] as string) || "Unknown Author"
    }
    return "Unknown Author"
  }

  const getLastName = (authorName: string): string => {
    if (!authorName || typeof authorName !== "string") return ""
    const nameParts = authorName.trim().split(/\s+/)
    return nameParts[nameParts.length - 1].toLowerCase()
  }

  const toggleDescription = (bookId: string) => {
    const newExpanded = new Set(expandedDescriptions)
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId)
    } else {
      newExpanded.add(bookId)
    }
    setExpandedDescriptions(newExpanded)
  }

  const isUpcomingRelease = (publishedDate: string) => {
    if (!publishedDate) return false
    
    try {
    const now = new Date()
    const twelveMonthsFromNow = new Date()
    twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12)
      
      // Handle different date formats
      let bookDate: Date
      const dateStr = publishedDate.trim()
      
      if (dateStr.match(/^\d{4}$/)) {
        // Year only (e.g., "2026")
        bookDate = new Date(`${dateStr}-01-01`)
      } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
        // Year-month (e.g., "2026-07")
        bookDate = new Date(`${dateStr}-01`)
      } else {
        // Full date (e.g., "2026-07-13")
        bookDate = new Date(dateStr)
      }
      
      // Check if date is valid
      if (isNaN(bookDate.getTime())) {
        return false
      }
      
      // Check if it's in the future and within 12 months
    return bookDate >= now && bookDate <= twelveMonthsFromNow
    } catch (error) {
      console.error("Error parsing date:", publishedDate, error)
      return false
    }
  }

  // Show the publication year; full dates from the data sources are often a
  // placeholder Jan 1 and add little for the reader
  const formatPublishedDate = (publishedDate: string) => {
    const match = publishedDate.trim().match(/^(\d{4})/)
    return match ? match[1] : publishedDate
  }

  const formatUpcomingDate = (publishedDate: string) => {
    if (!publishedDate) return ""
    const date = new Date(publishedDate)
    const now = new Date()

    if (date > now) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }
    return publishedDate
  }

  const sortedBooks = [...books].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.publishedDate || "1900").getTime() - new Date(a.publishedDate || "1900").getTime()
      case "oldest":
        return new Date(a.publishedDate || "2100").getTime() - new Date(b.publishedDate || "2100").getTime()
      case "title":
        return a.title.localeCompare(b.title)
      case "author":
        const lastNameA = getLastName(getAuthorName(a))
        const lastNameB = getLastName(getAuthorName(b))
        const nameComparison = lastNameA.localeCompare(lastNameB)

        // If authors have the same last name, sort by publication date (newest first)
        if (nameComparison === 0) {
          return new Date(b.publishedDate || "1900").getTime() - new Date(a.publishedDate || "1900").getTime()
        }

        return nameComparison
      case "pages":
        return (b.pageCount || 0) - (a.pageCount || 0)
      default:
        return 0
    }
  })

  // New look (Step 4): one card per book with the cover beside the details and
  // big choices along the bottom, so cards in a row line up. Uses the same
  // handlers as the older card.
  const RATING_LABELS = { loved: "Loved it", liked: "Liked it", "didnt-like": "Not for me" } as const
  const RATING_ICONS = { loved: Heart, liked: ThumbsUp, "didnt-like": ThumbsDown } as const
  const RATING_CHOICES = (["loved", "liked", "didnt-like"] as const).map((id) => ({ id, label: RATING_LABELS[id], Icon: RATING_ICONS[id] }))
  // Covers for books with no picture; none of them match the header colour
  const PLAIN_COVER_COLOURS = ["#00845A", "#0072BB", "#7A3E9D", "#C8102E", "#2A7F86", "#1F3A5F", "#B5862A", "#4E7D2F"]
  const plainCoverColour = (title: string) => {
    let h = 0
    for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return PLAIN_COVER_COLOURS[h % PLAIN_COVER_COLOURS.length]
  }

  const renderNewLookCard = (book: Book, index: number) => {
    const bookId = `${book.title}-${book.author}`
    const status = getReadingStatus(bookId)
    const isExpanded = expandedDescriptions.has(book.id)
    const isFuture = isUpcomingRelease(book.publishedDate || "")
    const justOut = !isFuture && isJustOut(book.publishedDate)
    const isBookUpdating = isUpdating.has(bookId)
    const bookAuthor = getAuthorName(book)
    const rating = bookRatings.get(bookId)
    const note = bookNotes.get(bookId)
    const date = readDates.get(bookId)
    const stop = (e: React.MouseEvent) => e.stopPropagation()
    const editDetails = (e: React.MouseEvent) => {
      e.stopPropagation()
      onEditNote?.(bookId, book.title, book.author)
    }
    const facts = [
      book.publishedDate && !isFuture && !justOut ? formatPublishedDate(book.publishedDate) : null,
      book.pageCount && book.pageCount > 0 ? `${book.pageCount} pages` : null,
      book.language && book.language !== "en" ? book.language.toUpperCase() : null,
    ].filter(Boolean)
    const coverColour = plainCoverColour(book.title)

    const wantButton = (
      <button
        type="button"
        aria-pressed={status === "want"}
        onClick={(e) => {
          e.stopPropagation()
          handleMarkAsWant(bookId, book.title, bookAuthor)
        }}
        disabled={isBookUpdating}
        className="nl-choice"
        title={status === "want" ? "Remove from want to read" : "Add to want to read"}
      >
        {status === "want" ? "On my list" : "Want to read"}
      </button>
    )
    const passButton = (
      <button
        type="button"
        aria-pressed={status === "pass"}
        onClick={(e) => {
          e.stopPropagation()
          handleToggleDontWant(bookId, book.title, bookAuthor)
        }}
        disabled={isBookUpdating}
        className="nl-choice"
        title={status === "pass" ? "Remove from not for me" : "Mark as not for me"}
      >
        Not for me
      </button>
    )

    return (
      <article
        key={`${book.id}-${index}`}
        data-book-id={book.id}
        className={`nl-card flex h-full flex-col gap-4 p-4 md:p-[1.125rem] ${isFuture ? "nl-card-future" : justOut ? "nl-card-new" : ""}`}
        onClick={() => onBookClick?.(book.id)}
        style={{ cursor: onBookClick ? "pointer" : "default" }}
      >
        <div className="flex gap-4 md:gap-[1.125rem]">
          {showCovers && (
            <div className="flex-shrink-0">
              {book.thumbnail ? (
                <img
                  src={book.thumbnail}
                  alt=""
                  className="nl-cover h-[8.625rem] w-[5.75rem]"
                  loading={index < 6 ? "eager" : "lazy"}
                  fetchPriority={index < 6 ? "high" : undefined}
                  onError={(e) => {
                    const img = e.currentTarget
                    const fallbacks = (book as any).coverFallbacks
                    if (fallbacks?.isbn && img.src !== fallbacks.isbn) {
                      img.src = fallbacks.isbn
                      return
                    }
                    if (fallbacks?.olid && img.src !== fallbacks.olid) {
                      img.src = fallbacks.olid
                      return
                    }
                    img.style.display = "none"
                    img.nextElementSibling?.classList.remove("hidden")
                  }}
                />
              ) : null}
              <div
                className={`nl-cover nl-cover-plain h-[8.625rem] w-[5.75rem] ${book.thumbnail ? "hidden" : ""}`}
                aria-hidden="true"
              >
                <i style={{ background: coverColour }} />
                <span>{book.title}</span>
                <i style={{ background: coverColour }} />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="nl-heading line-clamp-2 text-[1.375rem] leading-tight">{book.title}</h3>
            {onAuthorClick ? (
              <button
                type="button"
                className="nl-author"
                onClick={(e) => {
                  e.stopPropagation()
                  onAuthorClick(bookAuthor)
                }}
                title={`Show only books by ${bookAuthor}`}
              >
                {bookAuthor}
              </button>
            ) : (
              <p className="nl-author">{bookAuthor}</p>
            )}
            {(isFuture || justOut || facts.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {isFuture && book.publishedDate && (
                  <span className="nl-tag nl-tag-future">Future · {formatBookDate(book.publishedDate)}</span>
                )}
                {justOut && book.publishedDate && (
                  <span className="nl-tag nl-tag-new">Just out · {formatBookDate(book.publishedDate)}</span>
                )}
                {facts.length > 0 && <span className="text-base nl-soft">{facts.join(" · ")}</span>}
              </div>
            )}
            {status === "read" && note && (
              <button
                type="button"
                onClick={editDetails}
                className="nl-note mt-1 text-left text-base"
                aria-label={`Your note on ${book.title}: ${note}. Tap to edit.`}
              >
                <span className="line-clamp-1">“{note}”</span>
              </button>
            )}
            {book.description ? (
              <div className="mt-1">
                <p className={`text-[1.0625rem] leading-normal ${isExpanded ? "" : "line-clamp-2"}`}>{book.description}</p>
                {book.description.length > 120 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDescription(book.id)
                    }}
                    className="nl-link min-h-[2.75rem] text-base"
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          {status === "read" ? (
            canEditDetails ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={editDetails} className="nl-status">
                  <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
                  {date ? `Read ${formatReadDate(date).replace("Before", "before")}` : "Read"}
                </button>
                {rating && (
                  <button type="button" onClick={editDetails} className={`nl-status ${rating === "loved" ? "nl-status-loved" : ""}`}>
                    {(() => {
                      const Icon = RATING_ICONS[rating as keyof typeof RATING_ICONS]
                      return Icon ? <Icon className="h-[1.125rem] w-[1.125rem] fill-current" aria-hidden="true" /> : null
                    })()}
                    {RATING_LABELS[rating as keyof typeof RATING_LABELS]}
                  </button>
                )}
                {/* The box it opens also has "Not read after all" */}
                <button type="button" onClick={editDetails} className="nl-link min-h-[2.75rem] px-1 text-[1.0625rem]">
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div role="group" aria-label={`How was ${book.title}?`} className="flex gap-2">
                  {RATING_CHOICES.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={rating === id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetBookRating?.(bookId, rating === id ? null : id)
                      }}
                      className={`nl-choice nl-choice-stack nl-rating ${id === "loved" ? "nl-rating-loved" : ""}`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${rating === id ? "fill-current" : ""}`} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {onUnmarkAsRead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnmarkAsRead(bookId, book.title, bookAuthor)
                    }}
                    disabled={isBookUpdating}
                    className="flex min-h-[2.75rem] items-center gap-1.5 text-base font-semibold nl-soft hover:underline"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Not read after all
                  </button>
                )}
              </div>
            )
          ) : isFuture ? (
            // Not out yet, so it can't have been read
            <div role="group" aria-label={`Your choice for ${book.title}`} className="flex gap-2.5">
              {wantButton}
              {passButton}
            </div>
          ) : (
            <div role="group" aria-label={`Your choice for ${book.title}`} className="flex gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkAsRead(bookId, book.title, bookAuthor)
                }}
                disabled={isBookUpdating}
                className="nl-choice nl-choice-main"
              >
                I&apos;ve read it
              </button>
              {wantButton}
              {passButton}
            </div>
          )}

          {platforms.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" onClick={stop}>
              <span className="text-base font-semibold nl-soft">Find it:</span>
              {platforms.slice(0, 4).map((platform, i) => (
                <button
                  key={`${platform.name}-${platform.category || "default"}-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openPlatformLink(book, platform)
                  }}
                  className="min-h-[2.75rem] rounded-xl border-2 px-3 text-base font-semibold"
                  style={{ borderColor: "var(--nl-line)" }}
                >
                  {platform.name === "Books" ? "Print" : platform.name === "OverDrive/Libby" ? "Library" : platform.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-28 h-28 mx-auto mb-6 opacity-30">
          <BookOpen className={`w-full h-full ${newLook ? "" : emptyStateIconClass}`} />
        </div>
        <h3 className={`text-2xl md:text-3xl font-semibold mb-3 ${newLook ? "nl-heading" : emptyStateTitleClass}`}>Start Your Personal Library</h3>
        <p className={`text-lg md:text-xl max-w-md mx-auto ${newLook ? "nl-soft" : emptyStateDescClass}`}>Add your favorite authors to discover and organize your books.</p>
      </div>
    )
  }

  // Helper function to render sortable header
  const renderSortableHeader = (label: string, sortKey: string) => {
    const isActive = sortBy === sortKey
    const handleClick = () => {
      if (onSortChange) {
        // Toggle between ascending and descending if already sorted by this column
        if (isActive && sortBy === sortKey) {
          // For now, just set the sort key (can enhance later to toggle direction)
          onSortChange(sortKey)
        } else {
          onSortChange(sortKey)
        }
      }
    }

    return (
      <th 
        className={`text-left p-2 text-xs font-bold uppercase text-gray-700 ${
          onSortChange ? "cursor-pointer hover:bg-gray-200 select-none" : ""
        } transition-colors`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {onSortChange && (
            <span className="text-gray-400">
              {isActive ? (
                sortKey === "newest" || sortKey === "pages" ? (
                  <ArrowDown className="w-3 h-3" />
                ) : (
                  <ArrowUp className="w-3 h-3" />
                )
              ) : (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </th>
    )
  }

  // For list view, render as a table
  if (viewMode === "list") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="text-left p-2 text-xs font-bold uppercase text-gray-700 w-16">Cover</th>
              {renderSortableHeader("Title", "title")}
              {renderSortableHeader("Author", "author")}
              {renderSortableHeader("Published", "newest")}
              {renderSortableHeader("Pages", "pages")}
              <th className="text-left p-2 text-xs font-bold uppercase text-gray-700 w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedBooks.map((book, index) => {
              const bookId = `${book.title}-${book.author}`
              const status = getReadingStatus(bookId)
              const isUpcoming = isUpcomingRelease(book.publishedDate || "")
              const bookAuthor = getAuthorName(book)
              const isRecommendedAuthor = recommendedAuthors.has(bookAuthor)

              return (
                <tr
                  key={`${book.id}-${index}`}
                  data-book-id={book.id}
                  onClick={() => onBookClick?.(book.id)}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                    isUpcoming ? "bg-yellow-50" : isRecommendedAuthor ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="p-2">
                    {showCovers ? (
                      <div className="relative w-10 h-15">
                        {book.thumbnail ? (
                          <img
                            src={book.thumbnail}
                            alt={book.title}
                            className="w-10 h-15 object-cover rounded shadow-sm bg-gray-100"
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget
                              const fallbacks = (book as any).coverFallbacks
                              if (fallbacks?.isbn && img.src !== fallbacks.isbn) {
                                img.src = fallbacks.isbn
                                return
                              }
                              if (fallbacks?.olid && img.src !== fallbacks.olid) {
                                img.src = fallbacks.olid
                                return
                              }
                              img.style.display = "none"
                              img.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-15 bg-gray-200 rounded flex items-center justify-center ${book.thumbnail ? "hidden" : ""}`}
                          aria-hidden="true"
                        >
                          <BookOpen className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-15 bg-gray-200 rounded flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="p-2 max-w-[200px]">
                    <div className="font-bold text-sm text-black truncate" title={book.title}>
                      {book.title}
                    </div>
                  </td>
                  <td className="p-2 max-w-[150px]">
                    <div className="text-red-600 font-semibold text-sm truncate" title={bookAuthor}>
                      {bookAuthor}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="text-xs text-gray-600 whitespace-nowrap">{book.publishedDate ? formatPublishedDate(book.publishedDate) : "-"}</div>
                  </td>
                  <td className="p-2">
                    <div className="text-xs text-gray-600 whitespace-nowrap">{book.pageCount && book.pageCount > 0 ? `${book.pageCount}` : "-"}</div>
                  </td>
                  <td className="p-2">
                    <Badge className={`${getStatusColor(status)} border-2 border-black font-bold uppercase text-xs`}>
                      {getStatusText(status)}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <div className={newLook ? "grid gap-4 grid-cols-1 lg:grid-cols-2" : "grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}>
        {sortedBooks.map((book, index) => {
          if (newLook) return renderNewLookCard(book, index)
          const bookId = `${book.title}-${book.author}`
          const status = getReadingStatus(bookId)
          const isExpanded = expandedDescriptions.has(book.id)
          const isUpcoming = isUpcomingRelease(book.publishedDate || "")
          const isBookUpdating = isUpdating.has(bookId)
          const bookAuthor = getAuthorName(book)
          const isRecommendedAuthor = recommendedAuthors.has(bookAuthor)

          return (
            /* Grid View - Use Card */
            <Card
              key={`${book.id}-${index}`}
              data-book-id={book.id}
              className={`shadow-lg hover:shadow-xl transition-all duration-300 ${
                isUpcoming
                  ? "shadow-yellow-300 ring-2 ring-yellow-300 bg-gradient-to-br from-white to-yellow-50 text-black"
                  : isRecommendedAuthor
                  ? "shadow-blue-200 ring-2 ring-blue-200 bg-gradient-to-br from-white to-blue-50 text-black"
                  : highContrast ? "bg-white text-black" : "bg-white text-black"
              }`}
              onClick={() => onBookClick?.(book.id)}
              style={{ cursor: onBookClick ? 'pointer' : 'default' }}
            >
              <CardContent className={isMobile ? "p-4" : "p-6"}>
                {isMobile ? (
                  /* Clean Mobile View - iPhone */
                  <div className="space-y-3">
                    {/* Book Cover - placeholder when missing */}
                    {showCovers && (
                      <div className="flex justify-center mt-4">
                        {book.thumbnail ? (
                          <img
                            src={book.thumbnail}
                            alt={book.title}
                            className="w-24 h-36 object-cover rounded-lg shadow-sm border-2 border-black bg-gray-100"
                            loading={index < 6 ? "eager" : "lazy"}
                            fetchPriority={index < 6 ? "high" : undefined}
                            onError={(e) => {
                              const img = e.currentTarget
                              const fallbacks = (book as any).coverFallbacks
                              if (fallbacks?.isbn && img.src !== fallbacks.isbn) {
                                img.src = fallbacks.isbn
                                return
                              }
                              if (fallbacks?.olid && img.src !== fallbacks.olid) {
                                img.src = fallbacks.olid
                                return
                              }
                              img.style.display = "none"
                              img.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-24 h-36 rounded-lg shadow-sm border-2 border-gray-300 bg-gray-200 flex items-center justify-center ${book.thumbnail ? "hidden" : ""}`}
                          aria-hidden="true"
                        >
                          <BookOpen className="w-10 h-10 text-gray-400" />
                        </div>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="font-black text-black text-base leading-tight uppercase">
                      {book.title}
                    </h3>
                    
                    {/* Author */}
                    <p className="text-red-600 font-bold text-sm uppercase">{getAuthorName(book)}</p>

                    {/* Book Info - Compact */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                      {book.publishedDate && (
                        <span className="font-medium">
                          {isUpcoming ? formatUpcomingDate(book.publishedDate) : formatPublishedDate(book.publishedDate)}
                        </span>
                      )}
                      {book.pageCount && book.pageCount > 0 && (
                        <span className="font-medium">• {book.pageCount} pages</span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center">
                      <Badge className={`${getStatusColor(status)} border-2 border-black font-bold uppercase text-xs`}>
                        {getStatusText(status)}
                      </Badge>
                    </div>

                    {/* Reading Status Buttons - Compact */}
                    <div className="flex gap-1 justify-center">
                      {status === "read" ? (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "loved" ? null : "loved"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              bookRatings.get(bookId) === "loved"
                                ? "bg-pink-100 text-pink-600"
                                : "text-gray-400 hover:text-pink-600 hover:bg-pink-50"
                            }`}
                            title="Loved"
                          >
                            <Heart className={`w-4 h-4 ${bookRatings.get(bookId) === "loved" ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "liked" ? null : "liked"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              bookRatings.get(bookId) === "liked"
                                ? "bg-blue-100 text-blue-600"
                                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            }`}
                            title="Liked"
                          >
                            <ThumbsUp className={`w-4 h-4 ${bookRatings.get(bookId) === "liked" ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "didnt-like" ? null : "didnt-like"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              bookRatings.get(bookId) === "didnt-like"
                                ? "bg-red-100 text-red-600"
                                : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title="Didn't like"
                          >
                            <ThumbsDown className={`w-4 h-4 ${bookRatings.get(bookId) === "didnt-like" ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(bookId, book.title, getAuthorName(book))
                            }}
                            disabled={isBookUpdating}
                            className="flex-1 tap-target h-8 text-xs font-bold border-2 border-gray-400 text-gray-800 hover:bg-orange-50 bg-white"
                          >
                            <BookCheck className="w-3 h-3 mr-1" />
                            Read
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onMarkAsWant(bookId, book.title, getAuthorName(book))
                            }}
                            disabled={isBookUpdating}
                            className="flex-1 tap-target h-8 text-xs font-bold border-2 border-blue-400 text-blue-800 hover:bg-blue-50 bg-white"
                          >
                            <BookmarkPlus className="w-3 h-3 mr-1" />
                            Want
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleDontWant(bookId, book.title, getAuthorName(book))
                            }}
                            disabled={isBookUpdating}
                            className={`flex-1 tap-target h-8 text-xs font-bold border-2 bg-white ${
                              status === "pass"
                                ? "border-red-500 text-red-800 hover:bg-red-50"
                                : "border-gray-400 text-gray-800 hover:bg-gray-50"
                            }`}
                          >
                            <BookX className="w-3 h-3 mr-1" />
                            Pass
                          </Button>
                        </div>
                      )}
                    </div>

                    {renderNote(bookId, book)}

                    {/* Description - Expandable */}
                    <div className="space-y-1">
                      {book.description ? (
                        <>
                          <p className={`text-xs text-gray-700 leading-relaxed ${expandedMobileDescriptions.has(book.id) ? "" : "line-clamp-2"}`}>
                            {book.description}
                          </p>
                          {book.description.length > 100 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMobileDescription(book.id)
                              }}
                              className="text-xs text-orange-600 hover:text-orange-700 font-bold"
                            >
                              {expandedMobileDescriptions.has(book.id) ? "Show less" : "Read more"}
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No description available.</p>
                      )}
                    </div>

                    {/* Platform Links - Compact */}
                    {platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center pt-2 border-t border-gray-200">
                        {platforms.slice(0, 4).map((platform, index) => (
                          <Button
                            key={`${platform.name}-${platform.category || 'default'}-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openPlatformLink(book, platform)
                            }}
                            className="border border-gray-300 text-gray-700 hover:bg-orange-50 bg-white text-xs h-6 px-2"
                          >
                            {platform.name === "Kindle" && <BookCheck className="w-3 h-3" />}
                            {platform.name === "Audible" && <Headphones className="w-3 h-3" />}
                            {platform.name === "Books" && <ShoppingCart className="w-3 h-3" />}
                            {!["Kindle", "Audible", "Books"].includes(platform.name) && <Globe className="w-3 h-3" />}
                            <span className="ml-1 hidden sm:inline">
                              {platform.name === "Books" ? "Print" : 
                               platform.name === "OverDrive/Libby" ? "Library" : 
                               platform.name}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Full Desktop View */
                  <div className="space-y-4">
                    {/* Book Cover - placeholder when missing */}
                    {showCovers && (
                      <div className="flex justify-center mt-4 relative">
                        {book.thumbnail ? (
                          <img
                            src={book.thumbnail}
                            alt={book.title}
                            className="w-28 h-42 object-cover rounded-lg shadow-sm border-2 border-black bg-gray-100"
                            loading={index < 6 ? "eager" : "lazy"}
                            fetchPriority={index < 6 ? "high" : undefined}
                            onError={(e) => {
                              const img = e.currentTarget
                              const fallbacks = (book as any).coverFallbacks
                              if (fallbacks?.isbn && img.src !== fallbacks.isbn) {
                                img.src = fallbacks.isbn
                                return
                              }
                              if (fallbacks?.olid && img.src !== fallbacks.olid) {
                                img.src = fallbacks.olid
                                return
                              }
                              img.style.display = "none"
                              img.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-28 h-42 rounded-lg shadow-sm border-2 border-gray-300 bg-gray-200 flex items-center justify-center ${book.thumbnail ? "hidden" : ""}`}
                          aria-hidden="true"
                        >
                          <BookOpen className="w-12 h-12 text-gray-400" />
                        </div>
                      </div>
                    )}

                  {/* Book Info */}
                  <div className="space-y-3">
                    <h3 className="font-black text-black text-lg leading-tight min-h-[3rem] flex items-center uppercase">
                      {book.title}
                    </h3>
                    <p className="text-red-600 font-bold text-base uppercase">{getAuthorName(book)}</p>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {book.publishedDate && (
                        <div
                          className={`flex items-center gap-1 ${
                            isUpcoming
                              ? "text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-300"
                              : "text-black"
                          }`}
                        >
                          <Calendar
                            className={`w-3 h-3 ${
                              isUpcoming ? "text-emerald-600" : "drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]"
                            }`}
                          />
                          <span className="font-bold">
                            {isUpcoming ? formatUpcomingDate(book.publishedDate) : formatPublishedDate(book.publishedDate)}
                          </span>
                          {isUpcoming && (
                            <span className="text-xs text-emerald-600 ml-1 font-black">• COMING SOON</span>
                          )}
                        </div>
                      )}
                      {book.pageCount && book.pageCount > 0 && (
                        <div className="flex items-center gap-1 text-black">
                          <FileText className="w-3 h-3 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                          <span className="font-bold">{book.pageCount} pages</span>
                        </div>
                      )}
                      {book.language && book.language !== "en" && (
                        <div className="flex items-center gap-1 text-black">
                          <Globe className="w-3 h-3 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                          <span className="font-bold">{book.language.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <Badge className={`${getStatusColor(status)} border-2 border-black font-bold uppercase`}>
                      {getStatusText(status)}
                    </Badge>
                  </div>

                  {renderNote(bookId, book)}

                  {/* Description */}
                  <div className="space-y-2">
                    {book.description ? (
                      <>
                        <p className={`text-sm text-gray-700 leading-relaxed ${isExpanded ? "" : "line-clamp-6"}`}>
                          {book.description}
                        </p>
                        {book.description.length > 300 && (
                          <button
                            onClick={() => toggleDescription(book.id)}
                            className="text-xs text-orange-600 hover:text-orange-700 font-bold uppercase"
                          >
                            {isExpanded ? "Show less" : "Read more"}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No description available.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {status === "read" ? (
                      // Show rating buttons and unmark button for read books
                      <div className="space-y-2">
                        <div className="flex gap-6 md:gap-8 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "loved" ? null : "loved"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-2 rounded transition-colors ${
                              bookRatings.get(bookId) === "loved"
                                ? "bg-pink-100 text-pink-600"
                                : "text-gray-400 hover:text-pink-600 hover:bg-pink-50"
                            }`}
                            title="I loved this book"
                          >
                            <Heart className={`w-5 h-5 ${bookRatings.get(bookId) === "loved" ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "liked" ? null : "liked"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-2 rounded transition-colors ${
                              bookRatings.get(bookId) === "liked"
                                ? "bg-blue-100 text-blue-600"
                                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            }`}
                            title="I liked this book"
                          >
                            <ThumbsUp className={`w-5 h-5 ${bookRatings.get(bookId) === "liked" ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRating = bookRatings.get(bookId)
                              const newRating = currentRating === "didnt-like" ? null : "didnt-like"
                              onSetBookRating?.(bookId, newRating as "loved" | "liked" | "didnt-like" | null)
                            }}
                            className={`p-2 rounded transition-colors ${
                              bookRatings.get(bookId) === "didnt-like"
                                ? "bg-gray-100 text-gray-600"
                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                            }`}
                            title="I didn't like this book or gave up on it"
                          >
                            <ThumbsDown className={`w-5 h-5 ${bookRatings.get(bookId) === "didnt-like" ? "fill-current" : ""}`} />
                          </button>
                        </div>
                        {onUnmarkAsRead && (
                          <div className="flex justify-center">
                      <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnmarkAsRead(bookId, book.title, getAuthorName(book))
                              }}
                              disabled={isBookUpdating}
                              className="h-6 px-1.5 text-[10px] font-normal border-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 bg-transparent"
                              title="Unmark as read"
                            >
                              <RotateCcw className="w-3 h-3 mr-0.5" />
                              Unmark
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Show Read/Want/Pass buttons for unread books
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(bookId, book.title, getAuthorName(book))}
                        disabled={isBookUpdating}
                          className="tap-target h-8 px-2 md:px-3 text-xs font-bold border-2 border-gray-400 text-gray-800 hover:bg-orange-50 bg-white flex-shrink-0"
                          title="Mark as read"
                      >
                        <BookCheck className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                        Read
                      </Button>
                      <Button
                        variant={status === "want" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleMarkAsWant(bookId, book.title, getAuthorName(book))}
                        disabled={isBookUpdating}
                        className={`tap-target h-8 px-2 md:px-3 text-xs font-bold border-2 flex-shrink-0 ${
                          status === "want"
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                            : "border-gray-400 text-gray-800 hover:bg-orange-50 bg-white"
                        }`}
                        title={status === "want" ? "Remove from want to read" : "Add to want to read"}
                      >
                        <BookmarkPlus className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                        Want
                      </Button>
                      <Button
                        variant={status === "pass" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleDontWant(bookId, book.title, getAuthorName(book))}
                        disabled={isBookUpdating}
                        className={`tap-target h-8 px-2 md:px-3 text-xs font-bold border-2 flex-shrink-0 ${
                          status === "pass"
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                            : "border-gray-400 text-gray-800 hover:bg-orange-50 bg-white"
                        }`}
                        title={status === "pass" ? "Remove from pass list" : "Mark as pass"}
                      >
                        <BookX className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                        Pass
                      </Button>
                      </div>
                    )}
                    </div>

                    {/* Platform Links */}
                    {platforms.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-red-600 uppercase tracking-wide">Find on:</div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {platforms.slice(0, 4).map((platform, index) => (
                            <Button
                              key={`${platform.name}-${platform.category || 'default'}-${index}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openPlatformLink(book, platform)}
                              className="border-2 border-black text-black hover:bg-orange-50 bg-white text-xs font-bold tap-target h-8 px-3"
                            >
                              {platform.name === "Kindle" && (
                                <BookCheck className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                              )}
                              {platform.name === "Audible" && (
                                <Headphones className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                              )}
                              {platform.name === "Books" && (
                                <ShoppingCart className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                              )}
                              {!["Kindle", "Audible", "Books"].includes(platform.name) && (
                                <Globe className="w-3 h-3 mr-1 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
                              )}
                              {platform.name === "Books" ? "Print" : 
                               platform.name === "OverDrive/Libby" ? "Library" : 
                               platform.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Series Books Button */}
                    {book.seriesInfo && (() => {
                      // Normalize series name for matching (case-insensitive, trim whitespace)
                      const normalizeSeriesName = (name: string) => name.toLowerCase().trim()
                      const currentSeriesName = normalizeSeriesName(book.seriesInfo.name)
                      
                      const seriesBooks = books
                        .filter(b => {
                          if (!b.seriesInfo) return false
                          const bSeriesName = normalizeSeriesName(b.seriesInfo.name)
                          return bSeriesName === currentSeriesName && getAuthorName(b) === bookAuthor
                        })
                        .sort((a, b) => {
                          // Sort by series number first, then by publication date
                          if (a.seriesInfo?.number && b.seriesInfo?.number) {
                            return a.seriesInfo.number - b.seriesInfo.number
                          }
                          const dateA = new Date(a.publishedDate || "1900").getTime()
                          const dateB = new Date(b.publishedDate || "1900").getTime()
                          return dateA - dateB
                        })
                      
                      const hasOtherBooksInSeries = seriesBooks.length > 1
                      
                      return hasOtherBooksInSeries ? (
                      <div className="space-y-2">
                          <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                            {book.seriesInfo.name} Series:
                          </div>
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                                setShowSeriesForBookId(showSeriesForBookId === book.id ? null : book.id)
                            }}
                              className="border-2 border-blue-500 text-blue-700 hover:bg-blue-50 bg-white text-xs font-bold tap-target h-8 px-3"
                          >
                              <List className="w-3 h-3 mr-1" />
                              {showSeriesForBookId === book.id ? "Hide" : "Show"} Series ({seriesBooks.length} books)
                          </Button>
                        </div>
                          
                          {showSeriesForBookId === book.id && (
                            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto border-t border-blue-200 pt-3">
                              {seriesBooks.map((seriesBook) => {
                                const seriesBookId = `${seriesBook.title}-${seriesBook.author}`
                                const seriesStatus = getReadingStatus(seriesBookId)
                                const isCurrentBook = seriesBook.id === book.id
                                
                                return (
                                  <div
                                    key={seriesBook.id}
                                    className={`p-2 rounded border-2 ${
                                      isCurrentBook
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white hover:bg-gray-50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          {seriesBook.seriesInfo?.number && (
                                            <Badge
                                              variant="outline"
                                              className="border-blue-300 text-blue-700 bg-blue-50 text-xs px-1.5 py-0 font-bold"
                                            >
                                              #{seriesBook.seriesInfo.number}
                                            </Badge>
                                          )}
                                          <h4 className={`text-sm font-bold ${isCurrentBook ? "text-blue-900" : "text-gray-900"}`}>
                                            {seriesBook.title}
                                          </h4>
                      </div>
                                        {seriesBook.publishedDate && (
                                          <p className="text-xs text-gray-600">
                                            {seriesBook.publishedDate}
                                          </p>
                                        )}
                                        <Badge
                                          className={`${getStatusColor(seriesStatus)} border border-gray-300 font-bold uppercase text-xs mt-1`}
                                        >
                                          {getStatusText(seriesStatus)}
                                        </Badge>
                  </div>
                </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : null
                    })()}

                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>


    </>
  )
}
