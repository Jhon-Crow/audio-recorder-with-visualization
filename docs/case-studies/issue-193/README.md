# Issue 193 Case Study

## Source Data

- Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/193
- Pull request: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/194
- Downloaded issue metadata: `issue.json`
- Downloaded issue comments: `issue-comments.json`
- Downloaded PR metadata: `pr.json`
- Downloaded PR conversation comments: `pr-comments.json`
- Downloaded PR review comments: `pr-review-comments.json`
- Downloaded PR reviews: `pr-reviews.json`
- Downloaded CI run lists: `upstream-runs.json`, `fork-runs.json`
- Downloaded latest successful upstream CI log: `build-portable-exe-28228694701.log`
- Downloaded owner screenshot: `pr-comment-4809428786-screenshot.png`
- Downloaded owner tooltip screenshot: `assets/pr-comment-4809808357-tooltip-missing-image.png`
- Follow-up verification logs: `logs/npm-test-followup-tooltip-image.log`, `logs/npm-build-followup-tooltip-image.log`, `logs/cypress-pipeline-followup-tooltip-image.log`

## Original Request

у full album должна быть та же обложка что и у базового album этапа, если не изменена в ручную.
должна отображаться в тултипе при наведении на кнопку "выбрать файл" превью

## Timeline

- 2026-06-26T08:49:58Z: issue opened by Jhon-Crow requesting full-album cover inheritance and hover preview.
- 2026-06-26T09:04:42Z: konard commented: <!-- hive-mind:working-session-summary --> ## Working session summary Implemented and pushed the fix to `issue-193-aa5c729475e8`. PR 194 is ready for review: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/194 What changed: - Full album stages now use their ow...
- 2026-06-26T09:04:50Z: konard commented: ## 🤖 Solution Draft Log This log file contains the complete execution trace of the AI solution draft process. ### 💰 **Cost estimation:** - Model: GPT-5.5 - Provider: OpenAI - Public pricing estimate: $5.252207 ### 📊 **Context and tokens usage:** - 105.2K / 200K (53%) input tok...
- 2026-06-26T09:11:22Z: konard commented: ## ✅ Ready to merge This pull request is now ready to be merged: - All CI checks have passed - No merge conflicts - No pending changes --- *Monitored by hive-mind with --auto-restart-until-mergeable flag*
- 2026-06-26T12:07:59Z: Jhon-Crow commented: всё ещё нет изменений, так же после выбора файла всё равно написано Файл не выбран <img width="675" height="183" alt="image" src="https://github.com/user-attachments/assets/349b129e-339b-4eae-899e-4ea7ed3f6d27" /> Please download all logs and data related about the issue to this ...
- 2026-06-26T12:08:56Z: konard commented: 🤖 **AI Work Session Started** Starting automated work session at 2026-06-26T12:08:54.126Z The PR has been converted to draft mode while work is in progress. _This comment marks the beginning of an AI work session. Please wait for the session to finish, and provide your feedback....
- 2026-06-26T12:59:32Z: Jhon-Crow commented that the tooltip appears but does not contain the required picture, with screenshot `assets/pr-comment-4809808357-tooltip-missing-image.png`.
- 2026-06-26T09:11:30Z: upstream workflow Build Portable EXE for 799adae completed with success.
- 2026-06-26T09:04:15Z: upstream workflow Build Portable EXE for f053a7f completed with success.
- 2026-06-26T08:51:07Z: upstream workflow Build Portable EXE for aed180b completed with success.

## Observed Problem

The first fix covered upload-time thumbnail selection and cover preview tooltips, but the full-album stage still displayed the empty file state after source album files were selected. The screenshot in PR comment 4809428786 shows the full-album row with the visible file control still reading as no file selected.

The later PR comment 4809808357 showed a second UI defect: the tooltip trigger existed, but the visible tooltip still showed the generic browser/text tooltip state rather than the selected cover image.

## Root Cause

Full-album stages are derived stages. Runtime validation and pipeline execution already resolve their source files through the base album stage, but `renderFileCell` displayed file names directly from selected files on the current stage or `stage.fileNames`. A derived full-album stage intentionally has no own selected files and no own `fileNames`, so its custom button fell back to `УКАЖИТЕ ФАЙЛ/ФАЙЛЫ` even while `getStageFiles(stage)` correctly returned the base album files.

The cover-image follow-up had a separate async preview issue. Visualization previews re-opened the floating image tooltip when rendering finished while the user was already hovering the trigger. Cover previews used the same floating tooltip but did not perform that ready-state refresh after `FileReader` finished reading the selected cover. As a result, the trigger could be present while the user saw only the normal text tooltip/fallback state.

External reference check: MDN documents that file input selection is represented through `HTMLInputElement.files`, and the input value only reflects selected file state for the input itself. Browser-controlled file input text is separate from custom application display. This app uses a custom button plus hidden file input, so the custom button must be synchronized from application state.

References:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/files

## Fix

- Added `getStageFileNames(stage)` to resolve visible file names through the source album stage when rendering a full-album stage.
- Updated the file button label, secondary file-name text, and reset disabled state to use the resolved file-name list.
- Added Cypress assertions that the full-album file button displays `track-one.mp3` and `track-two.mp3` and no longer displays `УКАЖИТЕ ФАЙЛ/ФАЙЛЫ`.
- Updated cover preview loading so the floating preview tooltip refreshes immediately if the user is already hovering/focusing the trigger when the cover image finishes loading.
- Strengthened Cypress coverage to hover the visible `YouTube cover` field and assert that `#pipelinePreviewTooltip` contains a `data:image/png` background image.

## Possible Alternatives

- Copy source album `fileNames` into the derived full-album stage. Rejected because it duplicates state and risks stale labels when the base album changes.
- Let users choose independent files for full-album stages. Rejected for this issue because full-album stages are dependent on the source album tracks.
- Keep only upload-time inheritance. Rejected because the issue is visible UI/UX state, not only upload payload behavior.

## Verification Plan

- Run focused Cypress coverage for `adds a dependent full album stage with its own schedule and generated timestamps`.
- Run unit tests and build before finalizing the PR.

## Verification Results

- `npm test -- --runInBand` passed: 9 suites, 342 tests.
- `npm run build` passed with existing Rollup warnings.
- `npx cypress run --spec cypress/e2e/pipeline-mode.cy.js` ran with 25 passing and 2 unrelated existing failures. The updated full-album cover tooltip image assertion passed. Remaining failures are the known navigator active-state assertion at `cypress/e2e/pipeline-mode.cy.js:257` and the relative publish-date assertion at `cypress/e2e/pipeline-mode.cy.js:397`.
- The latest downloaded upstream CI run before this follow-up was successful: workflow `Build Portable EXE`, run `28228694701`, commit `799adae`.
