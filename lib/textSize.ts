/**
 * Text and button size setting.
 *
 * The whole app is measured in "rem" units (Tailwind), so changing the
 * page's base font size makes text, buttons and spacing grow together.
 * The choice is remembered in this browser.
 */
export const TEXT_SIZES = {
  standard: { label: "Standard", rootPercent: 100 },
  large: { label: "Large", rootPercent: 118.75 },
  largest: { label: "Largest", rootPercent: 137.5 },
} as const

export type TextSize = keyof typeof TEXT_SIZES

export const DEFAULT_TEXT_SIZE: TextSize = "large"
export const TEXT_SIZE_STORAGE_KEY = "bookshelf_text_size"

export function normalizeTextSize(value: unknown): TextSize {
  return typeof value === "string" && value in TEXT_SIZES ? (value as TextSize) : DEFAULT_TEXT_SIZE
}

/**
 * Script run before the page draws, so the saved size is applied without
 * a flash of small text. Kept in sync with applyTextSize below.
 */
export function textSizeBootScript(): string {
  const percents = Object.fromEntries(Object.entries(TEXT_SIZES).map(([key, size]) => [key, size.rootPercent]))
  return `(function(){try{var p=${JSON.stringify(percents)};var s=localStorage.getItem(${JSON.stringify(
    TEXT_SIZE_STORAGE_KEY,
  )});if(!p[s])s=${JSON.stringify(DEFAULT_TEXT_SIZE)};var r=document.documentElement;r.dataset.textSize=s;r.style.fontSize=p[s]+"%"}catch(e){}})()`
}

export function applyTextSize(size: TextSize): void {
  const root = document.documentElement
  root.dataset.textSize = size
  root.style.fontSize = `${TEXT_SIZES[size].rootPercent}%`
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size)
  } catch {
    // Private browsing can block storage; the size still applies for this visit.
  }
}
