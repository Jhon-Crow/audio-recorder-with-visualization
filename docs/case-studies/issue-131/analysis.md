# Issue 131 Analysis

## Inputs reviewed

- Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/131
- Existing PR for this branch: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/138
- Related PR 126 for remembering YouTube upload form options.
- Related PR 128 for the existing pipeline mode foundation.
- Related PR 135 for the earlier single-playlist YouTube upload draft.

## Findings

- Issue 131 asks for pipeline timing improvements, saved visualizer preset reuse, clearer disabled timing controls, stage color cues, album track file picking, a completion report, and YouTube playlist assignment per upload stage.
- PR 126 stores and restores reusable YouTube upload form settings. This branch preserves that behavior and extends the saved form state with playlist IDs.
- PR 135 was still open during investigation. It added a single `playlistId` path. This branch implements playlist support directly and accepts both `playlistId` and plural `playlistIds`, deduping comma/newline-separated values.

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
