# Issue 109: Preset Rename and Active Preset State

## Request

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/109

The issue report says that pressing Rename for a preset does nothing. Follow-up feedback on PR 110 adds two requirements:

- Rename still does not work in the reviewed app.
- The currently loaded preset should be highlighted while no settings have changed after loading it.
- Related issue and PR data should be preserved in `docs/case-studies/issue-109` and analyzed as a case study.

## Collected Data

- Issue metadata: `raw/issue-109.json`
- Issue comments: `raw/issue-109-comments.json`
- PR metadata: `raw/pr-110.json`
- PR conversation comments: `raw/pr-110-conversation-comments.json`
- PR review comments: `raw/pr-110-review-comments.json`
- PR reviews: `raw/pr-110-reviews.json`
- PR diff before this follow-up: `raw/pr-110.diff`
- Upstream CI run metadata: `raw/ci-runs-upstream.json`
- Fork CI run metadata: `raw/ci-runs-fork.json`
- Upstream CI logs: `ci-logs/build-portable-exe-26964899103.log`, `ci-logs/build-portable-exe-26965159932.log`, `ci-logs/build-portable-exe-26965210554.log`
- Prior solution draft log from the linked Gist: `raw/solution-draft-log-pr-1780590638241.txt`
- Local install/build/test logs: `raw/npm-install.log`, `raw/npm-build-before-fix.log`, `raw/cypress-preset-before-fix.log`, `raw/cypress-preset-after-fix.log`, `raw/cypress-preset-after-fix-2.log`, `raw/cypress-background-size-after-helper-fix.log`, `raw/npm-test-final.log`, `raw/npm-typecheck-final.log`, `raw/npm-lint-final.log`, `raw/npm-build-final.log`, `raw/npm-test-e2e-final.log`, `raw/npm-test-post-merge.log`, `raw/npm-typecheck-post-merge.log`, `raw/npm-lint-post-merge.log`, `raw/npm-build-post-merge.log`, `raw/npm-test-e2e-post-merge.log`
- Screenshots: `screenshots/before-context-menu.png`, `screenshots/after-rename-modal.png`, `screenshots/after-active-preset.png`

## Timeline

- 2026-06-04T16:00:49Z: Issue 109 opened with the report that clicking Rename does nothing.
- 2026-06-04T16:23:57Z: PR branch commit `9a69b30` created with task details.
- 2026-06-04T16:28:53Z: Commit `835dcdb` attempted to fix the custom context menu by stopping Rename/Delete click propagation.
- 2026-06-04T16:29:54Z: Commit `4ce583a` removed the placeholder file.
- 2026-06-04T16:30:05Z: CI run `26965210554` started for `4ce583a` and later passed.
- 2026-06-04T16:35:12Z: Automation reported the PR ready to merge.
- 2026-06-04T17:19:37Z: Repository owner reported that rename still does not work, mentioned possible z-index/clipping symptoms, and requested active-preset highlighting plus the case study.
- 2026-06-04T20:01:18Z: A new AI work session started and PR 110 was returned to draft mode.
- 2026-06-04T20:37:01Z: The branch was merged with the latest `upstream/main` after issue 111 landed, then local checks were rerun on the merged branch.

## Reproduction

The previous Cypress coverage stubbed `window.prompt()` and therefore only proved that the rename callback path could persist a new name when a prompt response was supplied. It did not prove that the real application could display and complete the prompt in the target environment.

I updated `cypress/e2e/preset-management.cy.js` before implementing the fix:

- Rename must open `#presetRenameModal`.
- The modal input must start with the current preset name.
- Confirming the modal must update the preset button and `audio-recorder-presets`.
- A loaded preset button must get `.is-active` and `aria-current="true"`.
- Changing a setting after loading must remove the active state.

The pre-fix run failed with the expected symptoms in `raw/cypress-preset-before-fix.log`:

- `#presetRenameModal` did not exist.
- The loaded preset button never received `.is-active`.

## External Research

- Electron issue 472 documents that `window.prompt()` is not supported and was closed as wontfix: https://github.com/electron/electron/issues/472
- MDN documents `window.prompt()` as a browser dialog API and notes that browsers may not display or wait for it under some conditions: https://developer.mozilla.org/docs/Web/API/Window/prompt
- MDN's stacking context documentation explains why z-index values are scoped within stacking contexts: https://developer.mozilla.org/en-US/docs/Understanding_CSS_z-index/The_stacking_context
- MDN's overflow documentation confirms that non-visible overflow can clip content outside the element box: https://developer.mozilla.org/en-US/docs/Web/CSS/overflow

## Root Cause

There were two separate problems.

The first draft fixed one real bug: clicking the Rename button allowed the click to bubble to the document handler, which hid the context menu and cleared `activePresetMenuId`. That made the rename action run without a preset id.

