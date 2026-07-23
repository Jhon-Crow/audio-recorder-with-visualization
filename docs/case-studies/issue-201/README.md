# Issue 201: pipeline inputs stop accepting typed text and numbers

## Report

The reporter could select a saved pipeline name or a new stage name, but typing did not change it. The same symptom affected typing numbers into publication date/time controls. Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/201

## Evidence archive

The `data/` directory contains authenticated snapshots collected on 2026-07-23 UTC:

- the issue and its complete comments response;
- PR 202 metadata, conversation comments, inline review comments, and reviews;
- related merged PR metadata;
- branch history and the initial CI run list.

There were no issue comments and no PR comments/reviews when the investigation began. PR 202 contained only its bootstrap commit.

## Reconstructed timeline

| UTC date | Event |
| --- | --- |
| 2026-06-06 | Pipeline mode introduced stage inputs whose `input` handlers call `updateStage()`. |
| 2026-06-07 | The stage navigator was added and `updateStage()` began rebuilding it during ordinary edits. |
| 2026-06-26 08:58 | Commit `238e9cf` deferred focus/selection for the saved-pipeline rename dialog and added browser regression coverage. |
| 2026-06-26 12:32 | Related PR 189 merged that focus-only fix. Its description records that the new browser rename test passed while unrelated pipeline tests remained flaky. |
| 2026-07-23 01:06 | PR 202 and branch `issue-201-48257b769477` were created for this report. |
| 2026-07-23 | This investigation reproduced a stronger invariant failure: after a stage-name input event, the navigator button that opened editing had `isConnected === false`. |

## Root cause

`updateStage()` persisted every keystroke and then called `renderStageNav()`. That renderer starts with `stageNav.innerHTML = ''`, discarding every navigator button and creating replacements. The stage name input itself was not rebuilt, so ordinary Cypress `.type()` calls could still pass. However, the Electron interaction began from the navigator's context menu. Replacing that originating node during the first input event made subsequent native keyboard dispatch unreliable. Date and time number controls caused the same replacement on every typed value.

This explains why the earlier focus-only fix was incomplete: it ensured the destination input was focused after the modal became visible, but did not preserve the DOM identity of controls involved in the ongoing edit.

The regression test retains the original navigator button and the relative-date input and asserts both remain connected after typing. Before the fix, the navigator assertion failed with `expected false to be true`.

## External research

- MDN defines `Node.isConnected` as whether a node remains connected to its document. This is the exact invariant used by the regression test: https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected
- MDN states that the `input` event fires for every user-caused value change, unlike `change`, which fires when the value is committed. Rebuilding neighboring UI on every `input` therefore happens mid-edit: https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event
- MDN states that key events target the currently focused element. Removing/replacing nodes involved in the editing path risks losing a valid keyboard target: https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
- Electron documents that `before-input-event` occurs before renderer `keydown`/`keyup` dispatch, confirming that desktop input crosses the Electron/renderer boundary and depends on a stable page target: https://www.electronjs.org/docs/latest/api/web-contents/#event-before-input-event

## Options considered

1. Defer focus again. This cannot fix date/time inputs and does not prevent nodes from being replaced after the first keystroke.
2. Render only on `change`. This would preserve controls while typing, but delay navigator titles, validation, persistence feedback, and scheduling updates.
3. Preserve navigator DOM identity during non-structural updates. This keeps live feedback and storage behavior while changing only text, metadata, and preview data in existing buttons. A full render remains the fallback when stage count/order changes. This is the implemented option.
4. Move all state rendering to a component framework. That could provide keyed reconciliation, but is disproportionate for this native-DOM example application.

## Implementation

`updateStage()` now calls `updateStageNav()` for ordinary input changes. The updater verifies that existing buttons still match the stage count and IDs, updates their accessible label/title/action/date/preview in place, and falls back to `renderStageNav()` for structural differences. Changes that already require a full stage render retain the existing behavior.

## Verification

- A Cypress regression covers stage rename and numeric relative-date typing through the real pipeline UI and verifies the relevant nodes stay connected.
- Before fix: the new assertion failed because the navigator button was detached.
- After fix: the new regression passed in the full pipeline spec.
- Three unrelated existing failures remained in the full spec (persisted file hydration, navigator active observer timing, and a relative-date fixture expectation); the same failures were present before the fix and are documented in prior PR descriptions.
