# Issue 136 Case Study: Pipeline Stage Navigation

## Request

Issue 136 asks for a fixed widget between the main pipeline window and the right sidebar. The widget must stay visible in pipeline mode, show a numbered list of stages ordered by date, include the output file name, action, and upload date for update actions, highlight the stage currently on screen, and scroll to a stage when clicked.

PR review feedback clarified two layout constraints: the navigator must remain visible instead of scrolling away, and it must sit outside the stage section so pipeline stage cards do not lose horizontal space. The widget height should follow its rendered list content, with only a max-height guard for small viewports.

## Collected Repository Data

- `examples/index.html` contains the pipeline tab, stage container, and existing right pipeline sidebar.
- `examples/pipeline.js` owns pipeline state, stage rendering, action types, publication timing, and stage add/remove/load behavior.
- `examples/styles.css` already has fixed sidebars and pipeline card layout styles that the widget can match.
- `cypress/e2e/pipeline-mode.cy.js` covers pipeline defaults, persistence, reset, upload metadata, and generated controls.
- Raw issue and PR data are stored in `docs/case-studies/issue-136/logs/`.

## External Research

The standard pattern for this UI is a scrollspy navigation: a persistent local navigation list whose active item follows the section currently visible in the viewport. MDN documents `IntersectionObserver` as an asynchronous browser API for observing when targets cross viewport thresholds, which fits active-stage tracking without a continuous scroll handler. Bootstrap-style scrollspy components also model the expected behavior: navigation links update active state while scrolling and jump to their matching sections when clicked.

References:

- MDN Intersection Observer API: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- Bootstrap Scrollspy documentation: https://getbootstrap.com/docs/5.3/components/scrollspy/

## Solution Options

1. Use a third-party scrollspy library.
   This is unnecessary for the existing plain JavaScript example app and would add dependency surface for a small behavior.

2. Use scroll listeners and manual bounding-rectangle checks.
   This is simple but can produce more frequent work during scrolling and needs throttling.

3. Use a local fixed nav plus `IntersectionObserver`.
   This matches current code style, avoids extra dependencies, keeps the widget independent, and makes active-state updates efficient.

## Implemented Direction

The implementation adds a fixed `#pipelineStageNav` outside the pipeline stage section, renders one button per stage, and keeps it synchronized with stage add/remove/load/render updates. Each item includes the stage number, output title, action label, and upload timing when the action includes update. Clicking an item scrolls its stage into view, and `IntersectionObserver` updates the active item as the user scrolls. The navigator is content-sized by default and constrained only by viewport max-height, so it remains visible without forcing empty vertical space or narrowing stage cards.