The remaining rename problem was the use of `window.prompt()` for the actual rename UI. Chromium browser testing can pass because a prompt can be shown or stubbed, but this project also ships an Electron app. Electron does not support `window.prompt()`, so a packaged-app user can click Rename and see no usable input flow. That matches the owner feedback that "rename still does not work" after the event propagation fix.

The z-index/clipping suspicion was plausible for tooltips in other parts of the UI, but the preset context menu is already a fixed-position root-level sibling and Playwright confirmed its Rename button was the top element at the click point in the browser reproduction. The prompt dependency was the higher-confidence root cause for Rename.

The second problem was missing state. Preset buttons were rendered as plain load buttons, with no record of which preset had last been loaded and no comparison against current settings. Therefore the UI could not indicate "this preset is active and still clean."

## Solution Options

1. Keep `window.prompt()` and add more event handling.
   - This would not address the Electron limitation and would leave the real user workflow unreliable.

2. Add Electron IPC for a native rename dialog.
   - This would solve desktop rename only, but browser mode would still need separate logic and it would be heavier than the current static app architecture.

3. Add an in-app rename modal.
   - Works in browser and Electron.
   - Matches existing save/settings modal styling.
   - Gives Cypress a real DOM workflow to test.

4. Track active state only by last clicked preset id.
   - Simple, but it would stay highlighted after settings changed, which conflicts with the requirement.

5. Track active state by loaded preset id plus normalized settings equality.
   - Correctly clears the highlight after a settings change.
   - Reuses the existing `saveSettings()` path so all current controls update the active state without new per-control listeners.

## Implemented Approach

Implemented options 3 and 5.

- Added `#presetRenameModal` with a text input, Cancel, and Rename buttons.
- Replaced `window.prompt()` with `openPresetRenameDialog()`, `confirmPresetRename()`, and `closePresetRenameDialog()`.
- Kept rename persistence in the existing `presets` array and `audio-recorder-presets` localStorage key.
- Kept the preset sidebar open after rename/delete so repeated preset management actions remain possible.
- Added `activeLoadedPresetId` and normalized settings comparison helpers.
- Added `.is-active` and `aria-current="true"` to the active preset button only when the currently loaded preset still matches `getCurrentSettings()`.
- Called `updateActivePresetIndicator()` from `saveSettings()`, so settings changes made through existing controls clear the active marker.
- Explicitly reset in-memory background/center image URLs during `applySettings()` to prevent stale image state from making a freshly loaded preset look dirty.
- Updated Cypress background-image helpers to use the app's supported `window.AudioRecorderApp` surface instead of legacy globals such as `window.recorder`, so the full e2e suite verifies the current app contract.

## Verification

Before fix:

- `npx cypress run --spec cypress/e2e/preset-management.cy.js` failed with the expected missing modal and missing active marker assertions. See `raw/cypress-preset-before-fix.log`.

After fix:

- `npx cypress run --spec cypress/e2e/preset-management.cy.js` passed with 4 tests. See `raw/cypress-preset-after-fix-2.log`.
- `npx cypress run --spec cypress/e2e/background-size-preservation.cy.js` passed with 6 tests after aligning helpers with `window.AudioRecorderApp`. See `raw/cypress-background-size-after-helper-fix.log`.
- `npm test` passed with 324 tests. See `raw/npm-test-final.log`.
- `npm run typecheck` passed. See `raw/npm-typecheck-final.log`.
- `npm run lint` passed. See `raw/npm-lint-final.log`.
- `npm run build` passed. See `raw/npm-build-final.log`.
- `npm run test:e2e` passed with 20 tests. See `raw/npm-test-e2e-final.log`.
- After merging the latest `upstream/main`, `npm test` passed with 324 tests. See `raw/npm-test-post-merge.log`.
- After merging the latest `upstream/main`, `npm run typecheck`, `npm run lint`, and `npm run build` passed. See `raw/npm-typecheck-post-merge.log`, `raw/npm-lint-post-merge.log`, and `raw/npm-build-post-merge.log`.
- After merging the latest `upstream/main`, `npm run test:e2e` passed with 21 tests, including the new issue 111 e2e spec. See `raw/npm-test-e2e-post-merge.log`.
- Playwright screenshot evidence was captured for the replacement rename modal and active preset highlight.

## Remaining Notes

The owner mentioned tooltip clipping. This change does not attempt a global tooltip stacking/overflow redesign because the confirmed Rename root cause is independent of tooltip clipping. If tooltip clipping remains a visible problem, it should be handled as a separate UI layering issue, likely by moving tooltip rendering out of clipped sections or adjusting the containers that establish clipping and stacking boundaries.
