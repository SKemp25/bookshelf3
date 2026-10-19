/**
 * The new look (Step 4): a Daytime or Evening look plus one accent colour.
 *
 * Daytime is warm paper and dark ink; Evening is deep night blue and warm
 * text. The accent colour (selected buttons, Save, links) carries over when
 * the look changes, with a deeper shade for Daytime and a lighter one for
 * Evening so it stays readable on both. Every accent passes WCAG AA for
 * text and buttons in both looks (see look.test.ts).
 *
 * Both choices are remembered in this browser. Only used while the
 * `newLook` feature switch is on.
 */

export const LOOKS = {
  daytime: {
    label: "Daytime",
    hint: "Warm paper and dark ink",
    colors: {
      bg: "#F5F0E6", // page
      bar: "#ECE4D4", // header and tab bar
      card: "#FFFDF8",
      raised: "#F2ECE0", // quiet buttons, hover
      ink: "#23201B",
      soft: "#5F584C", // secondary text
      line: "#DDD3BF",
      lineSoft: "#ECE4D4",
      loved: "#8A3415",
      lovedBg: "#F7E1D3",
      shadow: "rgba(60, 40, 10, 0.08)",
    },
  },
  evening: {
    label: "Evening",
    hint: "Easier on the eyes in low light",
    colors: {
      bg: "#12161D",
      bar: "#171C24",
      card: "#1B212B",
      raised: "#232B37",
      ink: "#EFE9DD",
      soft: "#A8A193",
      line: "#2F3846",
      lineSoft: "#262E3A",
      loved: "#FFD9D0",
      lovedBg: "#3D2420",
      shadow: "rgba(0, 0, 0, 0.35)",
    },
  },
} as const

export const ACCENTS = {
  teal: { label: "Teal", daytime: "#1E5B58", daytimeSoft: "#E6F0ED", evening: "#86C9BD", eveningSoft: "#1E3431" },
  gold: { label: "Gold", daytime: "#7A5A12", daytimeSoft: "#F6EEDC", evening: "#E0B064", eveningSoft: "#3A3020" },
  orange: { label: "Orange", daytime: "#A3440F", daytimeSoft: "#F8E6DA", evening: "#F2A365", eveningSoft: "#3D2A1E" },
  blue: { label: "Blue", daytime: "#2B4C8C", daytimeSoft: "#E5EBF6", evening: "#9DB6F0", eveningSoft: "#222D45" },
  green: { label: "Green", daytime: "#1F5A3A", daytimeSoft: "#E3EFE7", evening: "#93C1AA", eveningSoft: "#1F3328" },
} as const

export type Look = keyof typeof LOOKS
export type Accent = keyof typeof ACCENTS

export const DEFAULT_LOOK: Look = "daytime"
export const DEFAULT_ACCENT: Accent = "teal"
export const LOOK_STORAGE_KEY = "bookshelf_look"
export const ACCENT_STORAGE_KEY = "bookshelf_accent"
/** The old colour theme setting; its colour becomes the starting accent. */
export const OLD_THEME_STORAGE_KEY = "bookshelf_color_theme"

/**
 * Old colour themes that have a matching accent. Others start on the default.
 * Orange is left out: it was the old default, saved for everyone who never chose.
 */
const ACCENT_FROM_OLD_THEME: Record<string, Accent> = { blue: "blue", green: "green", teal: "teal" }

export function normalizeLook(value: unknown): Look {
  return typeof value === "string" && value in LOOKS ? (value as Look) : DEFAULT_LOOK
}

export function normalizeAccent(value: unknown, oldTheme?: unknown): Accent {
  if (typeof value === "string" && value in ACCENTS) return value as Accent
  if (typeof oldTheme === "string" && oldTheme in ACCENT_FROM_OLD_THEME) return ACCENT_FROM_OLD_THEME[oldTheme]
  return DEFAULT_ACCENT
}

