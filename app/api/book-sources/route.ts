import { NextResponse } from "next/server"

// A quick health check of the services the app gets book details from.
// Open /api/book-sources on the live site to see whether each one is answering.
// The Google key itself is never shown.

async function check(url: string): Promise<{ status: number; ok: boolean; message: string; body: any }> {
  try {
    const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    let body: any = null
    try {
      body = await resp.json()
    } catch {
      body = null
    }
    return { status: resp.status, ok: resp.ok, message: String(body?.error?.message || "").slice(0, 300), body }
  } catch (error) {
    return { status: 0, ok: false, message: (error as Error)?.message || "no answer", body: null }
  }
}

export async function GET() {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes")
  googleUrl.searchParams.set("q", "North Woods Daniel Mason")
  googleUrl.searchParams.set("maxResults", "1")
  if (apiKey) googleUrl.searchParams.set("key", apiKey)

  const [google, apple, openLibrary] = await Promise.all([
    check(googleUrl.toString()),
    check("https://itunes.apple.com/search?term=North%20Woods%20Daniel%20Mason&media=ebook&limit=1&country=US"),
    check("https://openlibrary.org/search.json?title=North%20Woods&author=Daniel%20Mason&limit=1&fields=key,title"),
  ])

  return NextResponse.json({
    google: {
      keySet: Boolean(apiKey),
      status: google.status,
      working: google.ok && Array.isArray(google.body?.items),
      hasDescription: Boolean(google.body?.items?.[0]?.volumeInfo?.description),
      message: google.message,
    },
    appleBooks: {
      status: apple.status,
      working: apple.ok && Array.isArray(apple.body?.results),
      hasDescription: Boolean(apple.body?.results?.[0]?.description),
      message: apple.message,
    },
    openLibrary: {
      status: openLibrary.status,
      working: openLibrary.ok && Array.isArray(openLibrary.body?.docs),
      message: openLibrary.message,
    },
  })
}
