# Issue 179 Case Study

## Scope

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/179
Pull request: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/180

This folder preserves the issue and pull request context used to diagnose the full-album pipeline stage follow-up bugs.

## Timeline

- 2026-06-25 13:53 UTC: Initial implementation added a checkbox that rendered an album as one full-album video.
- 2026-06-25 14:38 UTC: Owner requested that full album become a dependent stage after the album stage, with its own name, description, interval, and generated timestamps.
- 2026-06-25 14:53 UTC: PR updated with a derived full-album stage model.
- 2026-06-25 15:55 UTC: Owner reported regressions: no type selector on the added stage, checkbox could not be unchecked, derived stage needed a thick solid gold border, generated timestamps ignored track durations, and typing in date/time inputs caused scroll jumps and closed the picker.
- 2026-06-25 17:19 UTC: Owner verified the latest build and reported that added full-album stages still did not show the expected stage type selector in the primary stage controls.

## Root Causes

- The derived-stage reconciliation treated the presence of an existing full-album stage as a reason to keep recreating it. That made the source checkbox impossible to turn off.
- Full-album stages used `kind: fullalbum`, while the release type editor was only rendered for `kind: release`, so the derived stage had no visible type selector.
- Timestamp generation only read ad hoc duration properties from `File` objects. Browser `File` objects do not expose audio duration, so offsets stayed at `00:00`.
- Schedule and numeric input handlers requested a full stage rerender on every `input` event. Replacing the focused DOM node explains the scroll jump and the native date/time picker closing after one edit.
- The follow-up type selector fix placed a disabled Album selector inside the nested release editor, below other stage controls. The requested control was expected in the primary stage control row near the stage title/action controls, so the latest build still appeared to have no stage type selector.

## Implemented Fixes

- The album checkbox now controls whether the derived full-album stage exists. Unchecking removes the dependent stage.
- The derived full-album stage shows a disabled Album release-type selector, making its type visible while preserving the required fixed behavior.
- The derived stage is styled with a thick solid gold border.
- Selected album files are loaded with browser audio metadata to calculate cumulative timestamp offsets.
- Text, date, time, and relative interval typing no longer forces whole-stage rerenders; structural changes still rerender when needed.
- Full-album stages now also show a disabled top-level `Type` selector set to `Album` before the main action selector, matching the placement of a stage type control in the primary controls.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: passed, 342 tests.
- `npm run test:e2e -- --spec cypress/e2e/pipeline-mode.cy.js`: 24 passing, 2 failing. The full-album regression passes; the remaining failures are the previously observed stage navigator active-state assertion and relative publish-date assertion.

## Preserved Data

- `issue.json`: issue metadata and comments.
- `pr-180.json`: pull request metadata, comments, reviews, and commits.
- `pr-conversation-comments.json`: PR conversation comments from the issues API.
- `pr-review-comments.json`: PR inline review comments.
- `ci-build-portable-exe-28179099194.log`: latest successful CI log available before this fix.
- `cypress-pipeline.log`: final local Cypress pipeline run.
- `npm-ci.log`, `typecheck.log`, `unit-tests.log`: local setup and verification logs.
- `reviewer-screenshot.png`: screenshot attached to the owner feedback. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a` because the `file` utility was unavailable in the environment.
- `reviewer-screenshot-type-select-missing.png`: screenshot attached to the 2026-06-25 17:19 UTC owner feedback. The PNG header was verified locally as `89 50 4e 47 0d 0a 1a 0a` because the `file` and `xxd` utilities were unavailable in the environment.
