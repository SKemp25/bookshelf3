import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_TEXT_SIZE, TEXT_SIZES, normalizeTextSize, textSizeBootScript } from "./textSize.ts"

describe("text size setting", () => {
  it("starts on the bigger setting", () => {
    assert.equal(DEFAULT_TEXT_SIZE, "large")
    assert.ok(TEXT_SIZES[DEFAULT_TEXT_SIZE].rootPercent > TEXT_SIZES.standard.rootPercent)
  })

  it("falls back to the default for missing or unknown values", () => {
    assert.equal(normalizeTextSize(null), "large")
    assert.equal(normalizeTextSize("huge"), "large")
    assert.equal(normalizeTextSize("largest"), "largest")
    assert.equal(normalizeTextSize("standard"), "standard")
  })

  it("orders sizes from smallest to largest", () => {
    const percents = Object.values(TEXT_SIZES).map((s) => s.rootPercent)
    assert.deepEqual([...percents].sort((a, b) => a - b), percents)
  })

  it("boot script applies a saved size and defaults when nothing is saved", () => {
    const run = (saved: string | null) => {
      const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
      const fn = new Function("localStorage", "document", textSizeBootScript())
      fn({ getItem: () => saved }, { documentElement: root })
      return root
    }
    assert.equal(run("largest").style.fontSize, "137.5%")
    assert.equal(run(null).dataset.textSize, "large")
    assert.equal(run("bogus").style.fontSize, "118.75%")
  })
})
