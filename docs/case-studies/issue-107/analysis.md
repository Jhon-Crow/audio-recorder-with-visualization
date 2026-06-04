# Issue 107: Batch Visualization Mode

## Request

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/107

The app needed a batch mode for the "Audio to Video" flow:

- Allow selecting multiple audio files.
- Render each selected file into a separate video, equivalent to converting them one by one.
- Add a "Save All" button above the rendered video list.
- Preserve visualization quality and user settings.

Raw issue data is stored in `logs/issue-107.json` and `logs/issue-107-comments.json`.

## Existing Behavior

The converter already accepts a single `File` as `audioSource` and renders with the current canvas size, visualizer type, visualizer options, audio enhancement options, frame rate, and output format. The missing work was in the example UI:

- `#audioFile` only allowed one file.
- Preview and conversion read only `files[0]`.
- Conversion state and progress assumed one file.
- Rendered videos had individual download/save actions but no bulk action.

## External Notes

- MDN documents `OfflineAudioContext` for offline Web Audio rendering, but this project already uses `HTMLAudioElement`, `AudioAnalyzer`, canvas rendering, and `MediaRecorder`, so batch mode does not require replacing the rendering engine.
- Chrome's `captureStream()` documentation confirms the existing canvas/audio stream recording approach remains appropriate for creating media streams from rendered visual output.
- JSZip is commonly used to package many browser-generated files into one archive, but adding it would introduce a new dependency. The implemented browser path instead triggers sequential downloads, while Electron uses the existing native save helper for each file.

References:

- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
- https://developer.chrome.com/blog/capture-stream/
- https://stuk.github.io/jszip/

## Implemented Solution

- Enabled `multiple` on the audio file input.
- Converted selected files sequentially through the existing `convertWithFallback()` path.
- Reused `getCurrentOptions()`, `getCurrentAudioEnhancement()`, selected dimensions, frame rate, and output format for every file.
- Named each video from its source audio filename with the actual output extension.
- Added a `Save All` button above recordings.
- Added a central recordings registry that stores blob, object URL, filename, and index.
- Implemented bulk save:
  - Electron: calls the existing `window.electronAPI.saveVideoAndShow()` for each rendered video.
  - Browser: triggers one download per generated video.

## Verification

Added Cypress coverage for:

- The audio file input accepting multiple files.
- Multi-file selection enabling conversion and preview controls.
- The `Save All` control existing and staying disabled until recordings are available.
