import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  filterLibraryBooks,
  isAllowedLibraryBook,
  isArchivalRecord,
  isLikelyDifferentAuthor,
  isEnglishLanguage,
  isRerelease,
  isSpecialEdition,
  isSummarizedOrStudyGuide,
  normalizeLanguageCode,
} from "./libraryFilters.ts"

describe("language filtering", () => {
  it("treats English variants as English", () => {
    assert.equal(normalizeLanguageCode("eng"), "en")
    assert.equal(normalizeLanguageCode("en-US"), "en")
    assert.equal(normalizeLanguageCode("en_GB"), "en")
    assert.equal(isEnglishLanguage("en"), true)
    assert.equal(isEnglishLanguage("eng"), true)
    assert.equal(isEnglishLanguage("en-GB"), true)
    assert.equal(isEnglishLanguage(""), true)
    assert.equal(isEnglishLanguage(["ita", "eng"]), true)
  })

  it("rejects non-English languages", () => {
    assert.equal(isEnglishLanguage("fr"), false)
    assert.equal(isEnglishLanguage("spa"), false)
    assert.equal(isEnglishLanguage(["jpn"]), false)
    assert.equal(isAllowedLibraryBook({ title: "L'Étranger", language: "fr" }), false)
  })
})

describe("summarized and study-guide editions", () => {
  it("rejects summaries and notes editions from the title or subtitle", () => {
    assert.equal(isSummarizedOrStudyGuide({ title: "Circe: A Summary" }), true)
    assert.equal(isSummarizedOrStudyGuide({ title: "The Odyssey", subtitle: "SparkNotes Study Guide" }), true)
    assert.equal(isSummarizedOrStudyGuide({ title: "Pride and Prejudice", subtitle: "Cliffs Notes" }), true)
    assert.equal(isSummarizedOrStudyGuide({ title: "Pride and Prejudice", subtitle: "Notes" }), true)
    assert.equal(isSummarizedOrStudyGuide({ title: "Pride and prejudice", subtitle: "notes" }), true)
    assert.equal(
      isSummarizedOrStudyGuide({
        title: "The Great Gatsby",
        description: "This book is a summary of the original novel and is not the original work.",
      }),
      true,
    )
  })

  it("keeps original novels whose blurbs mention source material", () => {
    assert.equal(
      isSummarizedOrStudyGuide({
        title: "Circe",
        description: "A retelling based on the Odyssey, following the witch of Aiaia.",
      }),
      false,
    )
    assert.equal(isAllowedLibraryBook({ title: "The Shelter", language: "en" }), true)
    assert.equal(isAllowedLibraryBook({ title: "Circe Free Preview", language: "en" }), false)
  })
})

describe("original editions vs reissues", () => {
  it("rejects special reissues advertised in the subtitle", () => {
    assert.equal(isRerelease({ title: "The Hunger Games", subtitle: "Movie Tie-In Edition" }), true)
    assert.equal(isRerelease({ title: "Dune", subtitle: "50th Anniversary Edition" }), true)
    assert.equal(isRerelease({ title: "1984", subtitle: "Deluxe Illustrated Edition" }), true)
    assert.equal(isAllowedLibraryBook({ title: "Normal People", subtitle: "TV Tie-In Edition", language: "en" }), false)
  })

  it("does not treat myth retellings as media reissues", () => {
    assert.equal(
      isRerelease({
        title: "The Song of Achilles",
        description: "A dazzling retelling of the Iliad, based on the friendship of Achilles and Patroclus.",
      }),
      false,
    )
  })

  it("rejects graded readers and abridged versions", () => {
    assert.equal(isSpecialEdition({ title: "Jane Eyre", subtitle: "Penguin Readers Level 5" }), true)
    assert.equal(isSpecialEdition({ title: "Oliver Twist", subtitle: "Abridged Edition" }), true)
    assert.equal(isAllowedLibraryBook({ title: "Great Expectations", subtitle: "Oxford Bookworms", language: "en" }), false)
  })
})

describe("filterLibraryBooks", () => {
  it("rejects omnibus collections of multiple original books", () => {
    assert.equal(
      isAllowedLibraryBook({
        title: "The Hunger Games / Catching Fire / Mockingjay",
        language: "en",
      }),
      false,
    )
    assert.equal(
      isAllowedLibraryBook({
        title: "The Hunger Games Trilogy (Hunger Games / Catching Fire / Mockingjay)",
        language: "eng",
      }),
      false,
    )
  })

  it("keeps English original editions only", () => {
    const kept = filterLibraryBooks([
      { title: "Klara and the Sun", language: "en" },
      { title: "Klara and the Sun", subtitle: "Movie Tie-In Edition", language: "en" },
      { title: "Klara and the Sun", subtitle: "A Summary", language: "en" },
      { title: "Klara y el Sol", language: "es" },
      { title: "Klara and the Sun", language: "eng" },
    ])
    assert.deepEqual(
      kept.map((book) => `${book.title}|${book.language}`),
      ["Klara and the Sun|en", "Klara and the Sun|eng"],
    )
  })
})

describe("namesakes and archival records", () => {
  it("drops a namesake with a middle initial", () => {
    const book = {
      title: "The Book of Dan",
      author: "Daniel Mason",
      authors: ["Daniel Mason"],
      description: "The first autobiography of Daniel W. Mason",
      publishedDate: "2021-01-01",
    }
    assert.equal(isLikelyDifferentAuthor(book), true)
    assert.equal(isAllowedLibraryBook(book), false)
  })

  it("keeps the author's own books", () => {
    const own = {
      title: "A Registry of My Passage Upon the Earth",
      author: "Daniel Mason",
      description: "A Pulitzer Prize Finalist: This collection of moving short stories by Daniel Mason",
      publishedDate: "2020-01-01",
      isbn: "9781984880000",
    }
    const noName = { title: "North Woods", author: "Daniel Mason", description: "A novel about a house in the woods" }
    const ownMiddle = { title: "X", author: "George R. R. Martin", description: "By George R. R. Martin" }
    assert.equal(isAllowedLibraryBook(own), true)
    assert.equal(isLikelyDifferentAuthor(noName), false)
    assert.equal(isLikelyDifferentAuthor(ownMiddle), false)
  })

  it("drops archival records", () => {
    const deeds = {
      title: "Daniel Mason Deeds",
      author: "Daniel Mason",
      description: "Deeds for land bought and sold in Massachusetts and New Hampshire by Daniel Mason.",
      publishedDate: "1759-01-01",
    }
    assert.equal(isArchivalRecord(deeds), true)
    assert.equal(isAllowedLibraryBook(deeds), false)
    assert.equal(isArchivalRecord({ title: "Pride and Prejudice", author: "Jane Austen", publishedDate: "1813" }), false)
  })
})
