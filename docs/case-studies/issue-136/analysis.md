# Issue 136 Case Study: Pipeline Stage Navigation

## Request

Issue 136 asks for a fixed widget between the main pipeline window and the right sidebar. The widget must stay visible in pipeline mode, show a numbered list of stages, include the output file name, action, and upload date for update actions, highlight the currently visible stage, and scroll to a stage when clicked.

The review thread refined the layout requirement several times:

- The widget height must follow its content instead of stretching down with empty space.
- The widget must not narrow the stage cards.
- The widget must not scroll away with the stage section; it should behave close to the main preview window and stay attached to the bottom of the viewport.
- The widget should live outside the pipeline stage section.

## Collected Data

Repository artifacts:

- `docs/case-studies/issue-136/logs/issue-136.json`
- `docs/case-studies/issue-136/logs/issue-136-comments.json`
- `docs/case-studies/issue-136/logs/pr-140.json`
- `docs/case-studies/issue-136/logs/pr-140-conversation-comments.json`
- `docs/case-studies/issue-136/logs/pr-140-review-comments.json`
- `docs/case-studies/issue-136/logs/pr-140-reviews.json`
- `docs/case-studies/issue-136/logs/ci-runs.json`

Screenshots from PR feedback:

- `docs/case-studies/issue-136/screenshots/pr-comment-4641437853-empty-space.png`
- `docs/case-studies/issue-136/screenshots/pr-comment-4643139141-not-fixed.png`
- `docs/case-studies/issue-136/screenshots/pr-comment-4643847531-bottom-of-section.png`

Code touched by the issue:

- `examples/index.html` defines the pipeline tab, stage list, sidebar, and navigator mount point.
- `examples/pipeline.js` renders stages, keeps the navigator in sync, observes visible stages, and scrolls to selected stages.
- `examples/styles.css` defines the fixed overlay, sidebars, pipeline cards, and mobile layout.
- `cypress/e2e/pipeline-mode.cy.js` covers navigator visibility, fixed positioning, scroll behavior, stage-card width, mobile viewport behavior, and sync after stage mutations.

## Timeline

1. Initial implementation added a numbered pipeline navigator with `IntersectionObserver`, click-to-scroll, and Cypress coverage.
2. First review found a fixed-looking panel with too much empty vertical space. The root issue was a stretched layout with excess height instead of content-sized height.
3. The follow-up changed the widget to sticky inside the workspace. That fixed the empty-space complaint but violated the stronger requirement that the widget should remain visible and not scroll away.
4. The next follow-up moved the widget outside the stage list and used `position: fixed`, but it was still mounted inside the pipeline tab content. The review screenshot showed it appearing below the last stage and moving with normal content.
5. The final fix moves the navigator to document-level markup beside the pipeline sidebar and keeps the widget fixed to the viewport bottom. That removes it from the pipeline section flow and from ancestors that can interfere with fixed positioning.

## Root Cause

The bug was not the scrollspy logic. The active-state and click-to-scroll behavior were correct. The failure was layout containment.

The navigator was visually intended to be a viewport overlay, but it was mounted inside the pipeline tab subtree. In real browser layout, fixed descendants can be affected by ancestor containment contexts, especially when ancestors use properties such as transforms, filters, paint containment, or similar stacking/containing-block behavior. MDN documents that fixed-positioned boxes are normally relative to the viewport, while containing-block rules can be changed by certain ancestor properties. The safest fix for a persistent overlay is to mount it outside the scrolling or transformed content subtree.

The first sticky attempt also showed a product-requirement mismatch: sticky positioning still participates in the normal document flow and is bounded by its scroll container. That made it unsuitable for a widget that should stay visible like the preview window.

## External Research

The requested UI maps to a scrollspy pattern: persistent local navigation synchronized with visible document sections. `IntersectionObserver` is a good fit because it observes visibility threshold changes without a manual scroll loop.

Relevant references:

- MDN `position`: fixed positioning is normally relative to the viewport in visual media.
  https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position
- MDN containing blocks: fixed-positioned elements can use a containing block created by certain ancestor properties such as transforms, filters, containment, and related layout properties.
  https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block
- MDN Intersection Observer API: browser API for reacting when observed elements enter or leave a viewport/intersection threshold.
  https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- Bootstrap Scrollspy: established component pattern for active navigation that follows scroll position.
  https://getbootstrap.com/docs/5.3/components/scrollspy/

## Solution Options

1. Third-party scrollspy component.
   This would solve active-link synchronization, but it is unnecessary in this plain JavaScript example app and would not solve the overlay containment problem by itself.

2. Sticky widget inside the pipeline workspace.
   This keeps layout local but remains constrained by the workspace and can still consume card width or scroll away depending on the section boundaries.

3. Fixed document-level overlay plus local scrollspy logic.
   This matches the requirement best. The navigator is outside the stage section, does not narrow cards, remains attached to the viewport bottom, has content-sized height with a max-height guard, and uses existing app code rather than introducing a dependency.

## Implemented Direction

The navigator is now mounted as a direct `body` child beside `#pipelineSidebar`, not inside the pipeline tab or stage section. CSS keeps it `position: fixed` at the bottom of the viewport, beside the main pipeline area and before the right sidebar on desktop, with a full-width bottom overlay treatment on narrow screens. Its height follows the button list and only scrolls internally when the viewport max-height is reached.

`examples/pipeline.js` renders one button per stage, keeps the list synchronized with render/add/remove/load/update events, toggles visibility only in pipeline mode, and uses `IntersectionObserver` to mark the active visible stage. Clicking a nav button scrolls to the matching stage.

The Cypress coverage now asserts:

- the navigator is `position: fixed`;
- the navigator is mounted under `body`, outside `.pipeline-workspace` and `#pipeline`;
- the bottom edge remains pinned to the viewport;
- stage cards remain wide and are not narrowed by the navigator;
- the mobile layout also keeps the navigator fixed at the bottom after scrolling.
