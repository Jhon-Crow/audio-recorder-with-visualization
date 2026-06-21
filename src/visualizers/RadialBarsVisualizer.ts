import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Radial bars visualizer
 * Displays frequency data as bars arranged in a radial pattern
 */
export class RadialBarsVisualizer extends BaseVisualizer {
  readonly id = 'radial-bars';
  readonly name = 'Radial Bars';

  private previousHeights: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 64,
      ...options,
      custom: {
        startRadius: 0.2, // Inner circle radius as fraction of min dimension
        endRadius: 0.45, // Outer circle radius as fraction of min dimension
        roundedCaps: true, // Use rounded line caps
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;
    // Validate dimensions before drawing
    if (!this.isValidDimensions(width, height)) {
      return;
    }


    // Draw background
    this.drawBackground(ctx, data);

    // Apply layer effects
    this.applyLayerEffect(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height);

    const barCount = this.options.barCount!;
    const startRadius = (this.options.custom?.startRadius as number) * minDimension;
    const endRadius = (this.options.custom?.endRadius as number) * minDimension;
    const roundedCaps = this.options.custom?.roundedCaps as boolean;

    // Initialize previous heights if needed
    if (this.previousHeights.length !== barCount) {
      this.previousHeights = new Array(barCount).fill(0);
    }

    // Get frequency data slice based on frequencyWidth setting
    // Ensure we have at least barCount bins to prevent division by zero
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData, barCount);

    // Calculate bar heights from frequency data
    // Use Math.max(1, ...) to ensure step is never 0
    const step = Math.max(1, Math.floor(frequencyDataSlice.length / barCount));
    const angleStep = (Math.PI * 2) / barCount;

    // Create color gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, this.options.primaryColor!);
    gradient.addColorStop(1, this.options.secondaryColor!);

    ctx.save();
    ctx.translate(centerX, centerY);

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar using safe calculation
      const average = this.calculateBandAverage(frequencyDataSlice, i * step, step);

      // Apply sensitivity, normalize and apply ADSR envelope smoothing
      const sensitiveAverage = this.applySensitivity(average);
      const targetHeight = (sensitiveAverage / 255) * (endRadius - startRadius);
      const smoothedHeight = this.applyADSRSmoothing(this.previousHeights[i], targetHeight);
      this.previousHeights[i] = smoothedHeight;

      const angle = i * angleStep - Math.PI / 2;
      const barLength = smoothedHeight;

      // Calculate bar position
      const x1 = Math.cos(angle) * startRadius;
      const y1 = Math.sin(angle) * startRadius;
      const x2 = Math.cos(angle) * (startRadius + barLength);
      const y2 = Math.sin(angle) * (startRadius + barLength);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(2, (angleStep * startRadius) * 0.9);
      ctx.lineCap = roundedCaps ? 'round' : 'butt';
      ctx.globalAlpha = visualizationAlpha;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.previousHeights = [];
    super.destroy();
  }
}
