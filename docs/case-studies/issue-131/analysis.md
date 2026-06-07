# Issue 131 Analysis

## Inputs reviewed

- Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/131
- Existing PR for this branch: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/138
- Related PR 126 for remembering YouTube upload form options.
- Related PR 128 for the existing pipeline mode foundation.
- Related PR 135 for the earlier single-playlist YouTube upload draft.
- Related PR 139 for the CSS tooltip-preview draft and follow-up request to show an actual future visualization screenshot.
- PR feedback comment 4641540167, including the tooltip overflow screenshot saved as `assets/pr-comment-4641540167-tooltip.png`.
- 2026-06-07 PR 138 comments requesting saved visualization presets in pipeline selects, a YouTube Studio-style playlist checkbox/create flow, case-study data, and actual visualization preview screenshots.
- Raw issue, PR, CI, PR 139, and git artifacts saved under `logs/`.

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
- The latest PR 138 review found two remaining functional gaps: asynchronously loaded sidebar presets still needed to refresh the pipeline preset selects, and playlist assignment needed to remove raw ID entry completely in favor of checkboxes plus "Create new".
- PR 139 demonstrated the intended hover affordance, but used synthetic colored bars. The requested behavior is closer to a low-resolution future-render preview using the saved visualization settings, dimensions, and background assets.

## Timeline

- 2026-06-07 04:06 UTC: Maintainer requested that PR 126 upload-form persistence behavior be reused.
- 2026-06-07 04:56 UTC: Initial implementation was pushed and marked ready.
- 2026-06-07 05:31 UTC: Maintainer added the five follow-up findings listed above and requested deeper case-study artifacts in `docs/case-studies/issue-131`.
- 2026-06-07 13:32 UTC: PR was moved back to draft for the follow-up work.
- 2026-06-07 15:31 UTC: Maintainer reported that saved visualizations still did not appear in the pipeline preset select and that playlist ID entry still had not been replaced by a checkbox/create selector.
- 2026-06-07 15:38 UTC: Maintainer requested using the PR 139 direction while showing a screenshot of the future visualization rather than placeholder bars.
- 2026-06-07 current session: raw GitHub/CI/PR 139 data and screenshots were preserved locally, the remaining functional and preview gaps were fixed, and the affected checks were rerun.

## Root Causes

- Relative scheduling computed task dates at run time, but the disabled `datetime-local` field still read the stage's previously saved `publishAtLocal` unless the stage itself was edited.
- Preset loading only accepted records with a nested `settings` object. Some persisted sidebar presets are valid flat objects, so the pipeline select incorrectly showed "No saved visualization presets."
- The pipeline module only read presets from localStorage during render. When the sidebar loaded presets from the configured folder after startup, the pipeline UI did not receive a structured update and could keep stale preset choices.
- Playlist support was implemented at the uploader/API layer first, leaving the UI as a low-level ID field and making it impossible to discover existing playlists without leaving the app.
- File selection state lived in memory and persisted file names separately, but the stage UI only exposed the add/replace path.
- Tooltip CSS used `white-space: nowrap` and a centered absolute pseudo-element, which made long tooltip text exceed narrow containers and mobile viewports.
- The first preview tooltip draft relied on static CSS bars, so it could not reflect resolution, visualizer type, colors, backgrounds, or per-track preset overrides.

## Solution

- Relative schedule edits now trigger a stage rerender, recompute dependent dates, and write current relative `publishAtLocal` values so disabled fields remain accurate.
- Pipeline preset loading now normalizes both nested `settings` presets and flat saved setting objects. The core app dispatches `audioRecorderPresetsChanged` after preset saves/folder loads and exposes `getSavedPresets()` for pipeline reads.
- The uploader now supports `playlists.list` pagination and `playlists.insert`. Standalone and pipeline YouTube forms now load saved/account playlists, show playlist checkboxes, and create/select new playlists by name while preserving the existing comma-separated playlist ID upload contract internally.
- Each pipeline stage now has a `Сбросить файлы` button under the add-files button, clearing selected files and stored file names.
- Tooltips now wrap, cap their width against the viewport, and use overflow-safe text wrapping.
- Pipeline stage numbers and album track handles now generate cached PNG preview images from the real visualizer canvas path using the stage/track resolution, preset, colors, and background image. A fallback preview is used only if the visualizer render path fails.
- Preview tooltip stacking now raises the tab layer above the sticky preview canvas while the trigger is hovered or keyboard-focused. The generated screenshot is saved at `screenshots/issue-131-pipeline-preview-tooltip.png`.

## YouTube API facts used

- `videos.insert` uploads a video through `POST https://www.googleapis.com/upload/youtube/v3/videos` and accepts metadata in `snippet` and `status`; it lists `youtube.upload` and `youtube.force-ssl` among valid scopes:
  https://developers.google.com/youtube/v3/docs/videos/insert
- Resumable upload starts with `uploadType=resumable`, then uploads the media to the returned `Location` URI:
  https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- `playlistItems.insert` adds a video to a playlist through `POST https://www.googleapis.com/youtube/v3/playlistItems`, requires `part=snippet`, requires `snippet.playlistId` and `snippet.resourceId`, and accepts the `youtube.force-ssl` scope:
  https://developers.google.com/youtube/v3/docs/playlistItems/insert
- `playlists.list` retrieves playlists through `GET https://www.googleapis.com/youtube/v3/playlists`; `mine=true` returns playlists owned by the authenticated user, `maxResults` accepts values up to 50, and `nextPageToken` is used to page through results:
  https://developers.google.com/youtube/v3/docs/playlists/list
- `playlists.insert` creates a playlist through `POST https://www.googleapis.com/youtube/v3/playlists`; `snippet.title` is required, and `snippet.description` plus `status.privacyStatus` are writable:
  https://developers.google.com/youtube/v3/docs/playlists/insert
- Scheduled uploads are represented on the video resource with `status.publishAt`; scheduled uploads are sent as private until YouTube publishes them:
  https://developers.google.com/youtube/v3/docs/videos

## Verification plan

- Unit-test playlist ID normalization and playlist insertion after video upload.
- Cypress-test saved preset selection, relative/absolute/immediate field states, upload order policy, album track file addition, pipeline playlist upload, and the completion report.
- Run build, typecheck, Jest, and targeted Cypress specs before updating PR 138.

## Verification results

- `npm run lint`
- `npm run typecheck`
- `npm test -- --runTestsByPath tests/YouTubeUploader.test.ts`
- `npm test -- --runInBand`
- `npm run build`
- `npx cypress run --spec cypress/e2e/pipeline-mode.cy.js`
- `npx cypress run --spec cypress/e2e/youtube-upload-ui.cy.js`
- `npx cypress run`
- `npx cypress run --spec cypress/e2e/pipeline-mode.cy.js` after the final tooltip stacking adjustment

The latest command logs are saved under `logs/`. The final preview screenshot is saved under `screenshots/`.
