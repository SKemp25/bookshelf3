/**
 * When a book was read. A month is enough; "a while ago" keeps only that it
 * was before a given year.
 */

export type ReadDate =
  | { year: number; month: number } // month is 1-12
  | { before: number } // read some time before this year

export type ReadDateChoice = "justFinished" | "earlierThisYear" | "aWhileAgo" | "pickMonth"

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

export const READ_DATE_CHOICES: { id: ReadDateChoice; label: string; hint: (now: Date) => string }[] = [
  { id: "justFinished", label: "Just finished", hint: (now) => `${MONTHS[now.getMonth()]} ${now.getFullYear()}` },
  { id: "earlierThisYear", label: "Earlier this year", hint: (now) => `Pick a month in ${now.getFullYear()}` },
  { id: "aWhileAgo", label: "A while ago", hint: (now) => `Before ${now.getFullYear()}` },
  { id: "pickMonth", label: "Pick a month and year", hint: () => "Any month, any year" },
]

/** Turns a choice (plus a month and year where needed) into a stored date. */
export function readDateFrom(choice: ReadDateChoice, now: Date, month?: number, year?: number): ReadDate | null {
  switch (choice) {
    case "justFinished":
      return { year: now.getFullYear(), month: now.getMonth() + 1 }
    case "earlierThisYear":
      return month ? { year: now.getFullYear(), month } : null
    case "aWhileAgo":
      return { before: now.getFullYear() }
    case "pickMonth":
      return month && year ? { year, month } : null
  }
}

/** Which choice an existing date belongs to, so the box opens on it. */
export function choiceFor(date: ReadDate, now: Date): ReadDateChoice {
  if ("before" in date) return "aWhileAgo"
  if (date.year === now.getFullYear() && date.month === now.getMonth() + 1) return "justFinished"
  if (date.year === now.getFullYear()) return "earlierThisYear"
  return "pickMonth"
}

/** "October 2026" or "Before 2026". */
export function formatReadDate(date: ReadDate): string {
  if ("before" in date) return `Before ${date.before}`
  return `${MONTHS[date.month - 1]} ${date.year}`
}

/** Accepts only well-formed saved values. */
export function normalizeReadDate(value: unknown): ReadDate | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (Number.isInteger(v.before)) return { before: v.before as number }
  if (Number.isInteger(v.year) && Number.isInteger(v.month) && (v.month as number) >= 1 && (v.month as number) <= 12) {
    return { year: v.year as number, month: v.month as number }
  }
  return null
}
