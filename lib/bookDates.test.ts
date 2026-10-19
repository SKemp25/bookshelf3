import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatBookDate, isJustOut, parseBookDate } from "./bookDates.ts"

describe("publication dates", () => {
  const now = new Date(2026, 9, 19) // 19 October 2026

  it("reads years, months and days", () => {
    assert.equal(parseBookDate("2027")?.precision, "year")
    assert.equal(parseBookDate("2027-03")?.precision, "month")
    assert.equal(parseBookDate("2027-03-04")?.precision, "day")
    assert.equal(parseBookDate(""), null)
    assert.equal(parseBookDate("soon"), null)
  })

  it("writes the date as exactly as the data allows", () => {
    assert.equal(formatBookDate("2027-03-04"), "4 Mar 2027")
    assert.equal(formatBookDate("2027-03"), "Mar 2027")
    assert.equal(formatBookDate("2027"), "2027")
  })

  it("marks books published in the last month as just out", () => {
    assert.equal(isJustOut("2026-10-02", now), true)
    assert.equal(isJustOut("2026-10", now), true)
    assert.equal(isJustOut("2026-09-25", now), true)
    assert.equal(isJustOut("2026-08-01", now), false)
    // Not out yet
    assert.equal(isJustOut("2026-11-02", now), false)
  })

  it("ignores placeholder dates", () => {
    assert.equal(isJustOut("2026", now), false)
    assert.equal(isJustOut("2026-01-01", new Date(2026, 0, 10)), false)
  })
})
