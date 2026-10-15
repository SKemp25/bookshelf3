import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { features } from "./features.ts"
import { TEXT_SIZES } from "./textSize.ts"
import { DEFAULT_USAGE_MODE, TOOL_MIN_MODE, USAGE_MODES, isToolOn, modeIncludesTool, normalizeUsageMode } from "./usageMode.ts"

describe("how MyBookshelf helps", () => {
  it("never names a diagnosis in its choices", () => {
    const text = JSON.stringify(USAGE_MODES).toLowerCase()
    for (const word of ["diagnos", "alzheimer", "dementia", "memory loss"]) {
      assert.equal(text.includes(word), false, `choice text mentions "${word}"`)
    }
  })

  it("gives each choice a real text size, growing with the help offered", () => {
    const percents = Object.values(USAGE_MODES).map((m) => TEXT_SIZES[m.textSize].rootPercent)
    assert.deepEqual([...percents].sort((a, b) => a - b), percents)
  })

  it("layers tools: more help includes everything less help has", () => {
    assert.equal(modeIncludesTool("record", "haveIReadThis"), false)
    assert.equal(modeIncludesTool("remember", "haveIReadThis"), true)
    assert.equal(modeIncludesTool("support", "haveIReadThis"), true)
    assert.equal(modeIncludesTool("remember", "readAloud"), false)
    assert.equal(modeIncludesTool("support", "readAloud"), true)
  })

  it("only shows a tool once its own switch is on", () => {
    for (const tool of Object.keys(TOOL_MIN_MODE) as (keyof typeof TOOL_MIN_MODE)[]) {
      if (!features[tool]) assert.equal(isToolOn(tool, "support"), false)
    }
  })

  it("ignores unknown saved values and starts on the middle choice", () => {
    assert.equal(normalizeUsageMode("alzheimers"), null)
    assert.equal(normalizeUsageMode("record"), "record")
    assert.equal(DEFAULT_USAGE_MODE, "remember")
  })
})
