# Issue 102: YouTube Upload Button

## Source Artifacts

- Issue snapshot: `logs/issue-102.json`
- Issue comments snapshot: `logs/issue-102-comments.json`
- PR snapshot: `logs/pr-104.json`
- Latest issue snapshot: `logs/issue-102-latest.json`
- Latest issue comments snapshot: `logs/issue-102-comments-latest.json`
- Latest PR snapshot: `logs/pr-104-latest.json`
- Latest PR comments snapshot: `logs/pr-104-comments-latest.json`
- Latest PR review comments snapshot: `logs/pr-104-review-comments-latest.json`
- Latest PR reviews snapshot: `logs/pr-104-reviews-latest.json`
- Latest CI runs snapshot: `logs/ci-runs-latest.json`
- Current PR conversation comments snapshot: `logs/pr-104-conversation-comments-2026-06-04.json`
- Current PR review comments snapshot: `logs/pr-104-review-comments-2026-06-04.json`
- Current PR reviews snapshot: `logs/pr-104-reviews-2026-06-04.json`
- Current CI runs snapshot: `logs/ci-runs-2026-06-04.json`
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
- Google Identity Services setup requires a Web application OAuth Client ID and Authorized JavaScript origins. For local testing, Google documents adding both `http://localhost` and `http://localhost:<port_number>`. Source: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Google's OAuth troubleshooting docs map `invalid_client` to an unauthorized request origin and `origin_mismatch` to a scheme, domain, or port mismatch against Authorized JavaScript origins. Source: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- Google Account Authorization JavaScript API documents `initTokenClient`, the browser token-flow entry point used by this implementation. Source: https://developers.google.com/identity/oauth2/web/reference/js-reference
- YouTube `videos.insert` uploads a video and can set metadata. It requires an authorized scope such as `https://www.googleapis.com/auth/youtube.upload`, supports media upload, and accepts `video/*` or `application/octet-stream`. Source: https://developers.google.com/youtube/v3/docs/videos/insert
- YouTube resumable uploads start with `POST /upload/youtube/v3/videos?uploadType=resumable&part=...`; a successful session returns a `Location` header, then the binary data is uploaded with `PUT` requests. Chunk sizes must be multiples of 256 KB except the final chunk. Source: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- The YouTube video resource supports `snippet.title`, `snippet.description`, `snippet.tags`, `snippet.categoryId`, `status.privacyStatus`, `status.selfDeclaredMadeForKids`, and `status.containsSyntheticMedia`. Source: https://developers.google.com/youtube/v3/docs/videos
- Unverified API projects created after July 28, 2020 have API-uploaded videos restricted to private visibility until the project passes YouTube API Services audit. Source: https://developers.google.com/youtube/v3/docs/videos
- YouTube Help says vertical videos can be uploaded as Shorts, Shorts details include title/privacy/audience settings, and Shorts uploads have a maximum resolution of 1080p. Source: https://support.google.com/youtube/answer/10059070
- YouTube Help says hashtags can be added to a video title or description, and over-tagging can cause hashtags to be ignored or content to be penalized. Source: https://support.google.com/youtube/answer/6390658
- Google documents `invalid_client` for client-side OAuth as a sign that the JavaScript request origin scheme, domain, or port may not match an Authorized JavaScript origin registered for the OAuth Client ID. Source: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- Google Cloud OAuth client management documents that client-side JavaScript apps must specify Authorized JavaScript origins, and that these origins cannot include paths or trailing slashes. Source: https://support.google.com/cloud/answer/6158849
- Similar reports in the Google API JavaScript client tracker show Google Identity Services logging origin/client mismatches when a domain is not allowed for the selected client ID. Source: https://github.com/google/google-api-javascript-client/issues/1159
- GitHub Actions began warning that JavaScript actions running on Node.js 20 are deprecated and can be opted into Node.js 24 with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`. Source: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

## OAuth Feedback Timeline

- Initial implementation used Google Identity Services directly from the example app.
- First PR feedback reported `400 invalid_request` with `origin=file://`. Root cause: Google Identity Services cannot authorize from a `file://` origin.
- Follow-up fix blocked direct `file://` authorization and showed a localhost/HTTPS requirement. That avoided Google's raw error page, but desktop users opening the packaged app were left with a blocked sign-in path.
- Electron follow-up started a loopback static server and loaded the app from `http://localhost:<port>/index.html`, so desktop OAuth requests now originate from HTTP localhost instead of `file://`.
- PR feedback then reported `401 invalid_client` with `flowName=GeneralOAuthLite`. Root cause analysis: after the origin fix, the remaining failure is OAuth client configuration, not the recording/upload code. The likely causes are a missing/wrong OAuth Client ID, using a non-Web client type, using a deleted/disabled client, or not adding the exact `http://localhost:<port>` origin used by the app to Authorized JavaScript origins.
- Latest PR feedback repeated `401 invalid_client`. The additional root cause found in this follow-up is that Electron used port `0`, which means a random localhost port on each launch. Because Google validates JavaScript origins by scheme, host, and port, users could not reliably pre-register one stable Electron origin.
- Latest PR feedback still reports `401 invalid_client` after the stable origin change. With the app origin stabilized at `http://localhost:8080`, the remaining client-side root cause is Google Cloud project setup: the entered OAuth Client ID must be a Web application client from a project with YouTube Data API v3 enabled and exactly `http://localhost:8080` registered under Authorized JavaScript origins.
- The same feedback linked a CI warning from the Windows build. This is not a test failure; it is a GitHub Actions runtime deprecation warning for JavaScript actions that still execute on Node.js 20.

