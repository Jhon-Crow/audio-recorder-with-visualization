import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Spectrum gradient visualizer (inspired by Winamp)
 * Displays frequency data as filled gradient bars with smooth transitions
 */
export class SpectrumGradientVisualizer extends BaseVisualizer {
  readonly id = 'spectrum-gradient';
  readonly name = 'Spectrum Gradient';

  private previousHeights: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 128,
      barGap: 0.1,
      ...options,
      custom: {
        fillStyle: 'gradient', // 'gradient', 'solid', 'rainbow', 'custom'
        peakDots: true, // Show peak indicator dots
        peakFallSpeed: 0.5, // Peak fall speed
        gradientColors: ['#ff0000', '#ff7700', '#ffff00', '#00ff00'], // Bottom to top
        useCustomColors: false, // Use primary/secondary colors instead of preset gradient
        ...options.custom,
      },
    });
  }

  private peakHeights: number[] = [];

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;
    // Validate dimensions before drawing
    if (!this.isValidDimensions(width, height)) {
      return;
    }


    // Draw background
    this.drawBackground(ctx, data);

    // Apply layer effects to background
    this.applyLayerEffect(ctx, data);

    // Apply position offset
    this.applyTransform(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = visualizationAlpha;

    const barCount = this.options.barCount!;
    const barGap = this.options.barGap!;
    const totalBarWidth = width / barCount;
    const barWidth = totalBarWidth * (1 - barGap);
    const gapWidth = totalBarWidth * barGap;

    // Initialize arrays if needed
    if (this.previousHeights.length !== barCount) {
      this.previousHeights = new Array(barCount).fill(0);
      this.peakHeights = new Array(barCount).fill(0);
    }

    // Get frequency data slice based on frequencyWidth setting
    // Ensure we have at least barCount bins to prevent division by zero
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData, barCount);

    // Calculate bar heights from frequency data
    // Use Math.max(1, ...) to ensure step is never 0
    const step = Math.max(1, Math.floor(frequencyDataSlice.length / barCount));
    const peakFallSpeed = this.options.custom?.peakFallSpeed as number;
    const showPeaks = this.options.custom?.peakDots as boolean;
    const fillStyle = this.options.custom?.fillStyle as string;
    const gradientColors = this.options.custom?.gradientColors as string[];

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar using safe calculation
      const average = this.calculateBandAverage(frequencyDataSlice, i * step, step);

      // Apply sensitivity, normalize to 0-1 and apply ADSR envelope smoothing
      const sensitiveAverage = this.applySensitivity(average);
      const targetHeight = (sensitiveAverage / 255) * height;
      const smoothedHeight = this.applyADSRSmoothing(this.previousHeights[i], targetHeight);
      this.previousHeights[i] = smoothedHeight;

      // Update peak
      if (smoothedHeight > this.peakHeights[i]) {
        this.peakHeights[i] = smoothedHeight;
      } else {
        this.peakHeights[i] -= peakFallSpeed;
        if (this.peakHeights[i] < 0) this.peakHeights[i] = 0;
      }

      const x = i * totalBarWidth + gapWidth / 2;
      const barHeight = smoothedHeight;
      const y = this.options.mirror ? (height - barHeight) / 2 : height - barHeight;

      // Draw bar with gradient fill
      const useCustomColors = this.options.custom?.useCustomColors as boolean;

      if (fillStyle === 'rainbow') {
        // Rainbow mode: color based on frequency position
        const hue = (i / barCount) * 360;
        const gradient = ctx.createLinearGradient(x, height, x, y);
        gradient.addColorStop(0, `hsl(${hue}, 100%, 30%)`);
        gradient.addColorStop(0.5, `hsl(${hue}, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 70%)`);
        ctx.fillStyle = gradient;
      } else if (fillStyle === 'solid') {
        // Solid color
        ctx.fillStyle = this.options.primaryColor!;
      } else if (fillStyle === 'custom' || useCustomColors) {
        // Custom mode: use primary/secondary colors
        const gradient = ctx.createLinearGradient(x, height, x, y);
        gradient.addColorStop(0, this.options.primaryColor!);
        gradient.addColorStop(1, this.options.secondaryColor!);
        ctx.fillStyle = gradient;
      } else {
        // Default gradient using preset colors
        const gradient = ctx.createLinearGradient(x, height, x, y);
        if (gradientColors && gradientColors.length > 0) {
          gradientColors.forEach((color, idx) => {
            gradient.addColorStop(idx / (gradientColors.length - 1), color);
          });
        } else {
          gradient.addColorStop(0, this.options.primaryColor!);
          gradient.addColorStop(1, this.options.secondaryColor!);
        }
        ctx.fillStyle = gradient;
      }

      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw mirrored bar
      if (this.options.mirror) {
        ctx.fillRect(x, height / 2, barWidth, barHeight);
      }

      // Draw peak indicator
      if (showPeaks && this.peakHeights[i] > 0) {
        const peakY = this.options.mirror
          ? (height - this.peakHeights[i]) / 2 - 2
          : height - this.peakHeights[i] - 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, peakY, barWidth, 2);

        if (this.options.mirror) {
          ctx.fillRect(x, height / 2 + this.peakHeights[i], barWidth, 2);
        }
      }
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Restore transform
    this.restoreTransform(ctx, data);

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.previousHeights = [];
    this.peakHeights = [];
    super.destroy();
  }
}
