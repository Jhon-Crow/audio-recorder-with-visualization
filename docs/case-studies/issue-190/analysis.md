# Issue 190 Case Study: Saved Item Visualization Thumbnails

## Request

Saved preset and pipeline sidebar buttons should show a very small square-cropped screenshot of the visualization as the button background, with the saved item name rendered on top in a readable contrasting style.

## Local Findings

- Presets are stored in `localStorage` under `audio-recorder-presets` from `examples/app-core.js`.
- Pipelines are stored in `localStorage` under `audio-recorder-pipelines` from `examples/pipeline.js`.
- Both saved item sidebars already render compact square-ish buttons, so the least disruptive path is to add an optional `thumbnail` data URL to each saved item and let older saved data continue rendering without a thumbnail.
- Pipeline stage previews already use canvas snapshots for preview images, so data URL thumbnails fit existing app patterns.

## Online/Library Notes

- The app can use the browser-native Canvas 2D API for the required crop and downsample; no additional library is necessary for a 96px square preview.
- Existing libraries such as `html2canvas` or DOM-to-image tools are useful when a whole DOM subtree must be captured, but this issue only needs the visualization canvas, making native `drawImage()` simpler and more reliable.
- For future thumbnail management at larger scale, storing object URLs or file-backed thumbnails could reduce localStorage size. For the current 96px PNG thumbnails, the storage impact is small and compatible with browser and Electron modes.

## Implemented Solution

- Capture the centered square crop of the visualization canvas when saving a preset or pipeline.
- Store the crop as `thumbnail: data:image/png;base64,...` on the saved item.
- Render saved names inside a `.saved-item-label` overlay.
- Apply the thumbnail with CSS `background-image`, dark gradient overlay, and text shadow for contrast.
- Preserve backward compatibility: saved items without `thumbnail` still render as regular buttons.

## Verification Plan

- Cypress preset test verifies newly saved presets persist a PNG thumbnail.
- Cypress preset test verifies existing thumbnail-backed presets render the background and overlay label.
- Cypress pipeline test verifies existing thumbnail-backed pipelines render the background and overlay label.
- Cypress pipeline test verifies newly saved pipelines persist a PNG thumbnail.
