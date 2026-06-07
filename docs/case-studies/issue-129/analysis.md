# Issue 129 Case Study: Batch MP4 Rendering Falls Back After First Track

## Summary

Issue #129 reports that when MP4 is selected for batch audio-to-video rendering, the first track can render as MP4 while later tracks render as WebM.

The latest PR #130 owner comment narrowed the failure to the MP4 encoder preflight in `AudioToVideoConverter.convertWithFallback`. The first full-resolution MP4 probe and conversion succeeded, but the next full-resolution MP4 probe returned false and the application fell back to WebM before attempting the real second conversion.

## Evidence Collected

- Issue data: `logs/issue-129.json`
- Issue comments: `logs/issue-129-comments.json`
- Related PR #108 data and comments: `logs/pr-108*.json`
- Current PR #130 data and comments: `logs/pr-130*.json`
- Prior solution draft log from the PR comment gist: `logs/solution-draft-log-pr-1780778187772.txt`
- Current branch CI run list: `logs/ci-runs.json`
- Owner-provided screenshots:

![Fallback status banner](assets/pr-130-comment-4640736885-fallback-status.png)

![First MP4 recording card](assets/pr-130-comment-4640736885-mp4-recording-card.png)

## Timeline

- 2026-06-06 20:28 UTC: PR #108 was merged with batch conversion support and initial MP4 naming/format consistency work.
- 2026-06-06 20:30 UTC: Issue #129 was opened, reporting that only the first batch track rendered as MP4.
- 2026-06-06 20:31 UTC: PR #130 was opened for issue #129.
- 2026-06-06 23:10 UTC: The owner added PR #130 evidence showing one MP4 output followed by WebM fallbacks from repeated MP4 encoder checks.
- 2026-06-07 UTC: The fix was updated to cache successful MP4 encoder support by target resolution and add a runtime WebM fallback if MP4 recording still fails.

## Reconstructed Failure Sequence

From the owner-provided console log in PR #130:

1. The converter tested MP4 support at `608 x 1080`.
2. The first audio file was `1.393175` seconds long.
3. `VideoRecorder` started with `video/mp4;codecs=avc1.42E01E,mp4a.40.2`.
4. The first MP4 blob completed at `321140` bytes.
5. The converter tested MP4 support again at the same `608 x 1080`.
6. The second probe logged `MP4 encoder not available at target resolution, falling back to WebM`.
7. The second and third files then started with `video/webm;codecs=vp9,opus` and completed as WebM blobs.

This sequence shows that the selected UI format stayed MP4, and that the mixed output was caused by a repeated preflight false negative after one successful MP4 conversion.

## Root Cause

`convertWithFallback` ran `VideoRecorder.testEncoderSupport('mp4', 2000, width, height)` before every MP4 conversion. That test creates a separate full-resolution canvas recording to prove that MP4 works.

On the reported Electron/Chromium runtime, the first MP4 support test and real MP4 recording succeeded. A later identical support test returned false, likely because encoder availability is transient while the previous MediaRecorder/encoder resources are being released. The code treated that false preflight result as definitive and immediately rendered the later batch entries as WebM.

The risky behavior was not just batch format selection. The deeper bug was trusting every repeated MP4 probe over the stronger evidence that MP4 had already succeeded at the same target resolution in the same converter session.

## External Facts

- MDN documents that `MediaRecorder.isTypeSupported()` means the user agent should be able to record a MIME type, but recording may still fail when resources are insufficient: https://developer.mozilla.org/docs/Web/API/MediaRecorder/isTypeSupported_static
- MDN documents `MediaRecorder.mimeType` as the selected recording container/codec MIME type, which is why rendered filenames should continue to prefer the actual `Blob.type`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType

These API behaviors support treating encoder probes as advisory and preserving a runtime fallback path.

## Fix

- Cache successful MP4 encoder support by format and target resolution inside `AudioToVideoConverter`.
- Skip later MP4 support probes for the same resolution once a probe or real MP4 conversion has succeeded.
- If an actual MP4 conversion throws an encoder/MediaRecorder support error, clear the positive support result and rerun the conversion as WebM.
- Keep the existing filename behavior that derives the extension from the rendered blob MIME type before falling back to reported format metadata.

## Regression Coverage

- `tests/AudioToVideoConverter.test.ts` now verifies that after MP4 support succeeds at `608 x 1080`, a later batch item for the same resolution still converts as MP4 even if a second probe would have returned false.
- The same test file verifies that a real MP4 recording error falls back to WebM.
- Existing Cypress coverage still checks batch source-format capture and rendered MP4 filename handling in `cypress/e2e/batch-visualization.cy.js`.

## Local Verification

- `npm test -- --runInBand tests/AudioToVideoConverter.test.ts`
- `npm test -- --runInBand`
- `npm run typecheck`
- `npm run build`
- `npx cypress run --spec cypress/e2e/batch-visualization.cy.js --config baseUrl=http://127.0.0.1:8080`

The command outputs are saved in `logs/npm-test-audio-to-video-converter.log`, `logs/npm-test-full.log`, `logs/npm-typecheck.log`, `logs/npm-build.log`, and `logs/cypress-batch-visualization.log`.
