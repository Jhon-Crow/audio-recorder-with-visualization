# Issue 105: Preset Saving

## Request

The issue asks for saving the full visualization state as presets: visualizer selection, colors, background image data, video settings, presentation settings, and other UI controls. It also asks for a left sidebar with a save button, one load button per saved preset, sidebar-only scrolling when there are many presets, a settings button at the bottom, default numeric preset names, a first-save modal with folder selection, a custom preset name field, and a "don't show again" option.

## Repository Findings

- `examples/app-core.js` already has `getCurrentSettings()` and `applySettings(settings)`, which cover the existing UI state, including background and center images stored as data URLs.
- The app already persists general settings in `localStorage` under `audio-recorder-settings`.
- Electron-specific file-system work is already routed through `electron/preload.js` and `electron/main.js`, so preset folder picking and JSON export can follow that pattern without enabling Node integration in the renderer.
- Browser mode cannot reliably write arbitrary folders across all target browsers. MDN documents `localStorage` as origin-scoped Web Storage, while `showDirectoryPicker()` is a separate File System Access API with compatibility caveats.

## External References

- Electron `dialog.showOpenDialog()` supports directory selection through properties such as `openDirectory` and `createDirectory`: https://www.electronjs.org/docs/latest/api/dialog
- MDN Web Storage API describes `localStorage` as browser-managed origin storage: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN notes that `Window.showDirectoryPicker()` requires browser compatibility review before production use: https://developer.mozilla.org/docs/web/api/window/showdirectorypicker

## Solution Options

1. Use `localStorage` only.
   - Fast and works in the current browser example.
   - Does not satisfy the explicit folder-save requirement in Electron.

2. Use Electron IPC for folder selection and JSON file export.
   - Matches existing architecture and satisfies the desktop app requirement.
   - Keeps browser mode usable by falling back to localStorage.

3. Add a third-party persistence library.
   - Libraries such as localForage can help with larger browser storage, but the app already stores complete settings as serializable JSON and Electron already provides trusted disk access.

## Implemented Direction

The implementation combines options 1 and 2:

- Presets are stored in `localStorage` under `audio-recorder-presets` so buttons survive reloads.
- Electron users can choose a preset folder and each save exports a `{name, createdAt, settings}` JSON file.
- The first save opens a modal with default numeric name, folder display, folder chooser, and "Don't show again".
- Skip-dialog mode saves subsequent presets immediately with numeric names.
- Loading a preset calls `applySettings()`, persists the loaded settings, updates recorder visualizer options and audio enhancement options, refreshes video dimensions, and redraws the preview.

## Verification

- Added Cypress coverage in `cypress/e2e/preset-management.cy.js` for save modal behavior, numbered presets, load buttons, localStorage persistence, and skip-dialog flow.
