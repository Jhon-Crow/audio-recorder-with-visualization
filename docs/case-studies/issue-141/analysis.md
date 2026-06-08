# Issue 141 Case Study: Pipeline Preview Tooltip Accuracy

## Evidence Collected

- Issue payload and comments: `logs/issue-141.json`, `logs/issue-141-comments.json`
- PR 142 conversation, review, and diff data: `logs/pr-142-comments.json`, `logs/pr-142-reviews.json`, `logs/pr-142-review-comments.json`, `logs/pr-142-diff.patch`
- Upstream CI run snapshot: `logs/ci-runs-upstream.json`
- Local git history snapshot: `logs/git-log.txt`
- Owner regression screenshot from PR comment 4645049235: `assets/pr-comment-4645049235-tooltip-regression.png`

The screenshot file was downloaded from GitHub user attachments with authentication. The local environment did not provide the `file` or `xxd` commands, so the PNG signature was verified with `od`; the first 8 bytes are `89 50 4e 47 0d 0a 1a 0a`.

## Timeline

- 2026-06-07 19:47-20:02 UTC: PR 142 CI runs completed successfully for earlier preview-frame changes.
- 2026-06-08 02:50 UTC: The repository owner reported three remaining tooltip problems on PR 142:
  - the stage list can appear above the main preview when the tooltip opens;
  - some aspect ratios, including 9:16, do not fit fully inside the tooltip;
  - the tooltip visualization image positioning differs from the real preview.
- 2026-06-08 06:50 UTC: This follow-up work session started and PR 142 was returned to draft while the regressions were investigated.

## Root Causes

The tooltip preview was rendered as a pseudo-element attached to each stage-number or track-handle trigger. To keep that pseudo-element visible, the tab container was promoted to a high z-index during hover/focus. That promotion also lifted the whole pipeline stage list over the central preview, which explains the owner screenshot.

The pseudo-element used a fixed width and `background-size: cover`. For tall aspect ratios such as 9:16, `cover` can crop the generated preview image, making it impossible to inspect the full frame inside the tooltip.

Because the tooltip presentation cropped the generated bitmap independently from the actual preview composition, the visible background/image position could differ from the real visualization preview even when the generated bitmap itself was correct.

## Implemented Direction

The tooltip preview is now represented by a single body-level fixed overlay instead of per-trigger pseudo-elements. The overlay is positioned from the active trigger's viewport rectangle and clamped to viewport bounds. This keeps the stage list in its normal stacking context and prevents the list from covering the main preview.

The overlay uses `background-size: contain` for the generated bitmap, preserving the full 9:16 or landscape preview inside the tooltip instead of cropping it. The generated preview bitmap remains the same source used by the existing trigger styling, so the overlay does not introduce a second image-positioning path.

## Verification

The Cypress pipeline spec was extended to decode generated preview images and assert that preview content is visible for both portrait stages and landscape album tracks. The tooltip containment behavior is covered by the existing generated-tooltip viewport test in the same spec.
