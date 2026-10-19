# How to undo changes

There are three ways to undo, from smallest to biggest. None of them deletes anyone's saved books.

## 1. Turn one feature off

1. On GitHub, open `lib/features.ts` in this repository.
2. Click the pencil icon to edit.
3. Change the feature's `true` to `false`.
4. Click **Commit changes**.

Vercel republishes the app a minute or two later with that feature hidden. Change it back to `true` the same way to bring it back.

## 2. Remove one feature completely

Every feature arrives as its own pull request.

1. On GitHub, open **Pull requests**, then **Closed**, and find the feature's pull request.
2. Click **Revert** near the bottom of the page. GitHub opens a new pull request that removes it.
3. Merge that new pull request.

The other features stay in place.

## 3. Put the whole app back to a stable point

Three saved snapshots:

- `stable-2026-10-19b` holds the app as it was on the evening of October 19, 2026, with the first new look (warm paper, serif titles, three cards per row), just before the orange Penguin look.
- `stable-2026-10-19` holds the app exactly as it was on October 19, 2026, just before the new look (Daytime and Evening). To go back to the old look only, the quickest way is to set `newLook` to `false` in `lib/features.ts` (see 1 above).
- `stable-2026-10-15` holds the app as it was on October 15, 2026, before any of the design features were added.

**Fastest (for an emergency):** in Vercel, open the project **my-bookshelf-v3**, then **Deployments**. Find an earlier deployment that worked, open its **...** menu and choose **Promote to Production** (Vercel may call this **Instant Rollback**). The live site switches back right away. The next merge to `main` publishes again on top of it.

**Permanent:** ask Claude to reset `main` to one of these branches through a pull request, so the code itself goes back.

## Saved books are always kept

New information, such as read dates, is stored next to what is already saved and never replaces it. Turning a feature off or reverting it hides that information; it does not erase it.
