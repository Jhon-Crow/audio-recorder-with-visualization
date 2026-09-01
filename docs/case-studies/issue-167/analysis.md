# Issue 167: Visualization scale slider

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/167

The reporter noted that the visualization did not react to the scale slider. The relevant UI control is `#visualizationScale` in the Transform section.

The live handler in `examples/app-features.js` updates the active visualizer with `scale: s / 100`, while settings persistence stores the slider percentage. A Cypress regression now verifies both behaviors:

- Moving `#visualizationScale` to `150` updates the display to `150%`.
- The active visualizer receives `options.scale === 1.5`.
- Saved settings preserve `scale === 150`.

Evidence screenshot from the issue:

![Visualization Scale slider](assets/issue-167-slider.png)
