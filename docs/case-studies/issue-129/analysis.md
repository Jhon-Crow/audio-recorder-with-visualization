# Issue 129 Case Study: Batch MP4 Rendering Falls Back After First Track

## Summary

Issue #129 reported that batch audio-to-video conversion rendered the first selected track as MP4, while later tracks were rendered as WebM even though MP4 remained selected.

The failure was traced to the batch conversion UI reading the output format from the live select element inside the per-file loop. When the first MP4 conversion path updated UI state or fallback-related state, later iterations could observe a changed value and pass WebM to `convertWithFallback`.

## Timeline

- Issue #129 was opened on 2026-06-06, referencing PR #108 and the batch MP4/WebM mismatch.
- PR #108 had introduced batch visualization behavior and related MP4 naming changes.
- The current fix keeps the requested output format stable for the whole batch and derives displayed filenames from the actual rendered blob type.

## Root Cause

The batch conversion handler did not treat the selected output format as immutable batch input. It read `el.videoFormat.value` during conversion setup for each rendered file. For MP4, conversion support checks and fallback handling can interact with state around the format control, which allowed later files to be converted with a different format from the one selected when the batch started.

There was also a related review risk in filename generation: UI labels and download names should reflect the actual `Blob.type`, because browser encoder behavior can legitimately return a format different from the originally requested one.

## Fix

- Capture `const requestedFormat = el.videoFormat.value;` once before the batch loop.
- Pass `format: requestedFormat` to every `convertWithFallback` call in the loop.
- Build recording filenames from the rendered blob MIME type first, falling back to the conversion result format.

## Regression Coverage

- `cypress/e2e/batch-visualization.cy.js` verifies MP4 blob filenames for every batch recording.
- The same spec verifies the batch conversion source captures `requestedFormat` once and passes it to all conversions.
- Existing unit tests cover conversion fallback behavior in `AudioToVideoConverter`.

## Local Verification

- `npm test -- --runInBand`
- `npm run typecheck`
- `npm run build`

The targeted Cypress spec requires the configured `http://localhost:8080` test server. In this workspace, local static server processes exited immediately without binding a port, so the browser regression could not be executed locally after the non-browser checks passed.
