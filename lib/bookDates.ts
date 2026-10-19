/**
 * Publication dates for the new look's Future and Just out cards.
 *
 * The data sources give "2027", "2027-03" or "2027-03-04". A bare year, or a
 * date of 1 January, is often a placeholder, so neither counts as an exact
 * publication day.
 */

export type BookDate = { date: Date; precision: "year" | "month" | "day" }

/** How long a newly published book keeps its green "Just out" outline. */
export const JUST_OUT_DAYS = 30

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function parseBookDate(value: string | undefined | null): BookDate | null {
  const m = (value || "").trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (!m) return null
  const year = Number(m[1])
  const month = m[2] ? Number(m[2]) - 1 : 0
  const day = m[3] ? Number(m[3]) : 1
  const date = new Date(year, month, day)
  if (isNaN(date.getTime()) || month > 11) return null
  return { date, precision: m[3] ? "day" : m[2] ? "month" : "year" }
}

/** Published in the last JUST_OUT_DAYS days, going by a real month or day. */
export function isJustOut(value: string | undefined | null, now = new Date()): boolean {
  const parsed = parseBookDate(value)
  if (!parsed || parsed.precision === "year") return false
  const { date } = parsed
  if (parsed.precision === "day" && date.getMonth() === 0 && date.getDate() === 1) return false
  const age = now.getTime() - date.getTime()
  return age >= 0 && age <= JUST_OUT_DAYS * 24 * 60 * 60 * 1000
}

/** "4 Mar 2027", "Mar 2027" or "2027", as exact as the data allows. */
export function formatBookDate(value: string | undefined | null): string {
  const parsed = parseBookDate(value)
  if (!parsed) return value || ""
  const { date, precision } = parsed
  const month = SHORT_MONTHS[date.getMonth()]
  if (precision === "day") return `${date.getDate()} ${month} ${date.getFullYear()}`
  if (precision === "month") return `${month} ${date.getFullYear()}`
  return String(date.getFullYear())
}
