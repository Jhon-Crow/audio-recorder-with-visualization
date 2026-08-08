# Issue 203: pipeline YouTube authorization after album rendering

## Scope

Issue [#203](https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/203) reports that after rendering ten tracks and a full album, the YouTube upload action in the pipeline review flow does not work, even though single-video upload recognizes the signed-in Google account. It also asks to verify the playlist refresh fix from PR #170 and the pipeline authorization work from PR #178.

This directory preserves the supplied browser log, the issue/PR API records, review discussions, and patches used for the investigation. Access tokens are not present in the supplied console export; it records only token lengths and expiry metadata.

## Reproduction and observed timeline

The attached `localhost-1786012065028.log` contains 1,127 lines. The relevant sequence is:

1. Pipeline/preset persistence repeatedly exceeds the browser local-storage quota (lines 184 and 214-300). This is noisy but does not explain the upload button failure.
2. The application successfully calls `channels.list` and `playlists.list` (lines 256-264), proving that a valid YouTube token and playlist scope existed during the session.
3. After the long visualization run, pipeline validation stops at `assertUploadReady` with `Sign in to YouTube before running upload pipeline stages` (lines 1082-1085).
4. Immediately afterward, the normal YouTube UI again reports `hasValidAccessToken: true`, successfully refreshes channel defaults and nine playlists (lines 1089-1094).
5. A later pipeline attempt reaches Google's upload endpoint, but sends `audio/wav`; YouTube rejects that distinct attempt with HTTP 400, `Media type 'audio/wav' is not supported` (lines 1096-1113).

The chronology disproves a general Google sign-in failure. It shows that the pipeline's preflight consulted only its current token state and failed instead of initiating/recovering authorization, while the regular upload UI had an authorization recovery path.

## Root causes

### 1. Pipeline Run did not own authorization

`examples/pipeline.js` synchronously called `assertUploadReady()`. If an upload task existed and `hasValidAccessToken()` was false at that instant, it threw. It never invoked the OAuth machinery already implemented in `examples/youtube-upload.js`.

This discrepancy is especially visible after a long batch render: access tokens are short-lived, so a token that was valid at the beginning of a session can be expired or absent from memory when the user finally runs upload stages. Google's browser token model requires the app to request a token when needed; refresh tokens are not normally exposed to browser JavaScript. Electron can similarly recover via its native authorization bridge.

The fix changes preflight to async `ensureUploadReady()` and exposes `ensureAuthorizedForPipeline()`. It validates the configured client ID/origin, requests authorization through the existing browser or Electron path, refreshes channel defaults, closes the authorization modal, and only then executes upload tasks. Existing valid-token behavior remains unchanged.

### 2. Pipeline playlist chooser retained a stale snapshot

The playlist chooser captured `selectedIds` and `known` only when rendered. Creating a playlist updated the hidden ID field and shared storage, but did not update that captured selection or rerender the stage. The new playlist therefore did not appear selected until a later render/restart.

The fix updates the local selection, persists the merged playlist collection, and rerenders stages after creation. This is the focused behavior from PR [#170](https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/170).

### 3. Independent WAV upload failure

The final HTTP 400 in the log is not an authentication error. The YouTube upload API accepts video media; the attempted object had `audio/wav`. The pipeline should upload a rendered video blob for visualization/upload stages. This report records that secondary failure rather than conflating it with the sign-in-button defect. The regression tests use `video/webm` so they exercise the intended direct-upload contract.

## Related work

- PR [#178](https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/178), “Authorize YouTube directly from pipeline Run,” contains the same async authorization ownership model and Electron/browser regressions. It is still open, so its changes were applied explicitly rather than assumed to be in `main`.
- PR [#170](https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/170), “Fix pipeline playlist creation refresh,” is also still open. Its minimal chooser refresh behavior and regression assertion were incorporated.

## Verification

Automated regressions cover:

- clicking Pipeline Run invokes Electron authorization without a separate YouTube-button click;
- clicking Pipeline Run invokes Google Identity Services in a browser and completes the authorization path;
- a playlist created inside a pipeline stage appears immediately and remains checked.

Local results on 2026-08-08:

- Jest: 10 suites, 354 tests passed;
- ESLint: passed;
- Rollup build: passed (with the repository's existing `declarationDir` warning);
- the three changed Cypress cases passed individually within the affected spec;
- the complete two-spec browser run reached 52/66 passing. Its unrelated failures are existing time/date, sidebar actionability, persisted-file, and visualization-review cases; the first attempted run also exposed that `npm run serve` serves `examples/` while tests visit `/examples/index.html`, so validation was repeated with the repository root served.

## External references

- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model): browser applications request access tokens as needed and receive them in the token callback.
- [YouTube Data API videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert): the upload method creates a video resource and accepts uploaded media.
- [YouTube Data API playlists.insert](https://developers.google.com/youtube/v3/docs/playlists/insert): playlist creation returns a playlist resource that the UI can merge immediately into its cached list.

## Preserved artifacts

- `logs/issue-203.json` and `logs/issue-203-comments.json`: issue API snapshots.
- `logs/localhost-1786012065028.log`: reporter-supplied browser console log.
- `related-prs/pr-170*` and `related-prs/pr-178*`: PR metadata, diffs, review comments, conversation comments, and reviews.
