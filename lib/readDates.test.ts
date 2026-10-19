import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { READ_DATE_CHOICES, choiceFor, formatReadDate, normalizeReadDate, readDateFrom } from "./readDates.ts"

const now = new Date(2026, 9, 19) // 19 October 2026

describe("read dates", () => {
  it("saves a month, not a day", () => {
    assert.deepEqual(readDateFrom("justFinished", now), { year: 2026, month: 10 })
    assert.deepEqual(readDateFrom("earlierThisYear", now, 3), { year: 2026, month: 3 })
    assert.deepEqual(readDateFrom("pickMonth", now, 7, 2019), { year: 2019, month: 7 })
  })

  it("keeps only 'before this year' for a while ago", () => {
    assert.deepEqual(readDateFrom("aWhileAgo", now), { before: 2026 })
  })

  it("waits for a month (and year) before saving a picked date", () => {
    assert.equal(readDateFrom("earlierThisYear", now), null)
    assert.equal(readDateFrom("pickMonth", now, 7), null)
  })

  it("reads plainly", () => {
    assert.equal(formatReadDate({ year: 2026, month: 10 }), "October 2026")
    assert.equal(formatReadDate({ before: 2026 }), "Before 2026")
    assert.equal(READ_DATE_CHOICES[0].hint(now), "October 2026")
  })

  it("reopens on the choice that made the date", () => {
    assert.equal(choiceFor({ year: 2026, month: 10 }, now), "justFinished")
    assert.equal(choiceFor({ year: 2026, month: 2 }, now), "earlierThisYear")
    assert.equal(choiceFor({ year: 2020, month: 2 }, now), "pickMonth")
    assert.equal(choiceFor({ before: 2026 }, now), "aWhileAgo")
  })

  it("ignores damaged saved values", () => {
    assert.equal(normalizeReadDate({ year: 2026, month: 13 }), null)
    assert.equal(normalizeReadDate("2026"), null)
    assert.deepEqual(normalizeReadDate({ year: 2026, month: 1 }), { year: 2026, month: 1 })
  })
})
