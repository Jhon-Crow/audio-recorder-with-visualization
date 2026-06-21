# Issue 99 Case Study: Preview Mounting Area And Alignment Guides

## Problem

On black backgrounds, especially with portrait formats such as 9:16, the preview canvas blends into the page and makes it difficult to tell whether the visualization is centered inside the final video frame. The requested behavior is:

- show a mounting-area contour in the preview only;
- keep that contour out of recorded/exported video;
- add Photoshop-like guides for center and grid alignment that appear when the visualization is positioned on those guides.

## Repository Context

The example UI renders the recording frame in `examples/index.html` as the `#visualizer` canvas. Video export and preview rendering use the same canvas pixels, so any helper drawn into the canvas would be recorded. The safer surface for non-exporting helpers is a DOM overlay positioned over the canvas.

Related local files:

- `examples/index.html`: preview canvas markup;
- `examples/styles.css`: preview layout and visual styling;
- `examples/app-core.js`: video dimensions, current options, and preview refresh;
- `examples/app-features.js` and `examples/app-interactions.js`: offset/scale controls and drag behavior.

Captured issue and PR metadata is stored in `logs/issue-99.json` and `logs/pr-100.json`.

## External Research

- Adobe documents grids and guides as visual layout aids that can be shown in the editing interface without being part of the artwork output. See: https://helpx.adobe.com/photoshop/using/grid-guides.html
- Adobe describes Smart Guides as dynamic visual helpers that appear while moving layers and help align to nearby elements and centers. See: https://helpx.adobe.com/photoshop/using/positioning-elements-snapping.html
- Konva's object-snapping demo uses temporary guide lines when dragged objects approach stage centers or other guide stops, which matches the requested dynamic behavior. See: https://konvajs.org/docs/sandbox/Objects_Snapping.html
- Fabric.js has community alignment-guide patterns that draw transient helper lines during object movement on canvas editors. See: https://github.com/fabricjs/fabric.js

## Options Considered

1. Draw guides directly into the canvas.
   This is simple but unsafe because the same canvas is used for recording and conversion, so helpers could leak into the final video.

2. Use a canvas editor library such as Konva or Fabric.js.
   These libraries already solve object snapping and guide rendering, but adopting one would be oversized for the current single-preview-canvas app and would add a new dependency for a narrow UI helper.

3. Add a DOM overlay above the canvas.
   This keeps helpers preview-only, works with the existing canvas rendering pipeline, and can be tested with Cypress through DOM state.

## Implemented Solution

The preview now wraps the canvas in `#previewStage` and overlays `#previewOverlay`. The overlay provides:

- a persistent preview-only border around the video frame;
- a subtle center/grid layout aid;
- dynamic smart guides for center alignment;
- dynamic smart guides when the visualization offset lands near reachable grid stops.

Guide state is recalculated when preview dimensions, offset, scale, or preview rendering change. The implementation avoids changing the recorder/converter canvas drawing path, so exported video frames remain unaffected.

## Verification

Added Cypress coverage in `cypress/e2e/preview-alignment-guides.cy.js` for:

- visible preview-only overlay on 9:16 portrait output;
- center guides visible at zero offset;
- guides hidden when offset is away from alignment;
- grid guides visible when offsets align to grid stops.
