# Case Study: Issue #159 — Fix Text Inputs in Preset Sidebar

**Issue:** https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/159  
**PR:** https://github.com/konard/Jhon-Crow-audio-recorder-with-visualization/pull/160  
**Branch:** `issue-159-e3c32bd2d4b0`

---

## Problem Statement

Two bugs were reported for preset management in the sidebar:

1. **Rename input unresponsive** — When renaming a preset, the input field opened but typing was often impossible. The user could select text with the mouse but keyboard input did not register.

2. **Delete confirmation unreliable** — Preset deletion used `window.confirm()`, which may silently return `false` in Electron 33 with `contextIsolation: true`, making deletion impossible in the Electron app.

---

## Investigation

### Architecture

The preset sidebar is a CSS-animated `<aside>` (z-index 250) that slides in from the left on hover. The context menu (z-index 550) sits outside the sidebar in the DOM. Modals (z-index 500) are also outside the sidebar.

Key elements:
- `#presetSidebar` — slide-in sidebar, `pointer-events: none` when closed
- `#presetContextMenu` — right-click menu outside sidebar DOM
- `#presetRenameModal` — rename dialog, outside sidebar
- Sidebar open/close controlled by `scheduleClosePresetSidebar()` with 180ms debounce

### Root Cause 1: Focus race condition in rename input

`openPresetRenameDialog()` called `focus()` and `select()` synchronously right after `openModal()`, which only adds the CSS `active` class. Browsers may not have committed the layout change (switching `display: none` → `display: flex`) before `focus()` runs. On some frame timings this caused focus to be silently dropped.

```js
// Before fix — focus called synchronously after display change
openModal(presetRenameModal);
presetRenameInput.focus();   // ← may fire before display:flex is rendered
presetRenameInput.select();
```

**Fix:** Deferred `focus()` and `select()` with `requestAnimationFrame()` to ensure the browser has completed a paint cycle after the modal becomes visible.

### Root Cause 2: Sidebar close timer firing during modal interaction

`scheduleClosePresetSidebar()` fired 180ms after context menu was hidden (which happened when Rename was clicked). The timer only checked `:hover` state and whether the context menu was open — it did not check whether a modal was open. This meant the sidebar would close while the rename modal was active.

While the modal is outside the sidebar (so closing the sidebar doesn't steal focus from the input), the sequence of DOM events could create edge cases where the focus shift coincided with sidebar close and CSS transitions.

**Fix:** Added modal open-state checks to the close guard.

### Root Cause 3: `window.confirm` in Electron

`deletePreset()` used `window.confirm()` for the confirmation dialog. In Electron 33 with `contextIsolation: true`, `window.confirm` is not guaranteed to work and may silently return `false`, making preset deletion impossible in the packaged app. Even in the browser, it blocks the JS thread and produces a jarring native OS dialog.

**Fix:** Replaced `window.confirm` with a custom HTML confirmation modal (`#presetDeleteModal`) consistent with the rest of the UI.

---

## Changes Made

### `examples/index.html`
- Added `#presetDeleteModal` HTML structure with message paragraph, Cancel, and Delete buttons

### `examples/styles.css`
- Added `.modal-message` style for the delete confirmation text

### `examples/app-core.js`
- Added DOM references: `presetDeleteModal`, `presetDeleteMessage`, `presetCancelDeleteBtn`, `presetConfirmDeleteBtn`
- Added state variable: `let presetDeleteTargetId = null`
- Replaced `deletePreset()` (with `window.confirm`) with `openPresetDeleteDialog()`, `closePresetDeleteDialog()`, and `confirmPresetDelete()`
- Updated `presetDeleteBtn` click handler to call `openPresetDeleteDialog()` instead of `deletePreset()`
- Wired `presetCancelDeleteBtn` and `presetConfirmDeleteBtn` event handlers
- Added `presetDeleteModal` to Escape key handler and backdrop click handler
- Updated `scheduleClosePresetSidebar()` to also check `presetRenameModal`, `presetSaveModal`, and `presetDeleteModal` active state
- Wrapped `presetRenameInput.focus()`/`select()` in `requestAnimationFrame()`
- Wrapped `presetNameInput.focus()`/`select()` in `requestAnimationFrame()`

### `cypress/e2e/preset-management.cy.js`
- Updated existing rename/delete/reorder test: replaced `cy.stub(win, 'confirm')` with the new custom modal flow
- Added test: `rename input receives focus and accepts typing after context menu click`
- Added test: `delete confirmation uses a custom modal instead of window.confirm`

---

## Before / After Screenshots

| Rename Modal (after fix) | Delete Modal (after fix) |
|---|---|
| ![Rename modal](../../screenshots/issue-159-rename-modal-after-fix.png) | ![Delete modal](../../screenshots/issue-159-delete-modal-after-fix.png) |

---

## Test Results

All 9 Cypress tests pass after the fix, including 2 new tests that verify the specific bugs.

```
✔  preset-management.cy.js   9 passing
```
