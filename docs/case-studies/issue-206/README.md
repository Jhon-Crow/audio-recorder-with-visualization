# Issue 206 case study: selective visualization actions

## Request

Issue [#206](https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/206), opened on 2026-08-13, asks for checkboxes in two output surfaces:

- the review modal shown before rendered videos are uploaded;
- the widget containing all completed visualizations.

The selected videos must be the only videos saved or uploaded. The issue has no comments or screenshots. PR 210 also had no conversation comments, inline review comments, or submitted reviews when implementation began; the downloaded API responses are stored alongside this document.

## Repository evidence and timeline

1. PR [#174](https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/174) introduced the pre-upload review checkpoint on 2026-06-23. Every review item received a preview and individual download link, but `confirmReviewedUploads()` iterated over the complete `review.items` array.
2. The completed recordings widget already supported individual save/download actions and a bulk `Save All` action. `saveAllRecordings()` always sent the complete `savedRecordings` array to Electron or iterated over the complete array in the browser.
3. Issue 206 identified the same missing selection boundary in both interfaces. There was no per-item selection state, so users could not exclude an output from either bulk action.
4. The initial PR branch commit (`1971fe8`) passed the repository's Windows GitHub Actions workflow, including 354 Jest tests, the Rollup build, and the portable Electron build. That run predates this implementation and is retained only as baseline evidence.

## Root cause

The two bulk operations treated membership in an output collection as implicit consent to act on every item. The rendered records had no `selected` state, the DOM had no selection controls, and the action handlers consumed the unfiltered arrays.

This is a data-flow problem rather than only a missing checkbox. Adding visual controls without filtering the arrays at the save/upload boundary would leave the behavior unchanged.

## Implemented design

- Each new completed recording and each pre-upload review item starts checked. This preserves the previous default behavior while making exclusions explicit.
- Unchecking an item updates its backing model and visually dims its card.
- `Save Selected` filters `savedRecordings` before calling either the Electron batch API or browser downloads.
- `Upload Selected` filters review items before invoking YouTube uploads.
- The relevant bulk action is disabled when nothing is checked, preventing an ambiguous no-op.
- Existing per-item download/save/upload controls remain available, and direct YouTube-only pipeline stages are unchanged.
- Native checkbox elements and item-specific accessible names keep the interaction keyboard- and screen-reader-friendly without adding a UI dependency.

## Alternatives considered

- A third-party multiselect component was rejected because these are short, already-rendered lists and native checkboxes provide the required semantics with no bundle or maintenance cost.
- A select-all header could be useful for very large result sets, but is not required by the issue and would introduce tri-state synchronization. Default-checked items preserve today's workflow with the smallest change.
- Keeping `Save All` while silently respecting selection was rejected because the label would contradict the operation.

## Verification

- `npm test -- --runInBand`: 10 suites and 354 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed with the existing Rollup `declarationDir` warning.
- `npx cypress run --spec cypress/e2e/batch-visualization.cy.js`: 8 tests passed, including selection filtering and the empty-selection state.
- The full pipeline Cypress spec ran 40 tests with 37 passing. Both new review-selection tests passed. Three unrelated existing cases failed: restored-file validation, stage navigator activation, and a date expectation tied to the current clock. Its preserved log is in `logs/cypress-pipeline.log`.

The committed Cypress cases assert the actual arrays supplied to the Electron and YouTube boundaries, not only checkbox rendering.

## Artifacts

- `issue.json`, `issue-comments.json`: issue snapshot and all comments.
- `pr.json`, `pr-conversation-comments.json`, `pr-review-comments.json`, `pr-reviews.json`: PR snapshot and all three GitHub feedback channels.
- `initial-ci-run.json`: baseline workflow/job metadata.
- `logs/`: local unit, static, build, and browser-test logs.
