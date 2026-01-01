import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Bar spectrum visualizer
 * Displays frequency data as vertical bars
 */
export class BarVisualizer extends BaseVisualizer {
  readonly id = 'bars';
  readonly name = 'Bars';

  private previousHeights: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 64,
      barGap: 0.2,
      ...options,
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    const barCount = this.options.barCount!;
    const barGap = this.options.barGap!;
    const totalBarWidth = width / barCount;
    const barWidth = totalBarWidth * (1 - barGap);
    const gapWidth = totalBarWidth * barGap;

    // Initialize previous heights if needed
    if (this.previousHeights.length !== barCount) {
      this.previousHeights = new Array(barCount).fill(0);
    }

    // Calculate bar heights from frequency data
    const step = Math.floor(frequencyData.length / barCount);
    const smoothing = this.options.smoothing!;

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;

      // Normalize to 0-1 and apply smoothing
      const targetHeight = (average / 255) * height;
      const smoothedHeight =
        this.previousHeights[i] * smoothing + targetHeight * (1 - smoothing);
      this.previousHeights[i] = smoothedHeight;

      const x = i * totalBarWidth + gapWidth / 2;
      const barHeight = smoothedHeight;
      const y = this.options.mirror ? (height - barHeight) / 2 : height - barHeight;

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, this.options.primaryColor!);
      gradient.addColorStop(1, this.options.secondaryColor!);

      ctx.fillStyle = gradient;

      // Draw rounded bar
      this.drawRoundedRect(ctx, x, y, barWidth, barHeight, barWidth / 4);

      // Draw mirrored bar
      if (this.options.mirror) {
        this.drawRoundedRect(
          ctx,
          x,
          height / 2,
          barWidth,
          barHeight,
          barWidth / 4
        );
      }
    }

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  /**
   * Draw a rounded rectangle
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
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
