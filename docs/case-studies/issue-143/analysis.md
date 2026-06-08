# Issue 143 Case Study: Pipeline Preset Selectors Stay Stale

## Scope

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/143

Pull request: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/144

Original report: pipeline stage preset selectors only show newly saved presets after restarting the app.

Follow-up report on PR 144: the latest build still showed `No saved visualization presets` in a stage-level `Preset` select. The reporter attached a screenshot saved here:

- `images/pr-comment-4644903617.png`

## Evidence Inventory

GitHub and CI data:

- `data/issue-143.json`
- `data/issue-143-comments.json`
- `data/pr-144.json`
- `data/pr-144-conversation-comments.json`
- `data/pr-144-inline-comments.json`
- `data/pr-144-reviews.json`
- `data/pr-144.diff`
- `data/ci-run-list.json`
- `data/ci-build-portable-exe-27102988943.log`
- `data/ci-build-portable-exe-27103143872.log`
- `data/ci-build-portable-exe-27122134136.log`
- `data/ci-build-portable-exe-27122342581.log`
- `data/solution-draft-log-pr-1780862246615.txt`

Local reproduction and verification data:

- `images/cypress-reproduction-before-fix.png`
- `images/playwright-after-fix-preset-select.png`
- `data/cypress-pipeline-before-new-fix.log`
- `data/cypress-pipeline-regression-before-fix.log`
- `data/cypress-pipeline-after-fix.log`
- `data/http-server-8080.log`
- `data/local-build-initial.log`
- `data/local-build-after-install.log`
- `data/npm-ci.log`
- `data/npm-typecheck-after-fix.log`
- `data/npm-test-runInBand-after-fix.log`
- `data/npm-build-after-fix.log`
- `data/npm-lint-after-fix.log`

The CI logs were also copied to `ci-logs/` as requested for preserved CI investigation material.

## Timeline

- 2026-06-07 19:49 UTC: Issue 143 opened. The report says presets in pipeline stage selects appear only after app restart.
- 2026-06-07 19:49 UTC: Branch `issue-143-702e3c2b0957` was initialized with commit `f86a760`.
- 2026-06-07 19:56 UTC: Commit `b45d813` added the first fix, refreshing visible pipeline preset selectors on `audioRecorderPresetsChanged`.
- 2026-06-07 19:56 UTC: CI run `27103143872` started for `b45d813` and passed.
- 2026-06-07 20:03 UTC: Automation commented that PR 144 was ready to merge.
- 2026-06-08 02:11 UTC: The owner reported that the latest build was still not fixed and attached the screenshot showing `No saved visualization presets`.
- 2026-06-08 06:50 UTC: A new work session started and the PR was moved back to draft.
- 2026-06-08 UTC: A new Cypress regression reproduced the remaining stale-selector path by forcing `localStorage.setItem('audio-recorder-presets', ...)` to throw while the preset remained saved in app memory.
- 2026-06-08 07:20 UTC: CI run `27122134136` failed after tests and the library build passed because `electron-builder` received a 504 while downloading Electron `33.4.11` for Windows.
- 2026-06-08 07:24 UTC: CI run `27122342581` repeated the same external Electron download failure on the retry commit.

## What The First Fix Covered

The first PR update correctly fixed the straightforward path:

1. Pipeline tab is already open.
2. There are no saved visualization presets.
3. User saves a new preset.
4. `savePresets()` persists the updated preset list to `localStorage`.
5. `audioRecorderPresetsChanged` fires.
6. `examples/pipeline.js` refreshes visible `.pipeline-preset-select` controls without re-rendering the entire stage list.

The existing Cypress test `updates pipeline preset choices immediately after saving a new preset` passed for this path.

## Remaining Failure

The remaining gap was in `examples/app-core.js`.

Before this fix, `savePresets()` dispatched `audioRecorderPresetsChanged` inside the same `try` block as `localStorage.setItem()`. If browser persistence threw, the app caught and logged the storage error, but it skipped the event dispatch:

1. `savePreset()` appended the new preset to the in-memory `presets` array.
2. `savePresets()` attempted to write the array to `localStorage`.
3. If that write failed, `audioRecorderPresetsChanged` was never dispatched.
4. `savePreset()` continued and `renderPresets()` showed the preset in the left preset sidebar.
5. Pipeline stage selects stayed stale because they were updated only by the missing event.

This matches the reporter's visual state: a stage `Preset` dropdown still says `No saved visualization presets` in a session where the preset manager can have in-memory preset state.

## External Facts Checked

- MDN documents that Web Storage can be available while `localStorage` writes still throw a legitimate `QuotaExceededError` when storage is full: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- MDN documents that `dispatchEvent()` synchronously invokes affected listeners before returning: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent

Those facts matter here because preset data can include image data URLs and become large enough for storage quota pressure, and because a successful dispatch immediately updates pipeline selectors in the same save flow.

## Fix Implemented

`savePresets()` now separates persistence from notification:

1. Try to persist `audio-recorder-presets` to `localStorage`.
2. Track whether persistence succeeded in a `persisted` flag.
3. Always dispatch `audioRecorderPresetsChanged` with `{ presets, persisted }`.

This keeps pipeline UI synchronized with the authoritative in-memory preset list even when persistence fails.

## Regression Test

Added Cypress coverage in `cypress/e2e/pipeline-mode.cy.js`:

- `updates pipeline preset choices when preset persistence fails but the in-memory preset is saved`

The test stubs `Storage.prototype.setItem` to throw only for `audio-recorder-presets`, then saves a preset while the Pipeline tab is open. Before the implementation change, the test failed because the first stage select still contained `No saved visualization presets`. After the fix, it passes and the select contains the in-memory preset.

## Verification

Local checks after the fix:

- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run build`
- `npm run lint`
- `CYPRESS_baseUrl=http://localhost:8080 npx cypress run --spec cypress/e2e/pipeline-mode.cy.js --config video=false`

After merging upstream `main`, the focused Cypress run reports 22 passing tests.

Browser verification also confirmed the first pipeline stage `Preset` select contained `Pipeline Memory Preset` after `localStorage` preset persistence was forced to fail. The focused screenshot is saved at `images/playwright-after-fix-preset-select.png`.

## CI Hardening

The application checks passed in the failed CI runs. In run `27122342581`, Jest reported 341 passing tests before the portable build step failed. The failing line was the Electron runtime download:

- `cannot resolve https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip: status code 504`

The portable build workflow now caches Electron runtime downloads and passes the already installed `node_modules/electron/dist` runtime to `electron-builder` with `-c.electronDist=...`. That avoids a second Electron runtime download in the packaging step. The packaging command is also retried up to three times for remaining transient packaging failures.

Local workflow-change validation:

- `npx electron-builder --linux dir -c.electronDist=node_modules/electron/dist --publish never`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`

## Proposed Follow-ups

- Add user-visible feedback when preset persistence fails, because the current app can continue with in-memory state while a restart may lose presets that were not also saved to a folder.
- Consider moving large preset assets, especially image data URLs, out of `localStorage` and into the Electron preset folder or a larger browser storage API.
- Keep the event-based pipeline refresh behavior, because it preserves in-progress stage edits while updating only the preset option lists.
