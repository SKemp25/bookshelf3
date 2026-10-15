/**
 * ON/OFF SWITCHES FOR NEW FEATURES
 *
 * Each new feature has one line below. To turn a feature off, change
 * `true` to `false` and save. To turn it back on, change it to `true`.
 * Vercel republishes the app on its own a minute or two after the change
 * reaches the main branch.
 *
 * Turning a feature off only hides it. Anything people saved while it was
 * on (for example read dates) is kept, and comes back when it is turned on.
 *
 * A feature that has not been built yet stays `false` until its change is
 * merged. See HOW_TO_UNDO.md for the other ways to undo changes.
 */
export const features = {
  // Step 1: calm foundations and read dates
  largerButtonsAndText: true,
  readDates: false,
  undoOnCards: false,

  // How would you like MyBookshelf to help? (lib/usageMode.ts)
  usageMode: true,

  // Step 2: everyday memory help
  haveIReadThis: false,
  notePrompt: false,
  nextInSeries: false,
  recentlyViewed: false,
  addToHomeScreen: false,

  // Most support
  simplerScreens: false,
  readAloud: false,
  stickyConfirmations: false,

  // Step 3: the keepsake
  yearInBooks: false,

  // Step 4: the new look
  newLook: false,
  ipadSideBySide: false,
}

export type FeatureName = keyof typeof features

export function isFeatureOn(name: FeatureName): boolean {
  return features[name] === true
}
