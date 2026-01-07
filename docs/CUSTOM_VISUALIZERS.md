# Creating Custom Visualizers

This guide explains how to create custom audio visualizations for the Audio Recorder with Visualization library.

## Quick Start

1. Download the template by clicking "Download Template" in the UI
2. Edit the template to create your custom visualization
3. Upload your `.js` file using the "Custom Visualizer" file input
4. Your visualizer will appear in the visualizer dropdown

## Requirements

Custom visualizers must:
- Be a JavaScript class that extends `BaseVisualizer` or implements the `Visualizer` interface
- Export the class as the default export or as `Visualizer`
- Have a unique `id` and `name` property
- Implement the `draw(ctx, data)` method

## Basic Structure

```javascript
/**
 * My Custom Visualizer
 */
class MyVisualizer extends BaseVisualizer {
  // Required: unique identifier
  id = 'my-visualizer';

  // Required: display name
  name = 'My Visualizer';

  constructor(options = {}) {
    super({
      // Default options
      primaryColor: '#00ff88',
      secondaryColor: '#0088ff',
      ...options,
    });
  }

  /**
   * Draw a single visualization frame
   * @param ctx - Canvas 2D rendering context
   * @param data - Visualization data
   */
  draw(ctx, data) {
    const { width, height, frequencyData, timeDomainData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Your custom drawing code here

    // Draw foreground overlay if configured
    this.drawForeground(ctx, data);
  }
}

// Export as default
export default MyVisualizer;
```

## VisualizationData

The `draw` method receives a `data` object with:

| Property | Type | Description |
|----------|------|-------------|
| `frequencyData` | `Uint8Array` | Frequency spectrum values (0-255), higher = louder |
| `timeDomainData` | `Uint8Array` | Waveform values (0-255), 128 = silence |
| `width` | `number` | Canvas width in pixels |
| `height` | `number` | Canvas height in pixels |
| `timestamp` | `number` | Current time in milliseconds |
| `sampleRate` | `number` | Audio sample rate (e.g., 44100) |
| `fftSize` | `number` | FFT size used for analysis |

## BaseVisualizer Helper Methods

When extending `BaseVisualizer`, you get access to helpful methods:

### Background/Foreground

```javascript
// Draw background (color or image)
this.drawBackground(ctx, data);

// Draw foreground overlay
this.drawForeground(ctx, data);

// Apply layer effects (blur, brightness, etc.)
this.applyLayerEffect(ctx, data);
```

### Transform and Position

```javascript
// Apply offset and scale transforms
this.applyTransform(ctx, data);

// Restore transform (handles horizontal mirror)
this.restoreTransform(ctx, data);
```

### Gradients

```javascript
// Create gradient with primary/secondary colors
const gradient = this.createGradient(ctx, x0, y0, x1, y1);
```

### Validation

```javascript
// Check if dimensions are valid
if (!this.isValidDimensions(width, height)) {
  return;
}
```

## Accessing Options

Options are available via `this.options`:

```javascript
draw(ctx, data) {
  const {
    primaryColor,
    secondaryColor,
    backgroundColor,
    lineWidth,
    barCount,
    barGap,
    mirror,
    mirrorHorizontal,
    smoothing,
    visualizationAlpha,
    offsetX,
    offsetY,
    scale,
  } = this.options;

  // Custom options are in this.options.custom
  const myCustomOption = this.options.custom?.myOption ?? defaultValue;
}
```

## Adding Custom Options

You can define custom options that users can configure:

```javascript
// In constructor
constructor(options = {}) {
  super({
    ...options,
    custom: {
      intensity: 1.0,
      particleCount: 100,
      glowEnabled: true,
      ...options.custom,
    },
  });
}

// Use in draw method
const intensity = this.options.custom?.intensity ?? 1.0;
```

## Optional Metadata

Add metadata to provide additional information:

