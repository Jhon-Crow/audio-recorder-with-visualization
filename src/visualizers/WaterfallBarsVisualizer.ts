import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Waterfall Bars Visualizer
 * Bars that cascade down like a waterfall, showing frequency history
 */
export class WaterfallBarsVisualizer extends BaseVisualizer {
  readonly id = 'waterfall-bars';
  readonly name = 'Waterfall Bars';

  private history: number[][] = [];
  private maxHistoryLength = 50;

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 64,
      barGap: 0.1,
      ...options,
      custom: {
        scrollSpeed: 1, // Pixels to scroll per frame
        historyLength: 50, // Number of history frames to keep
        fadeEffect: true, // Fade older bars
        ...options.custom,
      },
    });
    this.maxHistoryLength = (this.options.custom?.historyLength as number) ?? 50;
  }

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

    // Apply position offset and scale
    this.applyTransform(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;

    const barCount = this.options.barCount!;
    const barGap = this.options.barGap!;
    const barWidth = (width / barCount) * (1 - barGap);
    const gapWidth = (width / barCount) * barGap;
    const fadeEffect = this.options.custom?.fadeEffect as boolean;

    // Add current frequency data to history
    const currentData: number[] = [];
    const step = Math.floor(frequencyData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;
      currentData.push(this.applySensitivity(average));
    }

    this.history.unshift(currentData);

    // Limit history length
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(0, this.maxHistoryLength);
    }

    // Draw bars from history
    const barHeight = height / this.maxHistoryLength;

    for (let row = 0; row < this.history.length; row++) {
      const rowData = this.history[row];
      const y = row * barHeight;
      const age = row / this.history.length;

      for (let i = 0; i < barCount; i++) {
        const value = rowData[i];
        const x = i * (barWidth + gapWidth);

        // Calculate color based on frequency value
        const intensity = value / 255;
        const hue = (i / barCount) * 360;
        const lightness = 30 + intensity * 40;
        const alpha = fadeEffect ? (1 - age) * visualizationAlpha : visualizationAlpha;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, y, x + barWidth, y);
        gradient.addColorStop(0, this.options.primaryColor!);
        gradient.addColorStop(0.5, `hsl(${hue}, 80%, ${lightness}%)`);
        gradient.addColorStop(1, this.options.secondaryColor!);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = alpha;

        ctx.fillRect(x, y, barWidth, barHeight);
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
    this.history = [];
    super.destroy();
  }
}
