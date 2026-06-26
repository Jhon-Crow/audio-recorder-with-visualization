# Issue 181 Case Study: Stale YouTube Playlists After Restart

## Problem

Issue 181 reports that YouTube playlist data remains stale after restarting the app. The affected UI stores playlist summaries in `localStorage` under `audio-recorder-youtube-playlists`, then uses that cache in the upload modal and pipeline playlist chooser.

The first PR change made API refresh replace the cache instead of merging it. Reviewer feedback on PR 183 confirmed stale data could still be seen after restart, so the remaining problem is not only cache replacement semantics; rendered consumers also need to refresh from the authoritative cache after startup.

## Collected Data

- Issue metadata: `logs/issue-181.json`
- PR 183 metadata and discussion: `logs/pr-183.json`
- PR 183 diff: `logs/pr-183.diff`
- Related PR 185 diff: `logs/pr-185.diff`
- CI run list for the branch: `logs/ci-runs.json`
- Latest PR feedback and CI artifacts after the manual refresh report: `logs/pr-183-latest.json`, `logs/pr-183-comments-latest.json`, `logs/ci-runs-latest.json`, `logs/pr-183-latest.diff`
- Reviewer screenshot showing the disabled pipeline Refresh button: `artifacts/pr-comment-4809545108-refresh-button.png`

PR 185 is relevant because it fixes a related YouTube helper readiness problem in the pipeline selector. Its useful pattern is to read `window.AudioRecorderYouTube` at action time, not only at render time.

## External Reference

YouTube Data API `playlists.list` with `mine=true` returns playlists owned by the authenticated channel. For this app, that API response is the authoritative playlist set during refresh. Local cache should be a startup/display cache only, not a source that preserves removed or renamed playlists after a successful refresh.

Reference: https://developers.google.com/youtube/v3/docs/playlists/list

YouTube Data API `playlists.insert` creates playlists through a separate authenticated mutation. Created playlists should still be merged into the local cache immediately because they are new user-visible state returned by YouTube.

Reference: https://developers.google.com/youtube/v3/docs/playlists/insert

The playlist list/create actions require a valid OAuth token with playlist-capable YouTube scopes. The UI must still keep manual controls reachable when helper objects initialize after the pipeline has already rendered, then validate token/scope at click time.

Reference: https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps

## Root Cause

The local playlist cache had two failure modes:

1. Refresh previously merged API results into cached results, preserving stale playlists that no longer came back from YouTube.
2. Startup refresh could update `localStorage` while already-rendered selectors still showed the earlier cached list until a later manual render.

The pipeline selector also captured `window.AudioRecorderYouTube` at render time, so controls could stay tied to a missing or old helper if the YouTube module became available later.

Follow-up PR feedback on 2026-06-26 showed an additional manual-check failure: the pipeline Refresh button was visibly disabled even while cached playlists were rendered. The disabled state was computed from the initial helper snapshot, so a selector rendered before YouTube helpers/token state were ready could not be manually refreshed later. The click handler had already been changed to resolve `window.AudioRecorderYouTube` late, but the disabled gate still prevented the click from ever reaching that safer path.

Later PR feedback on 2026-06-26 reported that clicking Refresh produced no network request and no console errors. That makes the next likely failure point an unobserved click-path prerequisite, such as a missing `window.AudioRecorderYouTube` helper, missing `refreshPlaylists`, missing token/scope state, or a click handler not firing. The pipeline refresh action now logs a compact console diagnostic for click, blocked, success, and failure states so manual verification can identify which prerequisite prevents the YouTube request.

## Solution

- Treat successful playlist refresh as replacement with the latest YouTube API response.
- Keep playlist creation additive because a newly created playlist is an immediate local mutation.
- Re-render the upload playlist selector after refresh resolves so visible UI cannot keep stale startup markup.
- Apply the PR 185 late-helper pattern to pipeline playlist refresh/create actions.
- Keep the pipeline manual Refresh button enabled whenever the stage itself is editable, and perform YouTube helper/token/scope validation inside the click handler.
- Log pipeline YouTube playlist refresh diagnostics to the console so manual checks show whether the click handler fired and which prerequisite blocked or completed refresh.
- Add Cypress regressions for upload and pipeline startup refresh replacing stale cached playlists.
- Add a Cypress regression for manual pipeline refresh after YouTube helpers become available post-render.

## Alternatives Considered

- Clearing the playlist cache on every restart: avoids stale data but creates a worse signed-in startup experience when the network is unavailable.
- Disabling cached playlists entirely: removes useful offline/context display and makes saved selected playlist IDs harder to present.
- Adding cache timestamps only: useful later, but insufficient because the app already has an authenticated API refresh that should replace stale data when it succeeds.

## Verification Strategy

- Unit tests cover playlist API normalization and upload behavior.
- Cypress upload regression seeds stale `localStorage`, returns a different API playlist, then verifies the modal only shows the refreshed playlist.
- Cypress pipeline regression seeds the same stale cache, waits for startup refresh, then verifies pipeline stages only show the refreshed playlist.
- Cypress manual refresh regression renders pipeline stale cached playlists first, installs YouTube helpers after render, clicks Refresh, and verifies the selector re-renders with the fresh helper data.
- Cypress manual refresh regression also asserts the console diagnostics for click and successful refresh are emitted.
