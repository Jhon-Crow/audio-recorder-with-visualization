# Issue 105: Preset Saving

## Request

The issue asks for saving the full visualization state as presets: visualizer selection, colors, background image data, video settings, presentation settings, and other UI controls. It also asks for a left sidebar with a save button, one load button per saved preset, sidebar-only scrolling when there are many presets, a settings button at the bottom, default numeric preset names, a first-save modal with folder selection, a custom preset name field, and a "don't show again" option.

Owner follow-up on PR 106 adds three interaction requirements:

- The sidebar should appear only when the user moves the cursor to the left edge of the screen, and it must not conflict with section sliders.
- Right-clicking a preset button should open a context menu with delete and rename actions.
- Presets should be reorderable with drag and drop without breaking normal click-to-load behavior.

## Repository Findings

- `examples/app-core.js` already has `getCurrentSettings()` and `applySettings(settings)`, which cover the existing UI state, including background and center images stored as data URLs.
- The app already persists general settings in `localStorage` under `audio-recorder-settings`.
- Electron-specific file-system work is already routed through `electron/preload.js` and `electron/main.js`, so preset folder picking and JSON export can follow that pattern without enabling Node integration in the renderer.
- Browser mode cannot reliably write arbitrary folders across all target browsers. MDN documents `localStorage` as origin-scoped Web Storage, while `showDirectoryPicker()` is a separate File System Access API with compatibility caveats.
- The preset sidebar is currently standalone static HTML/CSS/JS in `examples/index.html`, `examples/styles.css`, and `examples/app-core.js`, so lightweight DOM event handlers are consistent with the existing app style.
- Presets are already an ordered array in `localStorage`; reordering can persist by moving array items and saving the same key rather than introducing a new schema.

## External References

- Electron `dialog.showOpenDialog()` supports directory selection through properties such as `openDirectory` and `createDirectory`: https://www.electronjs.org/docs/latest/api/dialog
- MDN Web Storage API describes `localStorage` as browser-managed origin storage: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN notes that `Window.showDirectoryPicker()` requires browser compatibility review before production use: https://developer.mozilla.org/docs/web/api/window/showdirectorypicker
- MDN documents the `contextmenu` event as the browser event fired for right-click/context menu interactions, and custom menus can prevent the default browser menu: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
- MDN documents native HTML drag and drop events such as `dragstart`, `dragover`, and `drop`, with drop targets requiring `preventDefault()` during dragover: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations
- web.dev's sidenav pattern treats side navigation as a stateful component that should support controlled open/close behavior and remain usable across pointer and keyboard interactions: https://web.dev/patterns/components/sidenav

## Solution Options

1. Use `localStorage` only.
   - Fast and works in the current browser example.
   - Does not satisfy the explicit folder-save requirement in Electron.

2. Use Electron IPC for folder selection and JSON file export.
   - Matches existing architecture and satisfies the desktop app requirement.
   - Keeps browser mode usable by falling back to localStorage.

3. Add a third-party persistence library.
   - Libraries such as localForage can help with larger browser storage, but the app already stores complete settings as serializable JSON and Electron already provides trusted disk access.

4. Add a third-party drag/drop or menu component.
   - SortableJS, Dragula, Floating UI, or Radix-style menu primitives solve similar problems in larger component stacks.
   - This repository does not currently use a component framework for the example app, and the required interactions are small enough for native DOM events.

5. Implement native hover drawer, context menu, and drag/drop reorder.
   - Uses existing files and avoids dependency/package-lock churn.
   - Keeps normal click behavior separate from drag/drop because click remains on the button while drag state only starts after the browser drag gesture.
   - Requires focused Cypress tests because native drag/drop and context menus are easy to regress.

## Implemented Direction

The implementation combines options 1 and 2:

- Presets are stored in `localStorage` under `audio-recorder-presets` so buttons survive reloads.
- Electron users can choose a preset folder and each save exports a `{name, createdAt, settings}` JSON file.
- The first save opens a modal with default numeric name, folder display, folder chooser, and "Don't show again".
- Skip-dialog mode saves subsequent presets immediately with numeric names.
- Loading a preset calls `applySettings()`, persists the loaded settings, updates recorder visualizer options and audio enhancement options, refreshes video dimensions, and redraws the preview.
- The follow-up implementation uses a narrow left-edge trigger to reveal the sidebar, then keeps it open while hovered or focused.
- Preset right-click opens a small custom context menu with rename and delete actions backed by `prompt()` and `confirm()`.
- Preset buttons are draggable; dropping one preset on another moves the source before the target and saves the reordered preset array.

## Verification

- Added Cypress coverage in `cypress/e2e/preset-management.cy.js` for save modal behavior, numbered presets, load buttons, localStorage persistence, and skip-dialog flow.
- Extended Cypress coverage for hidden-by-default edge reveal, context-menu rename/delete, and drag/drop reorder persistence.
- Captured `sidebar-edge-reveal.png` as manual browser evidence that the sidebar opens from the left edge without being permanently visible.
