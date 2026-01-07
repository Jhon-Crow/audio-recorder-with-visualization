/**
 * Rainbow Bars Visualizer
 *
 * A colorful bar visualizer that displays rainbow-colored bars
 * based on audio frequency data.
 */

// Metadata about the visualizer
export const metadata = {
  id: 'rainbow-bars',
  name: 'Rainbow Bars',
  description: 'Colorful rainbow-colored frequency bars',
  author: 'Audio Recorder Team',
  version: '1.0.0',
  customOptions: [
    {
      key: 'colorSpeed',
      label: 'Color Speed',
      type: 'number',
      defaultValue: 1,
      min: 0.1,
      max: 5,
      step: 0.1,
      description: 'Speed of color cycling'
    },
    {
      key: 'roundedBars',
      label: 'Rounded Bars',
      type: 'boolean',
      defaultValue: true,
      description: 'Whether bars have rounded corners'
    }
  ]
};

/**
 * Rainbow Bars Visualizer Class
 */
class RainbowBarsVisualizer extends BaseVisualizer {
  id = 'rainbow-bars';
  name = 'Rainbow Bars';

  #previousHeights = [];
  #hueOffset = 0;

  constructor(options = {}) {
    super({
      barCount: 64,
      barGap: 0.15,
      smoothing: 0.75,
      ...options,
      custom: {
        colorSpeed: 1,
        roundedBars: true,
        ...options.custom,
      },
    });
  }

  draw(ctx, data) {
    const { width, height, frequencyData, timestamp } = data;

    // Validate dimensions
    if (!this.isValidDimensions(width, height)) {
      return;
    }

    // Draw background
    this.drawBackground(ctx, data);

    // Apply layer effects
    this.applyLayerEffect(ctx, data);

    // Apply position offset and scale
    this.applyTransform(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = visualizationAlpha;

    // Setup
    const barCount = this.options.barCount ?? 64;
    const barGap = this.options.barGap ?? 0.15;
    const totalBarWidth = width / barCount;
    const barWidth = totalBarWidth * (1 - barGap);
    const gapWidth = totalBarWidth * barGap;
    const colorSpeed = this.options.custom?.colorSpeed ?? 1;
    const roundedBars = this.options.custom?.roundedBars ?? true;

    // Update hue offset for animation
    this.#hueOffset = (timestamp * 0.05 * colorSpeed) % 360;

    // Initialize previous heights if needed
    if (this.#previousHeights.length !== barCount) {
      this.#previousHeights = new Array(barCount).fill(0);
    }

    // Calculate bar heights from frequency data
    const step = Math.floor(frequencyData.length / barCount);
    const smoothing = this.options.smoothing ?? 0.75;

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;

      // Normalize to 0-1 and apply smoothing
      const targetHeight = (average / 255) * height * 0.9;
      const smoothedHeight = this.#previousHeights[i] * smoothing + targetHeight * (1 - smoothing);
      this.#previousHeights[i] = smoothedHeight;

      const x = i * totalBarWidth + gapWidth / 2;
      const barHeight = Math.max(2, smoothedHeight);
      const y = this.options.mirror ? (height - barHeight) / 2 : height - barHeight;

      // Calculate rainbow color for this bar
      const hue = (this.#hueOffset + (i / barCount) * 360) % 360;
      const saturation = 80 + (average / 255) * 20;
      const lightness = 45 + (average / 255) * 15;

      // Create gradient with the rainbow color
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
      gradient.addColorStop(1, `hsl(${(hue + 30) % 360}, ${saturation}%, ${lightness + 10}%)`);

      ctx.fillStyle = gradient;

      // Draw bar (rounded or rectangular)
      if (roundedBars) {
        this.#drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.min(barWidth / 4, 8));
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      // Draw mirrored bar if enabled
      if (this.options.mirror) {
        if (roundedBars) {
          this.#drawRoundedRect(ctx, x, height / 2, barWidth, barHeight, Math.min(barWidth / 4, 8));
        } else {
          ctx.fillRect(x, height / 2, barWidth, barHeight);
        }
      }
    }

    // Restore alpha
    ctx.globalAlpha = previousAlpha;

    // Restore transform
    this.restoreTransform(ctx, data);

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  /**
   * Draw a rounded rectangle
   */
  #drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height < 1) return;

    const r = Math.min(radius, height / 2, width / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}

// Export as default
export default RainbowBarsVisualizer;
