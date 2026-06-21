# Issue 95: Aspect Ratio Selection

## Request

The user requested a settings block available for all visualization modes that allows choosing common video aspect ratios, specifically 16:9 and 9:16 for Shorts, without breaking existing behavior.

## Repository Findings

- The example app preview canvas was hardcoded to `1920 x 1080` in `examples/index.html`.
- Audio-to-video conversion already supports arbitrary `videoWidth` and `videoHeight` through `AudioToVideoConverter.convertWithFallback`.
- Microphone recording captures the current canvas stream, so resizing the shared canvas is enough to make microphone recordings follow the selected aspect ratio.
- The existing quality selector only represented 16:9 resolutions.

## External Context

- MDN documents CSS `aspect-ratio` as the standard way to preserve a preferred width-to-height ratio for layout boxes: https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
- YouTube Shorts and similar vertical feeds commonly use 9:16, with 1080 x 1920 often used as a high-quality vertical target.
- Common creator presets worth offering in a general-purpose video tool include 16:9 landscape, 9:16 vertical, 1:1 square, 4:5 portrait, 4:3 classic, and 21:9 ultrawide.

## Chosen Solution

Add an `Aspect Ratio` select next to the existing quality and format controls. Quality continues to choose the maximum long-edge resolution tier, while the aspect ratio derives the missing dimension:

- Landscape ratios keep the quality width and compute height.
- Portrait ratios keep the quality height and compute width.
- 16:9 remains the default, preserving the existing 1920 x 1080 behavior for 1080p.

This keeps the public library API unchanged because conversion and recording already accept the resulting dimensions.

## Verification

Added Cypress coverage for:

- Default 16:9 1080p canvas size.
- 9:16 Shorts dimensions.
- Portrait ratio calculation at 720p.
- Persisting and restoring the selected aspect ratio after reload.