/** "#1E5B58" -> "177 51% 24%", the form the shadcn/ui colour variables use. */
export function hexToHslTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Every CSS variable the new look sets on <html>, for one look and accent. */
export function lookVariables(look: Look, accent: Accent): Record<string, string> {
  const c = LOOKS[look].colors
  const a = ACCENTS[accent]
  const accentHex = a[look]
  const onAccent = look === "daytime" ? "#FFFFFF" : "#14181F"
  return {
    "--nl-bg": c.bg,
    "--nl-bar": c.bar,
    "--nl-card": c.card,
    "--nl-raised": c.raised,
    "--nl-ink": c.ink,
    "--nl-soft": c.soft,
    "--nl-line": c.line,
    "--nl-line-soft": c.lineSoft,
    "--nl-loved": c.loved,
    "--nl-loved-bg": c.lovedBg,
    "--nl-shadow": c.shadow,
    "--nl-accent": accentHex,
    "--nl-accent-soft": look === "daytime" ? a.daytimeSoft : a.eveningSoft,
    "--nl-on-accent": onAccent,
    // Older components follow the accent through this variable
    "--theme-accent": accentHex,
    // shadcn/ui colours, so dialogs, menus and inputs follow the look
    "--background": hexToHslTriplet(c.bg),
    "--foreground": hexToHslTriplet(c.ink),
    "--card": hexToHslTriplet(c.card),
    "--card-foreground": hexToHslTriplet(c.ink),
    "--popover": hexToHslTriplet(c.card),
    "--popover-foreground": hexToHslTriplet(c.ink),
    "--primary": hexToHslTriplet(accentHex),
    "--primary-foreground": hexToHslTriplet(onAccent),
    "--secondary": hexToHslTriplet(c.raised),
    "--secondary-foreground": hexToHslTriplet(c.ink),
    "--muted": hexToHslTriplet(c.raised),
    "--muted-foreground": hexToHslTriplet(c.soft),
    "--accent": hexToHslTriplet(c.raised),
    "--accent-foreground": hexToHslTriplet(c.ink),
    "--border": hexToHslTriplet(c.line),
    "--input": hexToHslTriplet(c.line),
    "--ring": hexToHslTriplet(accentHex),
  }
}

/** Every combination, so the boot script can set them before the page draws. */
function allVariables(): Record<string, Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, Record<string, string>>> = {}
  for (const look of Object.keys(LOOKS) as Look[]) {
    out[look] = {}
    for (const accent of Object.keys(ACCENTS) as Accent[]) out[look][accent] = lookVariables(look, accent)
  }
  return out
}

/**
 * Script run before the page draws, so the saved look appears without a
 * flash of the wrong colours. Kept in sync with applyLook below.
 */
export function lookBootScript(): string {
  return `(function(){try{var v=${JSON.stringify(allVariables())};var o=${JSON.stringify(ACCENT_FROM_OLD_THEME)};var g=function(k){try{return localStorage.getItem(k)}catch(e){return null}};var l=g(${JSON.stringify(
    LOOK_STORAGE_KEY,
  )});if(!v[l])l=${JSON.stringify(DEFAULT_LOOK)};var a=g(${JSON.stringify(ACCENT_STORAGE_KEY)});if(!v[l][a])a=o[g(${JSON.stringify(
    OLD_THEME_STORAGE_KEY,
  )})]||${JSON.stringify(DEFAULT_ACCENT)};var r=document.documentElement;r.dataset.look=l;r.dataset.accent=a;var s=v[l][a];for(var k in s)r.style.setProperty(k,s[k])}catch(e){}})()`
}

export const LOOK_CHANGED_EVENT = "bookshelf:look-changed"

export function applyLook(look: Look, accent: Accent): void {
  const root = document.documentElement
  root.dataset.look = look
  root.dataset.accent = accent
  for (const [name, value] of Object.entries(lookVariables(look, accent))) root.style.setProperty(name, value)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute("content", LOOKS[look].colors.bar)
  window.dispatchEvent(new CustomEvent(LOOK_CHANGED_EVENT, { detail: { look, accent } }))
  try {
    localStorage.setItem(LOOK_STORAGE_KEY, look)
    localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  } catch {
    // Private browsing can block storage; the look still applies for this visit.
  }
}
