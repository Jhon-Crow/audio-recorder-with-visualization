# Issue 137 Case Study: Pipeline Stage Previews

## Request

Hovering over a pipeline stage number or album track number should show a tooltip with an image-like preview of how that item will be visualized, using the configured aspect ratio.

## Collected Data

- Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/137
- PR: https://github.com/Jhon-Crow/audio-recorder-with-visualization/pull/139
- Related merged PR: #128, which introduced Pipeline mode execution.
- Raw issue and PR metadata are stored in `docs/case-studies/issue-137/logs/`.

## Existing Implementation

- Pipeline UI is rendered in `examples/pipeline.js`.
- Stage numbers use `.pipeline-stage-number`.
- Album track numbers use `.pipeline-track-handle`.
- Stage resolution is stored as strings such as `1920x1080` and `1080x1920`.
- Existing text tooltips use `data-tooltip` in `examples/styles.css`.

## Solution Options

1. Native title tooltip only: simple, but cannot display aspect-ratio preview imagery.
2. CSS-only rich tooltip: lightweight, no new dependency, works with current static example architecture.
3. Third-party tooltip library such as Tippy.js or Floating UI: useful for complex positioning, but unnecessary for this repository's current no-bundler example UI.

## Selected Approach

Use a CSS-only preview tooltip attached to stage and track number elements. The tooltip renders a small framed visualization mock with CSS bars and a stage-specific aspect ratio from the configured resolution. This keeps the implementation local, testable, and consistent with existing `data-tooltip` behavior.
