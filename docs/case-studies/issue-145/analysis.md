# Issue 145 Case Study: Single MP4 Visualization Saved as WebM

## Summary

Issue #145 reports that the MP4/WebM filename problem was fixed for batch visualization, but still appears when visualizing a single file: an MP4 render can be saved with a `.webm` filename.

This case study verifies the single-file filename path and adds regression coverage so a rendered MP4 blob is named with an `.mp4` extension even when stale format metadata says WebM.

## Evidence Collected

- Issue data: `logs/issue-145.json`
- Issue comments: `logs/issue-145-comments.json`
- PR #147 data: `logs/pr-147.json`

## Timeline

- 2026-06-06 20:30 UTC: Issue #129 was opened for MP4/WebM mismatch during batch visualization.
- 2026-06-07 04:22 UTC: PR #130 was merged, fixing repeated MP4 encoder preflight fallback and preserving batch filename behavior that prefers rendered `Blob.type`.
- 2026-06-08 02:09 UTC: Issue #145 was opened, reporting that the same problem remained for single-file visualization.
- 2026-06-08 UTC: PR #147 was opened from branch `issue-145-0ffecde67ef4`.

## Reconstructed Failure Sequence

1. The user selects MP4 output and converts one audio file.
2. The conversion pipeline returns a video blob.
3. Filename construction must choose the extension shown in the recording list and download link.
4. If the filename path trusts requested or stale metadata instead of the actual rendered blob MIME type, an MP4 blob can be displayed and saved as `.webm`.

The batch fix already covered the multi-file path. Issue #145 asks to ensure the same rule is enforced for a single rendered file.

## Root Cause

The user-facing bug is a metadata mismatch: the selected or fallback format metadata can diverge from the actual rendered media container. Filename generation must therefore treat `Blob.type` as the source of truth and only use the format argument as a fallback when the blob does not expose a known video MIME type.

The current shared `buildRecordingFileName(sourceName, blob, format)` helper implements that rule through `getVideoExtension(blob, fallbackFormat)`. The missing piece was focused regression coverage for the single-file scenario, because existing Cypress coverage only asserted the MP4 blob naming behavior for batch entries.

## External Facts

- MDN documents `Blob.type` as the MIME type of the data in the blob: https://developer.mozilla.org/en-US/docs/Web/API/Blob/type
- MDN documents `MediaRecorder.mimeType` as the MIME type selected for recording: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType

These APIs support deriving download extensions from the rendered blob type before falling back to UI metadata.

## Fix

- Add Cypress regression coverage for a single converted MP4 blob whose stale format metadata is `webm`.
- Assert that the recording list, download filename, and absence of `.webm` all match the actual rendered MP4 blob type.

## Regression Coverage

- `cypress/e2e/batch-visualization.cy.js` now includes `names a single MP4 visualization from the actual rendered blob type`.
- Existing coverage still checks the same MP4 blob naming behavior for multiple batch recordings.

## Local Verification

- `npm ci`
- `npm test -- --runInBand`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e -- --spec cypress/e2e/batch-visualization.cy.js`

Verification logs are saved in `logs/npm-test.log`, `logs/npm-typecheck.log`, `logs/npm-build.log`, `logs/cypress-batch-visualization.log`, and `logs/http-server.log`.
