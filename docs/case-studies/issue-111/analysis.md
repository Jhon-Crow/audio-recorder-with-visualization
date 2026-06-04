# Issue 111: Image Blink Range Slider Conflict

## Request

Issue 111 reports that the image blink effect settings conflict visually, with the screenshot showing the frequency range sliders colliding with adjacent blink controls. The issue also asks to collect logs and related data in `docs/case-studies/issue-111`, reconstruct the timeline, identify root causes, and propose solutions.

## Collected Data

- Issue metadata: `logs/issue-111.json`
- Issue comments: `logs/issue-111-comments.json`
- PR metadata and review/discussion data: `logs/pr-112.json`, `logs/pr-112-comments.json`, `logs/pr-112-review-comments.json`, `logs/pr-112-reviews.json`
- Original screenshot from the issue: `assets/issue-111-screenshot.png`
- Fixed UI screenshot: `assets/issue-111-fixed-blink-controls.png`
- Local verification logs: `logs/npm-install.log`, `logs/npm-build.log`, `logs/npm-typecheck.log`, `logs/npm-test.log`, `logs/cypress-image-blink-controls.log`

## Timeline

- 2026-06-04 16:26:56 UTC: Issue 111 was opened with a screenshot and the note that the blink effect setting sliders conflict.
- 2026-06-04 16:33 UTC: The prepared PR 112 existed as a draft against `main` from branch `issue-111-2f6440f4c6e3`.
- 2026-06-04 16:42 UTC: The issue screenshot and GitHub metadata were downloaded into this case study folder.
- 2026-06-04 16:43 UTC: Dependencies were installed from the lockfile for local verification.
- 2026-06-04 16:47 UTC: A focused Cypress regression test was added for image blink slider layout and value updates.
- 2026-06-04 16:48 UTC: A fixed UI screenshot was captured after enabling image blink controls and setting the frequency range to `80 - 2000`.

## Root Cause

The frequency range UI in `examples/index.html` placed two range inputs inside a single label using an inline `display: flex` wrapper:

- The label was one item in the surrounding `.option-group` CSS grid.
- The two sliders each had `flex: 1`, while the global range input CSS still enforced a `min-width: 150px`.
- At the available grid width, both range tracks were forced into a cramped horizontal area.
- Because the combined frequency control was only one grid item, the following blink intensity and blink duration controls could occupy adjacent grid cells, making the frequency range appear visually connected to unrelated sliders.

The bug was layout-specific. The JavaScript handlers for `blinkFrequencyMin`, `blinkFrequencyMax`, and `blinkFrequencyValue` already kept min/max values synchronized.

## Solution Options

1. Keep the inline flex layout and only reduce `min-width`.
   - This would reduce pressure but still leave two related controls inside one cramped grid item.
   - It would not make the combined frequency range semantically clearer.

2. Replace the two native sliders with a custom dual-thumb range component.
   - This would match the "range" concept visually.
   - It would introduce more custom pointer/keyboard behavior and higher regression risk.

3. Keep native sliders, but give the frequency range a dedicated responsive layout.
   - This matches the repository's current plain HTML/CSS approach.
   - It keeps existing JavaScript and persisted settings unchanged.
   - It separates the combined frequency control from intensity/duration in the grid.

## Implemented Direction

The implementation uses option 3:

- Replaced the inline `style="display: flex"` wrapper with a `.range-pair` structure.
- Added explicit `Min` and `Max` labels plus aria labels for the two frequency sliders.
- Added `.blink-manual-controls` so the manual frequency/threshold controls span the full image blink settings grid.
- Added responsive CSS so the two frequency sliders stack on narrow screens.
- Kept existing element IDs and event handlers unchanged, preserving settings persistence and visualizer option generation.

## Verification

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `npx cypress run --spec cypress/e2e/image-blink-controls.cy.js` passed.
- The Cypress regression verifies that the frequency min/max sliders update the combined display text and do not overlap with each other or the blink intensity slider.
- Manual Playwright verification produced `assets/issue-111-fixed-blink-controls.png`.
