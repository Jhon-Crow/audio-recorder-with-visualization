# Case Study: Issue #155 — Pipeline Navbar Scrolls Behind Sticky Preview

## Problem Statement

When clicking a pipeline navbar button (in `#pipelineStageNav`), the page scrolls so the targeted pipeline stage is placed at the very top of the viewport (position 0). However, the `.canvas-container` element is positioned with `position: sticky; top: 0;` and occupies a significant portion of the top of the viewport. This causes the stage's number and title to be hidden behind the sticky preview canvas.

**Expected behavior:** Clicking a navbar button should scroll so the stage number and title are fully visible, below the sticky canvas preview.

## Root Cause Analysis

### Affected code

**File:** `examples/pipeline.js`, function `scrollToStage` (line 1718)

```js
function scrollToStage(stageId) {
  const stageElement = stagesContainer.querySelector(`[data-stage-id="${stageId}"]`);
  if (!stageElement) {
    return;
  }
  setActiveStage(stageId);
  const behavior = window.Cypress ? 'auto' : 'smooth';
  stageElement.scrollIntoView({ behavior, block: 'start' });  // <-- bug here
}
```

### Root cause

`scrollIntoView({ block: 'start' })` scrolls the element so its top edge aligns with the top of the **scrollable ancestor** (the viewport). It does **not** account for sticky-positioned elements that overlay the top of the viewport.

The `.canvas-container` in `examples/styles.css` is:

```css
.canvas-container {
  position: sticky;
  top: 0;
  z-index: 100;
  /* ... */
}
```

This sticky element always covers the top portion of the viewport. When `scrollIntoView({ block: 'start' })` places the stage at viewport position 0, the sticky canvas sits on top of it, hiding the stage number and title.

### Sequence of events

1. User opens the Pipeline tab — the sticky canvas preview appears at the top of the page.
2. Several pipeline stages are visible below the canvas.
3. User clicks navbar button for a stage that's not currently in view.
4. `scrollToStage` is called → `scrollIntoView({ block: 'start' })` fires.
5. The stage scrolls to top=0, behind the sticky canvas.
6. The stage number and name are hidden.

## Solution

Replace `scrollIntoView` with a manual scroll calculation that offsets for the sticky canvas height:

```js
function scrollToStage(stageId) {
  const stageElement = stagesContainer.querySelector(`[data-stage-id="${stageId}"]`);
  if (!stageElement) {
    return;
  }
  setActiveStage(stageId);
  const behavior = window.Cypress ? 'auto' : 'smooth';
  const stickyPreview = document.querySelector('.canvas-container');
  const stickyOffset = stickyPreview ? stickyPreview.getBoundingClientRect().bottom : 0;
  const elementTop = stageElement.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: elementTop - stickyOffset, behavior });
}
```

**Why this works:**
- `stickyPreview.getBoundingClientRect().bottom` gives the pixel position of the bottom of the sticky canvas in the current viewport (this is always the effective "top clearance" required).
- `stageElement.getBoundingClientRect().top + window.scrollY` converts the element's viewport-relative position into an absolute document position.
- Subtracting `stickyOffset` from the target scroll position ensures the stage top lands exactly at the bottom of the sticky canvas — fully visible.

## Test Update

The existing Cypress test at `cypress/e2e/pipeline-mode.cy.js` checked:
```js
expect($target[0].getBoundingClientRect().top).to.be.lessThan(120);
```

This was insufficient — with the old broken behavior, the element top could be 0 (hidden behind the canvas) and still pass the test. The test was updated to:
```js
cy.get('.canvas-container').then(($canvas) => {
  const stickyBottom = $canvas[0].getBoundingClientRect().bottom;
  cy.get(`.pipeline-stage[data-stage-id="${stageId}"]`).then(($target) => {
    const stageTop = $target[0].getBoundingClientRect().top;
    expect(stageTop).to.be.at.least(stickyBottom - 2);
    expect(stageTop).to.be.lessThan(stickyBottom + 48);
  });
});
```

This correctly asserts that the stage top is at or just below the sticky canvas bottom.
