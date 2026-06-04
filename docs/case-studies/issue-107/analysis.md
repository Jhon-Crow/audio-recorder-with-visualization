# Issue 107: Batch Visualization Mode

## Request

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/107

The app needed a batch mode for the "Audio to Video" flow:

- Allow selecting multiple audio files.
- Render each selected file into a separate video, equivalent to converting them one by one.
- Add a "Save All" button above the rendered video list.
- Preserve visualization quality and user settings.

Raw issue data is stored in `logs/issue-107.json` and `logs/issue-107-comments.json`.
PR data and review feedback are stored in `logs/pr-108.json` and `logs/pr-108-comments.json`.

## Existing Behavior

The converter already accepts a single `File` as `audioSource` and renders with the current canvas size, visualizer type, visualizer options, audio enhancement options, frame rate, and output format. The missing work was in the example UI:

- `#audioFile` only allowed one file.
- Preview and conversion read only `files[0]`.
- Conversion state and progress assumed one file.
- Rendered videos had individual download/save actions but no bulk action.

## Timeline

- Issue 107 requested multi-file visualization, one output video per input audio file, and a "Save All" control.
- PR 108 first enabled multi-file selection and sequential conversion.
- Owner feedback reported that Electron "Save All" still opened a save dialog for each track.
- The Electron save path was changed to select one destination folder and write every rendered video into that folder.
- Owner feedback then reported that when MP4 was selected, only one visualization was MP4 and the rest were WebM.

## External Notes

- MDN documents `OfflineAudioContext` for offline Web Audio rendering, but this project already uses `HTMLAudioElement`, `AudioAnalyzer`, canvas rendering, and `MediaRecorder`, so batch mode does not require replacing the rendering engine.
- Chrome's `captureStream()` documentation confirms the existing canvas/audio stream recording approach remains appropriate for creating media streams from rendered visual output.
- JSZip is commonly used to package many browser-generated files into one archive, but adding it would introduce a new dependency. The implemented browser path instead triggers sequential downloads, while Electron uses the existing native save helper for each file.
- MDN documents `MediaRecorder.isTypeSupported()` as a capability check for MIME types, but the existing project case studies for issues 91 and 93 show why this app also runs an encoder smoke test before trusting MP4 output.
- Electron documents `dialog.showOpenDialog()` with `openDirectory`, which fits batch save better than repeatedly calling `showSaveDialog()` for each rendered video.

References:

- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
- https://developer.chrome.com/blog/capture-stream/
- https://stuk.github.io/jszip/
- https://developer.mozilla.org/docs/Web/API/MediaRecorder/isTypeSupported_static
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType
- https://www.electronjs.org/docs/latest/api/dialog

## Root Cause: Mixed MP4/WebM Batch Output

The batch conversion loop read `#videoFormat.value` inside the loop for each file. That meant the selected requested format was not treated as a batch-level invariant. If conversion or surrounding UI state changed the select value while the batch was running, later files could be requested as WebM even though the user started the batch with MP4 selected.

The correct behavior is to capture the requested format once when the user clicks "Convert to Video" and pass that same requested format to every file in the batch. Individual files can still fall back to WebM through `convertWithFallback()` when MP4 encoding is genuinely unavailable, but a UI setting mutation must not silently change the requested format for later files.

## Implemented Solution

- Enabled `multiple` on the audio file input.
- Converted selected files sequentially through the existing `convertWithFallback()` path.
- Reused `getCurrentOptions()`, `getCurrentAudioEnhancement()`, selected dimensions, frame rate, and output format for every file.
- Named each video from its source audio filename with the actual output extension.
- Added a `Save All` button above recordings.
- Added a central recordings registry that stores blob, object URL, filename, and index.
- Implemented bulk save:
  - Electron: calls `window.electronAPI.saveAllVideosAndShow()` once, asks for one folder, and writes all rendered videos into that folder.
  - Browser: triggers one download per generated video.
- Captured the requested output format once per batch so every selected file receives the same requested format.

## Verification

Added Cypress coverage for:

- The audio file input accepting multiple files.
- Multi-file selection enabling conversion and preview controls.
- The `Save All` control existing and staying disabled until recordings are available.
- Electron `Save All` using one batch save request.
- MP4 selected at batch start being passed to every file even if the UI select changes mid-batch.
