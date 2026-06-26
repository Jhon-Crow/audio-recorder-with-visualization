# Issue 182 Case Study: Pipeline YouTube Playlist Creation

## Source Data

- Issue metadata: `issue.json`
- Issue comments: `issue-comments.json`
- Pull request metadata: `pr-185.json`
- Pull request conversation comments: `pr-185-conversation-comments.json`
- Latest pull request conversation comments: `pr-comments.json`
- Pull request review comments: `pr-185-review-comments.json`
- Latest pull request review comments: `pr-review-comments.json`
- Pull request reviews: `pr-185-reviews.json`
- Latest pull request reviews: `pr-reviews.json`
- Current pull request diff snapshot: `pr-185-current.diff`
- Local verification logs:
  - `npm-install.log`
  - `jest-youtube-uploader.log`
  - `build.log`
  - `diff-check.log`
  - `cypress-pipeline-mode-full.log`
  - `http-server.log`

## Timeline

- 2026-06-26 08:45 UTC: Issue 182 reported that clicking the button to create a new playlist did nothing, while the newly created playlist should appear in the playlist checkbox selector.
- 2026-06-26 08:58 UTC: PR 185 first fixed one readiness case where the pipeline selector could render before `window.AudioRecorderYouTube` was available.
- 2026-06-26 09:05 UTC: CI passed for the first PR version.
- 2026-06-26 12:46 UTC: Repository owner reported that playlist creation in the pipeline still did not work in manual verification. The owner also clarified that YouTube upload flows should use the same inputs everywhere and avoid duplicated functionality.
- 2026-06-26 12:47 UTC and later: This follow-up investigation collected issue/PR data into this folder and reworked the playlist selector so the pipeline delegates to the same selector implementation used by the YouTube upload modal.
- 2026-06-26 13:19 UTC: Repository owner reported that playlists did not auto-refresh and provided an Electron console log where stored YouTube authorization restore failed with `Token has been expired or revoked.`
- 2026-06-26 13:37 UTC and later: The revoked-token path was reproduced in Cypress and fixed so invalid Electron authorization is cleared, manual re-authorization refreshes playlists immediately, and already-rendered pipeline selectors receive the refreshed playlist list.

## Root Cause

The YouTube upload modal and the pipeline stage form had separate playlist selector implementations.

The modal implementation in `examples/youtube-upload.js` owned the real playlist workflow:

- reads and writes the `audio-recorder-youtube-playlists` localStorage entry
- refreshes playlists through the YouTube helper
- creates playlists through the YouTube helper
- updates the playlist input value
- dispatches playlist-change events

The pipeline implementation in `examples/pipeline.js` duplicated the UI and part of the behavior. That duplicate path could drift from the modal implementation and could make the pipeline form appear to have equivalent controls while not reliably using the same state and helper behavior as the main upload flow.

The later auto-refresh failure had a separate auth-state root cause. When Electron restore failed because the stored Google token had expired or been revoked, `restoreElectronYouTubeAuthorization()` only logged the error and returned `false`. It did not clear the stale local token state, and a later successful manual authorization did not force a playlist refresh before the already-rendered pipeline selector was reused.

## Fix

`examples/youtube-upload.js` now exposes a shared browser-native selector through `window.AudioRecorderYouTubePlaylistSelector.render`.

The YouTube upload modal uses that shared renderer for `#youtubePlaylistSelector`.

The pipeline uses the same renderer for each stage playlist field and passes a stage-specific value binding:

- `value`: current hidden stage playlist input value
- `getValue`: live hidden input value
- `onChange`: updates the stage playlist field through the existing pipeline state update path
- `onRefresh`: re-renders pipeline stages after playlist refresh
- `onStatus`: reports playlist errors through the app status

This keeps the pipeline stage controls separate per stage while sharing the playlist creation, refresh, storage, checkbox rendering, and selected-ID mutation behavior with the main YouTube upload UI.

The Electron recovery path now clears invalid stored authorization after a failed restore. After successful restore or manual authorization, it force-refreshes YouTube playlists and emits the shared playlist-change event so pipeline selectors already visible on screen can re-render with the latest playlist checkboxes.

## Verification

Passed:

- `npm test -- --runTestsByPath tests/YouTubeUploader.test.ts`
- `npm run build`
- `git diff --check`

Pipeline Cypress status:

- `npm run test:e2e -- --spec cypress/e2e/pipeline-mode.cy.js` was run with the local server at `http://localhost:8080`.
- The issue-specific test `shows fetched YouTube playlists in pipeline stages and creates playlists by name` passed.
- The regression test `creates a pipeline playlist after YouTube helpers become available post-render` passed.
- The regression test `refreshes pipeline playlists after expired Electron authorization is replaced` passed.
- The full spec completed with 27 passing tests and 2 existing unrelated failures in stage navigation and relative publish date assertions. The saved log is `cypress-pipeline-mode-full.log`.

## Notes

The implementation follows the requested FSD direction pragmatically within the current plain-script examples architecture: YouTube playlist selector behavior is owned by the YouTube upload feature module and consumed by the pipeline feature instead of being duplicated inside the pipeline.
