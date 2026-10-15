/**
 * "How would you like MyBookshelf to help?"
 *
 * Each choice is described by what the app does, never by a diagnosis, and
 * turns on a layer of memory tools. Text size is a separate setting. Each tool still has its
 * own switch in lib/features.ts, so a tool only appears once it is built and
 * switched on there AND the person's choice includes it.
 */
import { features, type FeatureName } from "./features.ts"

export const USAGE_MODES = {
  record: {
    title: "Keep a clear record of my reading",
    includes: null,
    items: ["Your shelf, authors and wish list", "Read dates, to the day or month", "Your Year in Books"],
  },
  remember: {
    title: "Help me remember what I've read",
    includes: "Everything in a clear record, plus:",
    items: [
      "\"Have I read this?\" at the top of Home",
      "A prompt to add a note when you finish a book",
      "Where you left off, and what's next in a series",
    ],
  },
  support: {
    title: "Give me the most support",
    includes: "Everything above, plus:",
    items: [
      "Simpler screens with fewer choices",
      "Descriptions read aloud",
      "Confirmations that stay on screen until you close them",
    ],
  },
} as const satisfies Record<string, { title: string; includes: string | null; items: readonly string[] }>

export type UsageMode = keyof typeof USAGE_MODES

const MODE_ORDER: UsageMode[] = ["record", "remember", "support"]

/** Used until someone chooses. */
export const DEFAULT_USAGE_MODE: UsageMode = "remember"
export const USAGE_MODE_STORAGE_KEY = "bookshelf_usage_mode"
export const USAGE_PROMPT_DISMISSED_KEY = "bookshelf_usage_prompt_dismissed"

/** The least help a choice must include for each memory tool to appear. */
export const TOOL_MIN_MODE = {
  haveIReadThis: "remember",
  notePrompt: "remember",
  recentlyViewed: "remember",
  nextInSeries: "remember",
  simplerScreens: "support",
  readAloud: "support",
  stickyConfirmations: "support",
} as const satisfies Partial<Record<FeatureName, UsageMode>>

export type MemoryTool = keyof typeof TOOL_MIN_MODE

export function normalizeUsageMode(value: unknown): UsageMode | null {
  return typeof value === "string" && value in USAGE_MODES ? (value as UsageMode) : null
}

export function modeIncludesTool(mode: UsageMode, tool: MemoryTool): boolean {
  return MODE_ORDER.indexOf(mode) >= MODE_ORDER.indexOf(TOOL_MIN_MODE[tool])
}

/** True when a memory tool is built and switched on, and the person's choice includes it. */
export function isToolOn(tool: MemoryTool, mode: UsageMode | null): boolean {
  return features[tool] === true && modeIncludesTool(mode ?? DEFAULT_USAGE_MODE, tool)
}
