# Issue 131 Analysis

## Inputs reviewed

- Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/131
- Existing PR for this branch: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/138
- Related PR 126 for remembering YouTube upload form options.
- Related PR 128 for the existing pipeline mode foundation.
- Related PR 135 for the earlier single-playlist YouTube upload draft.
- PR feedback comment 4641540167, including the tooltip overflow screenshot saved as `assets/pr-comment-4641540167-tooltip.png`.
- Raw issue, PR, CI, and git artifacts saved under `logs/`.

## Findings

- Issue 131 asks for pipeline timing improvements, saved visualizer preset reuse, clearer disabled timing controls, stage color cues, album track file picking, a completion report, and YouTube playlist assignment per upload stage.
- PR 126 stores and restores reusable YouTube upload form settings. This branch preserves that behavior and extends the saved form state with playlist IDs.
- PR 135 was still open during investigation. It added a single `playlistId` path. This branch implements playlist support directly and accepts both `playlistId` and plural `playlistIds`, deduping comma/newline-separated values.
- Follow-up review found five gaps after the first implementation:
  - Relative stages displayed disabled publication dates, but those dates did not update when their reference stage changed.
  - Playlist assignment was still a raw ID text input rather than a YouTube Studio-style checklist plus create action.
  - Pipeline preset selects could reject saved presets stored as flat setting objects while the sidebar still displayed them.
  - Per-stage file picking had no quick reset button next to the add-file control.
  - CSS tooltip bubbles could overflow the viewport because they were single-line, center-positioned pseudo-elements.

## Timeline

- 2026-06-07 04:06 UTC: Maintainer requested that PR 126 upload-form persistence behavior be reused.
- 2026-06-07 04:56 UTC: Initial implementation was pushed and marked ready.
- 2026-06-07 05:31 UTC: Maintainer added the five follow-up findings listed above and requested deeper case-study artifacts in `docs/case-studies/issue-131`.
- 2026-06-07 13:32 UTC: PR was moved back to draft for the follow-up work.
- 2026-06-07 current session: raw GitHub/CI/git data and the tooltip screenshot were preserved locally, then the five follow-up fixes were implemented and verified.

## Root Causes

- Relative scheduling computed task dates at run time, but the disabled `datetime-local` field still read the stage's previously saved `publishAtLocal` unless the stage itself was edited.
- Preset loading only accepted records with a nested `settings` object. Some persisted sidebar presets are valid flat objects, so the pipeline select incorrectly showed "No saved visualization presets."
- Playlist support was implemented at the uploader/API layer first, leaving the UI as a low-level ID field.
- File selection state lived in memory and persisted file names separately, but the stage UI only exposed the add/replace path.
- Tooltip CSS used `white-space: nowrap` and a centered absolute pseudo-element, which made long tooltip text exceed narrow containers and mobile viewports.

## Solution

- Relative schedule edits now trigger a stage rerender, recompute dependent dates, and write current relative `publishAtLocal` values so disabled fields remain accurate.
- Pipeline preset loading now normalizes both nested `settings` presets and flat saved setting objects.
- Standalone and pipeline YouTube forms now show saved playlist checkboxes and a "Create new" row while preserving the existing comma-separated playlist ID upload contract.
- Each pipeline stage now has a `Сбросить файлы` button under the add-files button, clearing selected files and stored file names.
- Tooltips now wrap, cap their width against the viewport, and use overflow-safe text wrapping.

## YouTube API facts used

- `videos.insert` uploads a video through `POST https://www.googleapis.com/upload/youtube/v3/videos` and accepts metadata in `snippet` and `status`; it lists `youtube.upload` and `youtube.force-ssl` among valid scopes:
  https://developers.google.com/youtube/v3/docs/videos/insert
- Resumable upload starts with `uploadType=resumable`, then uploads the media to the returned `Location` URI:
  https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- `playlistItems.insert` adds a video to a playlist through `POST https://www.googleapis.com/youtube/v3/playlistItems`, requires `part=snippet`, requires `snippet.playlistId` and `snippet.resourceId`, and accepts the `youtube.force-ssl` scope:
  https://developers.google.com/youtube/v3/docs/playlistItems/insert
- Scheduled uploads are represented on the video resource with `status.publishAt`; scheduled uploads are sent as private until YouTube publishes them:
  https://developers.google.com/youtube/v3/docs/videos

## Verification plan

- Unit-test playlist ID normalization and playlist insertion after video upload.
- Cypress-test saved preset selection, relative/absolute/immediate field states, upload order policy, album track file addition, pipeline playlist upload, and the completion report.
- Run build, typecheck, Jest, and targeted Cypress specs before updating PR 138.

## Verification results

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx cypress run --spec cypress/e2e/pipeline-mode.cy.js`
- `npx cypress run --spec cypress/e2e/youtube-upload-ui.cy.js`
- `npx cypress run`

The latest command logs are saved under `logs/`.