## OAuth Root Causes

- Google Identity Services is browser-origin sensitive. `file://` is not a valid web origin for its token flow.
- The Electron app must run the renderer from localhost or HTTPS before calling Google OAuth; loading the same HTML as a local file will produce request-origin errors.
- `invalid_client` is not recoverable by retrying upload code. It requires a valid Web application OAuth Client ID configured in Google Cloud Console.
- Authorized JavaScript origins are exact at the scheme, host, and port level. For example, `http://localhost:8080` and `http://localhost:51234` are different origins.
- A random Electron app-server port turns the required OAuth origin into a moving target. Even a correctly configured Web OAuth client can fail if it was authorized for `http://localhost:8080` but the app launches from `http://localhost:51234`.
- A user-pasted value that is not shaped like `*.apps.googleusercontent.com` can be rejected locally before opening Google's popup.
- Once origin and format are correct, a persistent `invalid_client` means Google has rejected the selected OAuth client record. The app cannot bypass that server-side validation; the practical fix is to guide the user to create or edit the correct Web application OAuth client and register the exact current origin.
- The CI warning root cause is workflow/runtime drift, not application code. The workflow can opt JavaScript actions into Node.js 24 while continuing to install the project's tested package runtime with `actions/setup-node`.

## Considered Solutions

1. Client-side Google Identity Services plus YouTube Data API REST upload

   Pros: fits the current browser/Electron-renderer example app, needs no backend secret, can use the existing recording `Blob`, and can be tested with mocked Google/API calls. Cons: access tokens are short-lived and the user must configure an OAuth Client ID.

2. Electron main-process OAuth with system-browser loopback callback

   Pros: more appropriate for a packaged desktop app and avoids embedded OAuth concerns. Cons: much larger implementation, requires local callback plumbing, and does not help the browser example.

3. Backend upload proxy

   Pros: can hold refresh tokens securely and support long-running retries. Cons: this repository is a client-side recorder with no backend service, and adding one would be a major architecture change.

4. Google API JavaScript client (`gapi.client`) instead of direct REST

   Pros: official client abstraction. Cons: direct REST is smaller for one endpoint, and resumable binary upload control is clearer in a focused helper.

5. Package a default OAuth Client ID with the app

   Pros: removes client-ID setup from the user path. Cons: it requires project ownership, authorized origins for release hosts, quota/audit ownership, consent-screen maintenance, and possible YouTube API Services audit. It is not suitable for a forked example without a maintained Google Cloud project.

6. Add OAuth diagnostics in the client UI

   Pros: catches malformed client IDs before a popup and turns Google's `invalid_client` callback into concrete setup guidance that includes the current origin. Cons: it cannot validate a real Google Cloud client remotely without attempting OAuth.

7. Use a stable Electron localhost port for the renderer origin

   Pros: aligns Electron with the existing `npm run serve` origin, gives users one OAuth origin to register (`http://localhost:8080`), and keeps the existing browser-compatible Google Identity Services flow. Cons: if another process already owns port 8080, the app must fall back to an ephemeral port and the user must authorize the fallback origin.

8. Add an in-app Google Cloud OAuth setup shortcut

   Pros: turns repeated `invalid_client` feedback into a guided repair path by opening the exact Google Cloud OAuth client screen and showing/copying the exact origin to register. Cons: Google still requires the user to own or configure the Cloud project; no client-side code can create a valid OAuth client without that account context.

