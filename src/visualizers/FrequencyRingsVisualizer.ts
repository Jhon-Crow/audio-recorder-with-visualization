import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Frequency rings visualizer
 * Displays frequency data as concentric rings
 */
export class FrequencyRingsVisualizer extends BaseVisualizer {
  readonly id = 'frequency-rings';
  readonly name = 'Frequency Rings';

  private previousValues: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      ...options,
      custom: {
        ringCount: 5, // Number of frequency bands to show as rings
        maxRadius: 0.45, // Maximum radius as fraction of min dimension
        ringThickness: 8, // Thickness of each ring
        pulseEffect: true, // Enable pulsing effect
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
    const previousAlpha = ctx.globalAlpha;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height);

    const ringCount = this.options.custom?.ringCount as number;
    const maxRadius = (this.options.custom?.maxRadius as number) * minDimension;
    const ringThickness = this.options.custom?.ringThickness as number;
    const pulseEffect = this.options.custom?.pulseEffect as boolean;

    // Initialize previous values if needed
    if (this.previousValues.length !== ringCount) {
      this.previousValues = new Array(ringCount).fill(0);
    }

    // Get frequency data slice based on frequencyWidth setting
    // Ensure we have at least ringCount bins to prevent division by zero
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData, ringCount);

    // Use Math.max(1, ...) to ensure bandSize is never 0
    const bandSize = Math.max(1, Math.floor(frequencyDataSlice.length / ringCount));

    // Calculate ring values with ADSR envelope smoothing
    for (let i = 0; i < ringCount; i++) {
      // Use safe calculation to average frequency values
      const average = this.calculateBandAverage(frequencyDataSlice, i * bandSize, bandSize);
      const sensitiveAverage = this.applySensitivity(average);
      const targetValue = sensitiveAverage / 255;
      this.previousValues[i] = this.applyADSRSmoothing(this.previousValues[i], targetValue);
    }

    ctx.save();
    ctx.translate(centerX, centerY);

    // Draw rings from outside to inside
    for (let i = ringCount - 1; i >= 0; i--) {
      const value = this.previousValues[i];
      const radiusFraction = (ringCount - i) / ringCount;
      const baseRadius = maxRadius * radiusFraction;
      const radius = pulseEffect ? baseRadius * (0.8 + value * 0.4) : baseRadius;

      // Create gradient for this ring
      const gradient = ctx.createRadialGradient(0, 0, radius - ringThickness, 0, 0, radius);

      // Interpolate between primary and secondary colors
      gradient.addColorStop(0, this.options.primaryColor!);
      gradient.addColorStop(1, this.options.secondaryColor!);

      ctx.globalAlpha = visualizationAlpha * (0.5 + value * 0.5);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = ringThickness;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw inner glow
      ctx.globalAlpha = visualizationAlpha * value * 0.3;
      ctx.strokeStyle = this.options.primaryColor!;
      ctx.lineWidth = ringThickness * 0.5;
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = previousAlpha;

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.previousValues = [];
    super.destroy();
  }
}
