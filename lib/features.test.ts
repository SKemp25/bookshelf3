import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { features, isFeatureOn, type FeatureName } from "./features.ts"

describe("feature switches", () => {
  it("only accepts true or false for every switch", () => {
    for (const value of Object.values(features)) {
      assert.equal(typeof value, "boolean")
    }
  })

  it("reports each switch as written in the file", () => {
    for (const [name, value] of Object.entries(features)) {
      assert.equal(isFeatureOn(name as FeatureName), value)
    }
  })
})