9. Opt GitHub Actions JavaScript actions into Node.js 24

   Pros: addresses the deprecation warning reported from CI without changing the package's local Node install step or dependency graph. Cons: this only removes the actions-runtime warning; future major action upgrades can still be reviewed separately.

## Implemented Solution

- Added `src/core/YouTubeUploader.ts`, exported from `src/index.ts`.
- The uploader builds the YouTube `snippet,status` resource, starts a resumable upload session, uploads the recording `Blob` in 256 KB-aligned chunks, reports progress, and returns the YouTube watch URL.
- Added metadata helpers for tag normalization and the `#short` description append.
- Added `examples/youtube-upload.js` to own Google sign-in, token lifetime state, upload form state, progress state, and API calls.
- Added YouTube auth/upload modals to `examples/index.html`.
- Added `Upload to YouTube` next to both browser `Download` and Electron `Save and Show in Folder` actions.
- The access token is kept in memory only for the current page session. The OAuth Client ID is stored in localStorage for convenience.
- Added client-side OAuth diagnostics: malformed client IDs are blocked before Google sign-in, and Google `invalid_client` responses now explain that a Web application OAuth Client ID must include the current origin in Authorized JavaScript origins.
- Updated Electron to prefer `http://localhost:8080` for the internal static server, falling back to a random port only when 8080 is already busy.
- Added an OAuth Setup action in the Google sign-in modal that opens the Google Cloud OAuth client page and shows the exact current origin to add. When browser clipboard access is available, the origin is copied for pasting into Authorized JavaScript origins.
- Opted the GitHub Actions workflow into the Node.js 24 JavaScript action runtime to address the Node 20 deprecation warning reported from the Windows build logs.

## Follow-up: OAuth Origin Handling

PR feedback showed that blocking `file://` origins avoided Google's `origin=file://` 400 page, but it also left desktop users stuck when they launched the bundled Electron app. Google Identity Services requires a web origin such as `http://localhost` or HTTPS, so the Electron app now starts a loopback static server and loads the same example UI from `http://localhost:<port>/index.html`. Direct browser `file://` usage still cannot authorize with Google, but the UI offers to reopen the example at `http://localhost:8080/index.html`, matching the existing `npm run serve` script.

## Follow-up: OAuth Client ID Handling

PR feedback then showed `401 invalid_client`. The app cannot automatically repair a Google Cloud Console configuration, but it can prevent a confusing raw error path. The auth modal now validates the entered Client ID format before opening Google sign-in and converts Google `invalid_client` callbacks into a targeted message:

`Google rejected this OAuth Client ID. Create a Web application OAuth Client ID in Google Cloud Console and add <current-origin> to Authorized JavaScript origins.`

For Electron this origin is now normally `http://localhost:8080`, matching browser testing with `npm run serve`.

## Follow-up: Stable OAuth Origin

The repeated `401 invalid_client` report after the diagnostics change showed that guidance alone was not enough. Electron was loading from a random localhost port, so the required Authorized JavaScript origin could change every launch. The fix is to make the Electron static server prefer port 8080, the same port used by the existing `npm run serve` path. The app still falls back to a random port if 8080 is already busy, but the primary path now gives users one stable origin to add in Google Cloud Console:

`http://localhost:8080`

The UI error message was also tightened to say that the Authorized JavaScript origin must be exactly the origin, without `/index.html` or a trailing slash.

## Follow-up: Repeated Invalid Client and CI Warning

The next feedback still reported `401 invalid_client`, which confirms the code has reached Google Identity Services with a web origin but Google is rejecting the selected client record. The implementation now provides a repair path inside the auth modal: `OAuth Setup` opens Google Cloud's OAuth client screen and shows/copies the exact origin that must be registered. The setup text also calls out that YouTube Data API v3 must be enabled for the same Cloud project.

The feedback also linked a GitHub Actions warning about Node.js 20 JavaScript actions. The workflow now sets `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` at workflow scope. This opts official JavaScript actions into the newer runtime while keeping the app's dependency installation controlled by `actions/setup-node`.

## Verification Plan

- Unit tests cover metadata generation, Short tag behavior, resumable session requests, chunk continuation after HTTP 308, API error handling, and empty-video validation.
- Cypress coverage creates a synthetic recording, verifies the YouTube button beside the download action, verifies the file-origin localhost handoff, verifies invalid OAuth Client ID guidance, stubs Google sign-in, stubs YouTube API requests, and verifies that the Short checkbox adds `#short` to the submitted description.
- Local checks should include `npm run typecheck`, `npm test -- --runInBand`, `npm run build`, and the new Cypress spec.
