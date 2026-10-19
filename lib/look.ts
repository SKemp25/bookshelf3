/**
 * The new look: a Daytime or Evening look plus one Penguin colour.
 *
 * Daytime is a light grey page with white cards; Evening is deep night blue
 * and warm text. The colour (Penguin orange, green or blue) fills the header
 * band and is used for selected buttons, links and author names. Each colour
 * has a deeper shade for text on light backgrounds and a lighter one for
 * Evening, and all of them pass WCAG AA (see look.test.ts).
 *
 * Both choices are remembered in this browser. Only used while the
 * `newLook` feature switch is on.
 */

export const LOOKS = {
  daytime: {
    label: "Daytime",
    hint: "Light grey page and white cards",
    colors: {
      bg: "#F4F4F2", // page
      bar: "#FFFFFF", // tab bar
      card: "#FFFFFF",
      raised: "#EEEEEA", // quiet buttons, hover
      ink: "#1A1A1A",
      soft: "#55554F", // secondary text
      line: "#D6D6D0",
      lineSoft: "#E4E4E0",
      loved: "#9E1035",
      lovedBg: "#FFE1E6",
      shadow: "rgba(0, 0, 0, 0.06)",
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

/**
 * The Penguin colours. `band` is the header in Daytime (white text on it is
 * large and bold), `daytime` is the shade for text and buttons on light
 * backgrounds, `evening` the shade for text on the dark look.
 */
export const ACCENTS = {
  orange: {
    label: "Orange",
    band: "#F26722",
    eveningBand: "#B54D19",
    daytime: "#C2410C",
    daytimeSoft: "#FFEFE5",
    evening: "#F2A365",
    eveningSoft: "#3D2A1E",
  },
  green: {
    label: "Green",
    band: "#00845A",
    eveningBand: "#006343",
    daytime: "#00704C",
    daytimeSoft: "#DDF3EA",
    evening: "#93C1AA",
    eveningSoft: "#1F3328",
  },
  blue: {
    label: "Blue",
    band: "#0072BB",
    eveningBand: "#00558C",
    daytime: "#005A94",
    daytimeSoft: "#DDEEF9",
    evening: "#9DB6F0",
    eveningSoft: "#222D45",
  },
} as const

export type Look = keyof typeof LOOKS
export type Accent = keyof typeof ACCENTS

export const DEFAULT_LOOK: Look = "daytime"
export const DEFAULT_ACCENT: Accent = "orange"
export const LOOK_STORAGE_KEY = "bookshelf_look"
export const ACCENT_STORAGE_KEY = "bookshelf_accent"
/** The old colour theme setting; its colour becomes the starting accent. */
export const OLD_THEME_STORAGE_KEY = "bookshelf_color_theme"

/** Old colour themes that have a matching colour. Others start on orange. */
const ACCENT_FROM_OLD_THEME: Record<string, Accent> = { blue: "blue", green: "green", orange: "orange" }

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
    "--nl-band": look === "daytime" ? a.band : a.eveningBand,
    "--nl-on-band": "#FFFFFF",
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
  meta?.setAttribute("content", look === "daytime" ? ACCENTS[accent].band : ACCENTS[accent].eveningBand)
  window.dispatchEvent(new CustomEvent(LOOK_CHANGED_EVENT, { detail: { look, accent } }))
  try {
    localStorage.setItem(LOOK_STORAGE_KEY, look)
    localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  } catch {
    // Private browsing can block storage; the look still applies for this visit.
  }
}
