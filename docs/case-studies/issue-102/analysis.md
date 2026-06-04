# Issue 102: YouTube Upload Button

## Source Artifacts

- Issue snapshot: `logs/issue-102.json`
- Issue comments snapshot: `logs/issue-102-comments.json`
- PR snapshot: `logs/pr-104.json`
- Issue URL: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/102

The issue asks for an upload-to-YouTube button next to the existing save action. If the user has not signed in with Google, clicking upload should open Google sign-in first; after authorization, the YouTube upload form should open. If authorization is already available, the form should open immediately. The form should expose video metadata, including a Short checkbox that appends `#short` to the description.

## Repository Findings

- Generated recordings are created in `examples/app-core.js` by `addRecording(blob)`.
- Browser mode currently shows a `Download` link for each recording.
- Electron mode currently shows `Save and Show in Folder` through the existing `window.electronAPI.saveVideoAndShow()` IPC bridge.
- The app already has modal styling and progress-bar styling in `examples/styles.css`.
- The library build exposes browser globals through `dist/audio-recorder-visualization.umd.js`, so a reusable TypeScript uploader can be exported and consumed by the example app.
- The existing 9:16 aspect-ratio work in issue 95 is useful for Shorts because the app can already render vertical video output.

## External Research

- Google Identity Services token model is the recommended browser OAuth path for calling Google APIs from JavaScript. `requestAccessToken()` opens the account/sign-in/consent flow and returns a short-lived access token; Google APIs can then be called directly with REST and CORS. Source: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- YouTube `videos.insert` uploads a video and can set metadata. It requires an authorized scope such as `https://www.googleapis.com/auth/youtube.upload`, supports media upload, and accepts `video/*` or `application/octet-stream`. Source: https://developers.google.com/youtube/v3/docs/videos/insert
- YouTube resumable uploads start with `POST /upload/youtube/v3/videos?uploadType=resumable&part=...`; a successful session returns a `Location` header, then the binary data is uploaded with `PUT` requests. Chunk sizes must be multiples of 256 KB except the final chunk. Source: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- The YouTube video resource supports `snippet.title`, `snippet.description`, `snippet.tags`, `snippet.categoryId`, `status.privacyStatus`, `status.selfDeclaredMadeForKids`, and `status.containsSyntheticMedia`. Source: https://developers.google.com/youtube/v3/docs/videos
- Unverified API projects created after July 28, 2020 have API-uploaded videos restricted to private visibility until the project passes YouTube API Services audit. Source: https://developers.google.com/youtube/v3/docs/videos
- YouTube Help says vertical videos can be uploaded as Shorts, Shorts details include title/privacy/audience settings, and Shorts uploads have a maximum resolution of 1080p. Source: https://support.google.com/youtube/answer/10059070
- YouTube Help says hashtags can be added to a video title or description, and over-tagging can cause hashtags to be ignored or content to be penalized. Source: https://support.google.com/youtube/answer/6390658

## Considered Solutions

1. Client-side Google Identity Services plus YouTube Data API REST upload

   Pros: fits the current browser/Electron-renderer example app, needs no backend secret, can use the existing recording `Blob`, and can be tested with mocked Google/API calls. Cons: access tokens are short-lived and the user must configure an OAuth Client ID.

2. Electron main-process OAuth with system-browser loopback callback

   Pros: more appropriate for a packaged desktop app and avoids embedded OAuth concerns. Cons: much larger implementation, requires local callback plumbing, and does not help the browser example.

3. Backend upload proxy

   Pros: can hold refresh tokens securely and support long-running retries. Cons: this repository is a client-side recorder with no backend service, and adding one would be a major architecture change.

4. Google API JavaScript client (`gapi.client`) instead of direct REST

   Pros: official client abstraction. Cons: direct REST is smaller for one endpoint, and resumable binary upload control is clearer in a focused helper.

## Implemented Solution

- Added `src/core/YouTubeUploader.ts`, exported from `src/index.ts`.
- The uploader builds the YouTube `snippet,status` resource, starts a resumable upload session, uploads the recording `Blob` in 256 KB-aligned chunks, reports progress, and returns the YouTube watch URL.
- Added metadata helpers for tag normalization and the `#short` description append.
- Added `examples/youtube-upload.js` to own Google sign-in, token lifetime state, upload form state, progress state, and API calls.
- Added YouTube auth/upload modals to `examples/index.html`.
- Added `Upload to YouTube` next to both browser `Download` and Electron `Save and Show in Folder` actions.
- The access token is kept in memory only for the current page session. The OAuth Client ID is stored in localStorage for convenience.

## Verification Plan

- Unit tests cover metadata generation, Short tag behavior, resumable session requests, chunk continuation after HTTP 308, API error handling, and empty-video validation.
- Cypress coverage creates a synthetic recording, verifies the YouTube button beside the download action, stubs Google sign-in, stubs YouTube API requests, and verifies that the Short checkbox adds `#short` to the submitted description.
- Local checks should include `npm run typecheck`, `npm test -- --runInBand`, `npm run build`, and the new Cypress spec.
