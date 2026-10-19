import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_LOOK,
  LOOKS,
  hexToHslTriplet,
  lookBootScript,
  lookVariables,
  normalizeAccent,
  normalizeLook,
  type Accent,
  type Look,
} from "./look.ts"

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const looks = Object.keys(LOOKS) as Look[]
const accents = Object.keys(ACCENTS) as Accent[]

describe("new look colours", () => {
  it("starts on Daytime with Penguin orange", () => {
    assert.equal(DEFAULT_LOOK, "daytime")
    assert.equal(DEFAULT_ACCENT, "orange")
  })

  it("keeps text readable on every background (WCAG AA, 4.5:1)", () => {
    for (const look of looks) {
      const c = LOOKS[look].colors
      for (const bg of [c.bg, c.bar, c.card, c.raised]) {
        assert.ok(contrast(c.ink, bg) >= 4.5, `${look} ink on ${bg}`)
        assert.ok(contrast(c.soft, bg) >= 4.5, `${look} soft text on ${bg}`)
      }
      assert.ok(contrast(c.loved, c.lovedBg) >= 4.5, `${look} Loved it label`)
    }
  })

  it("keeps every accent readable in both looks", () => {
    for (const look of looks) {
      for (const accent of accents) {
        const v = lookVariables(look, accent)
        // Button labels on the accent, and the accent as text or links on cards and the page
        assert.ok(contrast(v["--nl-on-accent"], v["--nl-accent"]) >= 4.5, `${look}/${accent} button label`)
        assert.ok(contrast(v["--nl-accent"], v["--nl-card"]) >= 4.5, `${look}/${accent} on card`)
        assert.ok(contrast(v["--nl-accent"], v["--nl-bg"]) >= 4.5, `${look}/${accent} on page`)
        assert.ok(contrast(v["--nl-accent"], v["--nl-accent-soft"]) >= 4.5, `${look}/${accent} selected choice`)
        // The header name is large bold text (3:1); the header buttons sit on a darker patch
        assert.ok(contrast(v["--nl-on-band"], v["--nl-band"]) >= 3, `${look}/${accent} header`)
      }
    }
  })

  it("falls back to the defaults for missing or unknown values", () => {
    assert.equal(normalizeLook(null), "daytime")
    assert.equal(normalizeLook("dusk"), "daytime")
    assert.equal(normalizeLook("evening"), "evening")
    assert.equal(normalizeAccent(null), "orange")
    assert.equal(normalizeAccent("pink"), "orange")
    assert.equal(normalizeAccent("green"), "green")
    // Teal and gold were colours in the first version of the new look
    assert.equal(normalizeAccent("teal"), "orange")
  })

  it("starts from the old colour theme when no accent was chosen yet", () => {
    assert.equal(normalizeAccent(null, "blue"), "blue")
    assert.equal(normalizeAccent(null, "green"), "green")
    assert.equal(normalizeAccent(null, "purple"), "orange")
    assert.equal(normalizeAccent(null, "orange"), "orange")
    assert.equal(normalizeAccent("green", "blue"), "green")
  })

  it("converts colours for the shared component styles", () => {
    assert.equal(hexToHslTriplet("#FFFFFF"), "0 0% 100%")
    assert.equal(hexToHslTriplet("#000000"), "0 0% 0%")
    assert.equal(hexToHslTriplet("#FF0000"), "0 100% 50%")
  })

  it("boot script applies the saved look and accent, with defaults and migration", () => {
    const run = (saved: Record<string, string>) => {
      const props: Record<string, string> = {}
      const root = { dataset: {} as Record<string, string>, style: { setProperty: (k: string, v: string) => (props[k] = v) } }
      const fn = new Function("localStorage", "document", lookBootScript())
      fn({ getItem: (k: string) => saved[k] ?? null }, { documentElement: root })
      return { ...root.dataset, props }
    }
    const evening = run({ bookshelf_look: "evening", bookshelf_accent: "green" })
    assert.equal(evening.look, "evening")
    assert.equal(evening.accent, "green")
    assert.equal(evening.props["--nl-accent"], ACCENTS.green.evening)
    assert.equal(evening.props["--nl-band"], ACCENTS.green.eveningBand)
    assert.equal(evening.props["--nl-bg"], LOOKS.evening.colors.bg)

    const fresh = run({})
    assert.equal(fresh.look, "daytime")
    assert.equal(fresh.accent, "orange")
    assert.equal(fresh.props["--nl-band"], ACCENTS.orange.band)

    assert.equal(run({ bookshelf_color_theme: "blue" }).accent, "blue")
    assert.equal(run({ bookshelf_look: "bogus", bookshelf_accent: "bogus" }).accent, "orange")
    assert.equal(run({ bookshelf_accent: "teal", bookshelf_color_theme: "blue" }).accent, "blue")
  })
})
