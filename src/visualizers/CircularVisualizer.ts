import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Circular spectrum visualizer
 * Displays frequency data as bars radiating from a center point
 */
export class CircularVisualizer extends BaseVisualizer {
  readonly id = 'circular';
  readonly name = 'Circular';

  private previousHeights: number[] = [];
  private rotation = 0;

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 128,
      ...options,
      custom: {
        innerRadius: 0.3, // Inner radius as fraction of min dimension
        maxBarHeight: 0.35, // Max bar height as fraction of min dimension
        rotationSpeed: 0, // Rotation speed in radians per frame
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    const centerX = width / 2;
    const centerY = height / 2;
    const minDimension = Math.min(width, height);

    const barCount = this.options.barCount!;
    const innerRadius = (this.options.custom?.innerRadius as number) * minDimension;
    const maxBarHeight = (this.options.custom?.maxBarHeight as number) * minDimension;
    const rotationSpeed = this.options.custom?.rotationSpeed as number;

    // Update rotation
    this.rotation += rotationSpeed;

    // Initialize previous heights if needed
    if (this.previousHeights.length !== barCount) {
      this.previousHeights = new Array(barCount).fill(0);
    }

    // Calculate bar heights from frequency data
    const step = Math.floor(frequencyData.length / barCount);
    const smoothing = this.options.smoothing!;
    const angleStep = (Math.PI * 2) / barCount;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;

      // Normalize and apply smoothing
      const targetHeight = (average / 255) * maxBarHeight;
      const smoothedHeight =
        this.previousHeights[i] * smoothing + targetHeight * (1 - smoothing);
      this.previousHeights[i] = smoothedHeight;

      const angle = i * angleStep - Math.PI / 2;
      const barHeight = smoothedHeight;

      // Calculate bar position
      const x1 = Math.cos(angle) * innerRadius;
      const y1 = Math.sin(angle) * innerRadius;
      const x2 = Math.cos(angle) * (innerRadius + barHeight);
      const y2 = Math.sin(angle) * (innerRadius + barHeight);

      // Calculate color based on position
      const hue = (i / barCount) * 360;
      const saturation = 80;
      const lightness = 50 + (average / 255) * 20;

      ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.lineWidth = Math.max(1, (angleStep * innerRadius) * 0.8);
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw mirrored bar
      if (this.options.mirror) {
        const x1Mirror = Math.cos(angle) * (innerRadius - barHeight * 0.5);
        const y1Mirror = Math.sin(angle) * (innerRadius - barHeight * 0.5);

        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1Mirror, y1Mirror);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = this.options.backgroundColor!;
    ctx.fill();

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
