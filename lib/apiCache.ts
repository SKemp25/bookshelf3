// Simple in-memory cache for API responses
class APICache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  // Clear cache for a specific author
  clearAuthor(authorName: string): void {
    const key = getAuthorBooksCacheKey(authorName)
    this.cache.delete(key)
  }

  // Clear expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Global cache instance
export const apiCache = new APICache()

// Export clearAuthor function for use in components
export function clearAuthorCache(authorName: string): void {
  apiCache.clearAuthor(authorName)
}

// Cache key generators
export const getAuthorBooksCacheKey = (authorName: string): string => 
  `author-books:${authorName.toLowerCase().trim()}`

export const getRecommendationsCacheKey = (authors: string[], genres: string[], languages: string[]): string => 
  `recommendations:${authors.sort().join(',')}:${genres.sort().join(',')}:${languages.sort().join(',')}`

export const getBookSearchCacheKey = (query: string): string => 
  `book-search:${query.toLowerCase().trim()}`

// Cached API functions
// Retry function with exponential backoff
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url)
      
      // IMPORTANT: Do not retry 429 (rate limit). Retrying only wastes time and makes it worse.
      // Let the caller handle fallback immediately.
      if (response.status === 429) {
        return response
      }
      
      // If successful or non-retryable error, return immediately
      if (response.ok || response.status !== 503) {
        return response
      }
      
      // For 503, retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        // On final attempt, return the error response
        return response
      }
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        // On final attempt, throw silently or return error response
        throw error
      }
    }
  }
  
  throw new Error('Max retries exceeded')
}

// Fetch work details from Open Library to get full description
export async function fetchWorkDescription(workKey: string): Promise<string> {
  if (!workKey) return ""
  
  try {
    // Extract OLID from work key (e.g., "/works/OL123456W" -> "OL123456W")
    const olid = workKey.replace('/works/', '')
    if (!olid) return ""
    
    const response = await fetchWithRetry(
      `https://openlibrary.org${workKey}.json`,
      2,
      500
    )
    
    if (!response.ok) return ""
    
    const workData = await response.json()
    
    // Open Library description can be a string or an object with a "value" property
    if (typeof workData.description === 'string') {
      return workData.description
    } else if (workData.description?.value) {
      return workData.description.value
    }
    
    return ""
  } catch (error) {
    // Silently fail - description is optional
    return ""
  }
}

export async function fetchAuthorBooksWithCache(authorName: string, clearCache: boolean = false): Promise<any[]> {
  const cacheKey = getAuthorBooksCacheKey(authorName)
  
  // Check cache first (unless explicitly clearing)
  if (!clearCache) {
    const cached = apiCache.get(cacheKey)
    if (cached) {
      console.log(`Cache hit for author: ${authorName}`)
      return cached
    }
  } else {
    console.log(`Cache cleared for author: ${authorName}`)
    apiCache.delete(cacheKey)
  }

  console.log(`Cache miss for author: ${authorName}, fetching via /api/search (server-side fallback enabled)`)

  const AUTHOR_SEARCH_TIMEOUT_MS = 15_000

  try {
    const url = `/api/search?author=${encodeURIComponent(authorName)}&maxResults=40&lang=en`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AUTHOR_SEARCH_TIMEOUT_MS)
    const response = await fetch(url, { cache: "no-store", signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      apiCache.set(cacheKey, [], 2 * 60 * 1000)
      return []
    }
    const books = (await response.json()) || []
    // Cache the result for 10 minutes (or briefly if empty)
    apiCache.set(cacheKey, Array.isArray(books) ? books : [], (Array.isArray(books) && books.length > 0) ? 10 * 60 * 1000 : 2 * 60 * 1000)
    return Array.isArray(books) ? books : []
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      console.warn(`Author search timed out after ${AUTHOR_SEARCH_TIMEOUT_MS / 1000}s: ${authorName}`)
    } else {
      console.error("Error fetching author books via /api/search:", error)
    }
    apiCache.set(cacheKey, [], 2 * 60 * 1000)
    return []
  }
}

export async function fetchRecommendationsWithCache(
  authors: string[], 
  genres: string[], 
  languages: string[]
): Promise<any[]> {
  const cacheKey = getRecommendationsCacheKey(authors, genres, languages)
  
  // Check cache first
  const cached = apiCache.get(cacheKey)
  if (cached) {
    console.log('Cache hit for recommendations')
    return cached
  }

  console.log('Cache miss for recommendations, fetching from API')
  
  try {
    const searchQueries: string[] = []
    
    // Generate search queries based on authors and genres
    for (const authorName of authors.slice(0, 3)) { // Limit to first 3 authors
      for (const genre of genres.slice(0, 2)) { // Limit to first 2 genres
        const genreQuery = genre.toLowerCase().replace(/\s+/g, '+')
        searchQueries.push(`author:"${authorName}" subject:"${genreQuery}"`)
      }
    }

    let allRecommendations: any[] = []

    for (const query of searchQueries.slice(0, 5)) { // Limit to 5 queries
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&orderBy=relevance&printType=books&langRestrict=${languages[0] || "en"}`,
      )

      if (!response.ok) continue

      const data = await response.json()
      if (data.items) {
        allRecommendations = [...allRecommendations, ...data.items]
      }
    }

    // Cache the result for 15 minutes (longer for recommendations)
    apiCache.set(cacheKey, allRecommendations, 15 * 60 * 1000)
    
    return allRecommendations
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    throw error
  }
}

export async function searchBooksWithCache(query: string): Promise<any[]> {
  const cacheKey = getBookSearchCacheKey(query)
  
  // Check cache first
  const cached = apiCache.get(cacheKey)
  if (cached) {
    console.log(`Cache hit for search: ${query}`)
    return cached
  }

  console.log(`Cache miss for search: ${query}, fetching from API`)
  
  try {
    const url = `/api/search?q=${encodeURIComponent(query)}&maxResults=10&lang=en`
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`)
    }
    const books = (await response.json()) || []
    apiCache.set(cacheKey, Array.isArray(books) ? books : [], 5 * 60 * 1000)
    return Array.isArray(books) ? books : []
  } catch (error) {
    console.error("Error searching books via /api/search:", error)
    throw error
  }
}

// Cleanup expired cache entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup()
  }, 10 * 60 * 1000)
}
