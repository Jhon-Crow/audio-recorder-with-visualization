# Issue 179 Case Study

## Scope

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/179
Pull request: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/180

This folder preserves the issue and pull request context used to diagnose the full-album pipeline stage follow-up bugs and the later manually-added-stage regression.

## Timeline

- 2026-06-25 13:53 UTC: Initial implementation added a checkbox that rendered an album as one full-album video.
- 2026-06-25 14:38 UTC: Owner requested that full album become a dependent stage after the album stage, with its own name, description, interval, and generated timestamps.
- 2026-06-25 14:53 UTC: PR updated with a derived full-album stage model.
- 2026-06-25 15:55 UTC: Owner reported regressions: no type selector on the added stage, checkbox could not be unchecked, derived stage needed a thick solid gold border, generated timestamps ignored track durations, and typing in date/time inputs caused scroll jumps and closed the picker.
- 2026-06-25 17:19 UTC: Owner verified the latest build and reported that added full-album stages still did not show the expected stage type selector in the primary stage controls.
- 2026-06-25 17:41 UTC: Owner reported that the full-album stage still re-rendered every album track instead of joining the already-rendered album videos, and that visualization progress stayed at 0%.
- 2026-06-25 18:11 UTC: Owner reported that a stage added manually after clearing the pipeline still did not show the expected release type selector, and attached a reference screenshot showing the release editor controls that should be visible.

## Root Causes

- The derived-stage reconciliation treated the presence of an existing full-album stage as a reason to keep recreating it. That made the source checkbox impossible to turn off.
- Full-album stages used `kind: fullalbum`, while the release type editor was only rendered for `kind: release`, so the derived stage had no visible type selector.
- Timestamp generation only read ad hoc duration properties from `File` objects. Browser `File` objects do not expose audio duration, so offsets stayed at `00:00`.
- Schedule and numeric input handlers requested a full stage rerender on every `input` event. Replacing the focused DOM node explains the scroll jump and the native date/time picker closing after one edit.
- The follow-up type selector fix placed a disabled Album selector inside the nested release editor, below other stage controls. The requested control was expected in the primary stage control row near the stage title/action controls, so the latest build still appeared to have no stage type selector.
- The derived full-album execution path called the normal per-track render function for every source album file. That duplicated the visualization work that the source album stage had already performed.
- Pipeline rendering forwarded converter progress only to the status text. The existing global progress bar was available through `AudioRecorderApp.elements.progressFill`, but pipeline mode never updated it.
- The manual add-stage path still created `kind: custom` stages. Custom stages do not render the release editor, so clearing the pipeline and pressing `+` produced a stage with no `Release type`, no `YouTube cover`, no release preset, and no `Add full album stage` checkbox.
- The visualization-only action preserved YouTube metadata but left the controls editable, which made the UI imply those settings would be used even when the action did not upload to YouTube.

## Implemented Fixes

- The album checkbox now controls whether the derived full-album stage exists. Unchecking removes the dependent stage.
- The derived full-album stage shows a disabled Album release-type selector, making its type visible while preserving the required fixed behavior.
- The derived stage is styled with a thick solid gold border.
- Selected album files are loaded with browser audio metadata to calculate cumulative timestamp offsets.
- Text, date, time, and relative interval typing no longer forces whole-stage rerenders; structural changes still rerender when needed.
- Full-album stages now also show a disabled top-level `Type` selector set to `Album` before the main action selector, matching the placement of a stage type control in the primary controls.
- Source album track renders are cached during a pipeline run. The dependent full-album stage now joins those cached video blobs and fails fast if the source album render has not run first.
- Pipeline render and join progress now updates the visible global progress bar as each task advances.
- Manually added stages now use the release-stage model by default while preserving the expected generic `Stage N` name and relative schedule defaults. The release type defaults to `Album`, and the `Add full album stage` checkbox defaults off.
- The public `AudioRecorderPipeline.addStage()` helper follows the same release-stage default, so programmatic stage creation matches the UI.
- Direct upload-only stages keep stage metadata for YouTube titles instead of being treated as album track uploads when the default added stage is release-capable.
- Visualization-only stages now disable YouTube description, tags, playlists, flags, and the stage-level `YouTube` button without resetting stored values.

