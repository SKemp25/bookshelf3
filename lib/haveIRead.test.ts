import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { answerFor, findOnShelf, normalizeForMatch, shelfKey } from "./haveIRead.ts"

const books = [
  { title: "The Glass Hotel", author: "Emily St. John Mandel" },
  { title: "Station Eleven", author: "Emily St. John Mandel" },
  { title: "Sea of Tranquility", author: "Emily St. John Mandel" },
  { title: "Circe", author: "Madeline Miller" },
  { title: "The Song of Achilles", author: "Madeline Miller" },
  { title: "Glass Houses", author: "Louise Penny" },
]
const marks = {
  readBooks: new Set([shelfKey(books[0]), shelfKey(books[3])]),
  wantToReadBooks: new Set([shelfKey(books[1])]),
  dontWantBooks: new Set([shelfKey(books[5])]),
}

describe("Have I read this?", () => {
  it("ignores case, punctuation, accents and a leading article", () => {
    assert.equal(normalizeForMatch("The Glass Hotel!"), "glass hotel")
    assert.equal(normalizeForMatch("Café"), "cafe")
  })

  it("finds a book from part of its title", () => {
    const [first] = findOnShelf("glass hotel", books, marks)
    assert.equal(first.book.title, "The Glass Hotel")
    assert.equal(first.status, "read")
  })

  it("lists every match, read books first among equally close ones", () => {
    const found = findOnShelf("glass", books, marks).map((m) => m.book.title)
    assert.deepEqual(found, ["The Glass Hotel", "Glass Houses"])
  })

  it("puts an exact title ahead of a partial one", () => {
    const found = findOnShelf("glass houses", books, marks).map((m) => m.book.title)
    assert.deepEqual(found, ["Glass Houses"])
  })

  it("matches on title and author words together", () => {
    const found = findOnShelf("miller circe", books, marks)
    assert.equal(found.length, 1)
    assert.equal(found[0].book.title, "Circe")
  })

  it("reports Want to Read and Pass plainly", () => {
    assert.equal(findOnShelf("station eleven", books, marks)[0].status, "want")
    assert.equal(findOnShelf("glass houses", books, marks)[0].status, "passed")
    assert.equal(findOnShelf("sea of", books, marks)[0].status, "none")
  })

  it("returns nothing for a blank search or a book not on the shelf", () => {
    assert.deepEqual(findOnShelf("  ", books, marks), [])
    assert.deepEqual(findOnShelf("middlemarch", books, marks), [])
  })

  it("uses neutral wording with no praise", () => {
    for (const s of ["read", "want", "passed", "none"] as const) {
      assert.match(answerFor(s), /^[A-Z][^!]*\.$/)
    }
  })
})