```javascript
export const metadata = {
  id: 'my-visualizer',
  name: 'My Visualizer',
  description: 'A beautiful custom visualization',
  author: 'Your Name',
  version: '1.0.0',
  customOptions: [
    {
      key: 'intensity',
      label: 'Intensity',
      type: 'number',
      defaultValue: 1,
      min: 0.1,
      max: 2,
      step: 0.1,
      description: 'Controls the visualization intensity'
    }
  ]
};
```

## Example: Simple Bars Visualizer

```javascript
class SimpleBars extends BaseVisualizer {
  id = 'simple-bars';
  name = 'Simple Bars';

  #previousHeights = [];

  constructor(options = {}) {
    super({
      primaryColor: '#ff0000',
      secondaryColor: '#00ff00',
      barCount: 32,
      smoothing: 0.8,
      ...options,
    });
  }

  draw(ctx, data) {
    const { width, height, frequencyData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Setup
    const barCount = this.options.barCount ?? 32;
    const barWidth = width / barCount;
    const step = Math.floor(frequencyData.length / barCount);
    const smoothing = this.options.smoothing ?? 0.8;

    // Initialize heights array
    if (this.#previousHeights.length !== barCount) {
      this.#previousHeights = new Array(barCount).fill(0);
    }

    // Apply alpha
    const alpha = this.options.visualizationAlpha ?? 1;
    ctx.globalAlpha = alpha;

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      // Average frequency values
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const value = sum / step / 255;

      // Apply smoothing
      const smoothed = this.#previousHeights[i] * smoothing + value * (1 - smoothing);
      this.#previousHeights[i] = smoothed;

      // Calculate dimensions
      const barHeight = smoothed * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, this.options.primaryColor);
      gradient.addColorStop(1, this.options.secondaryColor);

      // Draw bar
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    }

    ctx.globalAlpha = 1;
  }
}

export default SimpleBars;
```

## Example: Circular Waveform

```javascript
class CircularWave extends BaseVisualizer {
  id = 'circular-wave';
  name = 'Circular Wave';

  constructor(options = {}) {
    super({
      primaryColor: '#00ffff',
      lineWidth: 2,
      ...options,
    });
  }

  draw(ctx, data) {
    const { width, height, timeDomainData } = data;

    this.drawBackground(ctx, data);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    ctx.strokeStyle = this.options.primaryColor;
    ctx.lineWidth = this.options.lineWidth;
    ctx.beginPath();

    for (let i = 0; i < timeDomainData.length; i++) {
      const value = (timeDomainData[i] - 128) / 128;
      const angle = (i / timeDomainData.length) * Math.PI * 2;
      const r = radius + value * radius * 0.5;

      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();

    this.drawForeground(ctx, data);
  }
}

export default CircularWave;
```

## Tips

1. **Performance**: Avoid creating new objects in `draw()` - reuse arrays and objects when possible
2. **Smoothing**: Use smoothing to prevent jarring visual changes between frames
3. **Private Fields**: Use `#privateField` syntax for internal state
4. **Colors**: Use `this.options.primaryColor` and `secondaryColor` to respect user settings
5. **Alpha**: Always apply `visualizationAlpha` for transparency support
6. **Transforms**: Use `applyTransform`/`restoreTransform` for offset, scale, and mirror support

## Debugging

Enable debug mode when testing:

```javascript
const recorder = new AudioRecorder({
  canvas: '#visualizer',
  visualizer: myVisualizer,
  debug: true, // Enables console logging
});
```

Check the browser console for errors when loading custom visualizers.

## File Structure

For complex visualizers, you can organize code in a single file:

```javascript
// Helper functions
function calculateFrequencyBands(data) {
  // ...
}

// Main visualizer class
class ComplexVisualizer extends BaseVisualizer {
  // ...
}

// Metadata
export const metadata = { /* ... */ };

// Default export
export default ComplexVisualizer;
```

## Limitations

- Custom visualizers are loaded dynamically and run in the browser context
- The `BaseVisualizer` class is available as a global during loading
- Complex dependencies should be bundled into a single file
- ES modules syntax (`import`/`export`) is supported