## Verification

- `npm run typecheck`: passed. See `typecheck-latest.log`.
- `npm run lint`: passed. See `lint-latest.log`.
- `node --check examples/pipeline.js`: passed. See `node-check-pipeline-latest.log`.
- `npm test -- --runInBand`: passed, 342 tests. See `unit-tests-latest.log`.
- `npm run build`: passed with the existing Rollup warnings about package module type and `declarationDir`. See `build-latest.log`.
- `npm run test:e2e -- --spec cypress/e2e/pipeline-mode.cy.js --config video=false`: 25 passing, 2 failing. The new added-stage release-type regression passes, the visualization-only disable regression passes, and the remaining failures are the previously observed stage navigator active-state assertion at `cypress/e2e/pipeline-mode.cy.js:256` and relative publish-date assertion at `cypress/e2e/pipeline-mode.cy.js:396`. See `cypress-pipeline-latest.log`.
- Before the manual add-stage fix, `cypress-repro-release-type.log` showed the new regression test failing because no `Release type` label existed in the stage added after `Clear` + `+`.
- `after-release-type-added-stage.png` captures the fixed browser state after `Clear` + `+`: one `Stage 1` release-capable stage with `Release type` set to `Album` and the full-album checkbox unchecked.

## External References

- MDN documents that the HTML `disabled` attribute makes form controls non-mutable and non-focusable. That supports disabling YouTube controls for visualization-only stages while preserving the saved JavaScript state for later upload actions: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled
- MDN documents that media duration and dimensions are known after `loadedmetadata`, which supports the earlier track-duration metadata path used to generate full-album timestamps: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event

## Preserved Data

- `issue.json`: issue metadata and embedded comments.
- `issue-comments.json`: issue comments from the issues API.
- `pr-180.json`: pull request metadata, comments, reviews, and commits.
- `pr-conversation-comments.json`: PR conversation comments from the issues API.
- `pr-review-comments.json`: PR inline review comments.
- `pr-reviews.json`: PR review records from the pulls API.
- `npm-ci-latest.log`: local dependency setup log for the latest investigation.
- `typecheck-latest.log`, `lint-latest.log`, `node-check-pipeline-latest.log`, `unit-tests-latest.log`, `build-latest.log`: local verification logs.
- `cypress-repro-release-type.log`: failing Cypress reproduction before the latest manual add-stage fix.
- `cypress-pipeline-latest.log`: final local Cypress pipeline run after the latest fix.
- `playwright-console-latest.log`: browser console output from the manual visual check. It only records the unrelated missing `favicon.ico`.
- `reviewer-screenshot.png`: screenshot attached to the owner feedback. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a` because the `file` utility was unavailable in the environment.
- `reviewer-screenshot-type-select-missing.png`: screenshot attached to the 2026-06-25 17:19 UTC owner feedback. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a` because the `file` and `xxd` utilities were unavailable in the environment.
- `reviewer-screenshot-progress.png`: screenshot attached to the 2026-06-25 17:41 UTC owner feedback showing the progress stuck at 0%. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a` because the `file` utility was unavailable in the environment.
- `reviewer-screenshot-added-stage-missing-release-type.png`: screenshot attached to the 2026-06-25 18:11 UTC owner feedback showing a manually added `Stage 1` without release controls.
- `reviewer-screenshot-release-type-reference.png`: reference screenshot attached to the 2026-06-25 18:11 UTC owner feedback showing the expected release editor controls.
- `after-release-type-added-stage.png`: Playwright screenshot of the fixed manually added stage. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a`.
