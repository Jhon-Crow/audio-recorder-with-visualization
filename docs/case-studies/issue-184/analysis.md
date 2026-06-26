# Issue 184 Case Study: YouTube Defaults Still Stale After Restart

## Problem

Issue 184 asked the upload UI to use data from the signed-in YouTube account instead of only the app defaults. The first PR implementation loaded channel keywords as default upload tags, but reviewer feedback on PR 187 said it did not work and pointed to PR 183 as relevant prior work.

The feedback screenshot was saved as `pr-comment-screenshot.png`. It confirms the reviewer expected the previous YouTube startup-refresh work to be analyzed and reused, not only channel keyword support.

## Collected Data

- Issue comments: `issue-comments.json`
- PR 187 discussion: `pr-187-comments.json`
- PR 187 review data: `pr-187-review-comments.json`, `pr-187-reviews.json`
- PR 183 metadata and discussion: `pr-183-view.json`
- PR 183 diff: `pr-183.diff`
- CI run list for this branch: `recent-ci-runs.json`
- Reviewer screenshot: `pr-comment-screenshot.png`

The latest CI runs captured for branch `issue-184-361501480150` were successful for commits `79e6f10`, `5b74e56`, and `355b55b`.

## Timeline

- 2026-06-26 08:45 UTC: PR 183 was opened for issue 181 to refresh YouTube playlists on startup.
- 2026-06-26 09:00 UTC: PR 187 added channel default tags for issue 184.
- 2026-06-26 12:03 UTC: Reviewer reported PR 183 still showed old information after restart and requested reuse of PR 185 if relevant.
- 2026-06-26 12:20 UTC: Reviewer reported PR 187 did not work and asked to analyze PR 183 and adopt relevant work.

## External Facts

YouTube Data API `channels.list` supports `mine=true` and `part=brandingSettings`, which is the correct endpoint for signed-in channel branding keywords used as upload tag defaults.

YouTube Data API `playlists.list` supports `mine=true`, which returns playlists owned by the authenticated channel. A successful startup refresh should therefore treat that response as authoritative for the cached playlist list.

References:
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlists/list

## Root Cause

The first issue-184 fix only handled channel tags. It missed the related stale-account-data failure mode from PR 183:

1. Startup playlist refresh merged API results into the cached list, preserving playlists that YouTube no longer returned.
2. The upload modal and pipeline selectors could render from stale localStorage before the refresh completed.
3. Creating one playlist replaced the whole cache instead of merging the new playlist into the current cache.
4. Pipeline playlist controls captured `window.AudioRecorderYouTube` at render time, so late helper availability could leave actions bound to an old or missing helper.

## Adopted Solution

- Keep channel keyword defaults from the existing issue-184 implementation.
- Replace cached playlists with the authoritative `playlists.list?mine=true` response after successful refresh.
- Re-render the upload playlist selector after refresh so visible UI reflects the latest cache.
- Merge newly created playlists into the cache instead of replacing all saved playlists.
- Reuse the PR 185 pattern of reading `window.AudioRecorderYouTube` at action time for pipeline playlist actions.
- Add Cypress coverage for upload and pipeline startup refresh, plus late helper availability.

## Verification Strategy

- Jest covers channel keyword parsing and YouTube helper behavior.
- Cypress upload regression seeds stale playlist localStorage, returns a different playlist from the API, and verifies the upload modal only shows the refreshed playlist.
- Cypress pipeline regression verifies the same replacement behavior in pipeline stages.
- Cypress late-helper regression verifies pipeline create actions use the current YouTube helper.
