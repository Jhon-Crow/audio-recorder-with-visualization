# Issue 190 Case Study: Saved Item Visualization Thumbnails

## Request

Saved preset and pipeline sidebar buttons should show a very small square-cropped screenshot of the visualization as the button background, with the saved item name rendered on top in a readable contrasting style.

## Follow-up Report

On 2026-06-26, the repository owner reported in PR 192 that saves were now broken and that old saves still looked unchanged. The second symptom was reproducible from the implementation: records created before issue 190 do not contain a `thumbnail` field, and the first PR intentionally rendered those records with the previous plain button style.

On 2026-06-26, the repository owner later clarified that preset saves worked, but pipeline saves did not work at all, and asked to include the changes from PR 191.

## Local Findings

- Presets are stored in `localStorage` under `audio-recorder-presets` from `examples/app-core.js`.
- Pipelines are stored in `localStorage` under `audio-recorder-pipelines` from `examples/pipeline.js`.
- Both saved item sidebars already render compact square-ish buttons, so new saves can store an optional `thumbnail` data URL without changing the saved settings or stage payload shape.
- Older saved data needs a generated visual background fallback. Keeping legacy records plain is technically backward compatible but fails the requested visual behavior because existing saved items remain unchanged.
- Pipeline stage previews already use canvas snapshots for preview images, so data URL thumbnails fit existing app patterns.
- The pipeline save regression was caused by `capturePipelineThumbnail()` reading `app.canvas` without defining `app` in `examples/pipeline.js`. Preset thumbnail capture used module-local state and did not hit this `ReferenceError`, which matches the owner report that presets worked while pipelines did not.
- PR 191 added Shift-click rename behavior for saved presets and pipelines. Its app changes overlapped with the saved-item button markup introduced for thumbnails, so both behaviors now live on the same thumbnail-backed buttons.

## Online/Library Notes

- The app can use the browser-native Canvas 2D API for the required crop and downsample; no additional library is necessary for a 96px square preview.
- Existing libraries such as `html2canvas` or DOM-to-image tools are useful when a whole DOM subtree must be captured, but this issue only needs the visualization canvas, making native `drawImage()` simpler and more reliable.
- For future thumbnail management at larger scale, storing object URLs or file-backed thumbnails could reduce localStorage size. For the current 96px PNG thumbnails, the storage impact is small and compatible with browser and Electron modes.

## Implemented Solution

- Capture the centered square crop of the visualization canvas when saving a preset or pipeline.
- Store the crop as `thumbnail: data:image/png;base64,...` on the saved item.
- Render saved names inside a `.saved-item-label` overlay.
- Apply the thumbnail with CSS `background-image`, dark gradient overlay, and text shadow for contrast.
- Preserve backward compatibility without preserving the old visual treatment: saved items without `thumbnail` render with a generated visualization-like background and the same readable label overlay.
- Fix pipeline thumbnail capture by reading `window.AudioRecorderApp` inside `capturePipelineThumbnail()` before accessing the visualization canvas.
- Make saved pipeline persistence retry without thumbnails if localStorage rejects the thumbnail payload, so the saved pipeline itself is not lost because of thumbnail storage.
- Merge PR 191 behavior so Shift-clicking saved preset and pipeline buttons opens the rename dialogs instead of loading the saved item.

## Verification Plan

- Cypress preset test verifies newly saved presets persist a PNG thumbnail.
- Cypress preset test verifies existing thumbnail-backed presets render the background and overlay label.
- Cypress preset test verifies legacy presets without thumbnails render with a generated visual background.
- Cypress pipeline test verifies existing thumbnail-backed pipelines render the background and overlay label.
- Cypress pipeline test verifies legacy pipelines without thumbnails render with a generated visual background.
- Cypress pipeline test verifies newly saved pipelines persist a PNG thumbnail.
- Cypress pipeline tests verify pipeline saving still works if thumbnail capture fails or thumbnail storage exceeds localStorage limits.
- Cypress preset and pipeline tests verify Shift-click opens the corresponding rename dialog.

## Latest Verification

- `npm run typecheck` passed after the PR 191 merge and pipeline save fix.
- `npm run build` passed after the PR 191 merge and pipeline save fix.
- `cypress/e2e/pipeline-mode.cy.js` after the app reference fix: 28 passing, 3 failing. The passing tests include the original pipeline save persistence test, newly saved pipeline thumbnail test, thumbnail capture fallback test, thumbnail storage fallback test, saved pipeline thumbnail rendering test, legacy saved pipeline generated background test, and Shift-click rename test. The remaining failures are existing broad pipeline navigator/scheduling assertions captured in `docs/case-studies/issue-190/logs/cypress-pipeline-after-app-reference-fix.log`.
