import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Spectrogram visualizer (waterfall display)
 * Displays frequency data over time as a scrolling colorful image
 */
export class SpectrogramVisualizer extends BaseVisualizer {
  readonly id = 'spectrogram';
  readonly name = 'Spectrogram';

  private historyCanvas: HTMLCanvasElement | null = null;
  private historyCtx: CanvasRenderingContext2D | null = null;
  private historyWidth = 0;
  private historyHeight = 0;

  constructor(options: VisualizerOptions = {}) {
    super({
      ...options,
      custom: {
        scrollSpeed: 1, // Pixels to scroll per frame
        colorScheme: 'rainbow', // 'rainbow', 'heat', 'cool', 'grayscale', 'custom'
        orientation: 'vertical', // 'vertical' (time flows down), 'horizontal' (time flows left)
        frequencyRange: 'full', // 'full', 'bass', 'mid', 'high'
        ...options.custom,
      },
    });
  }

  async init(canvas: HTMLCanvasElement, options?: VisualizerOptions): Promise<void> {
    await super.init(canvas, options);

    // Create history canvas for scrolling effect
    this.historyCanvas = document.createElement('canvas');
    this.historyCtx = this.historyCanvas.getContext('2d', { willReadFrequently: true });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;

    // Validate dimensions before drawing
    if (!this.isValidDimensions(width, height)) {
      return;
    }

    // Initialize or resize history canvas if needed
    if (!this.historyCanvas || !this.historyCtx || this.historyWidth !== width || this.historyHeight !== height) {
      this.historyWidth = width;
      this.historyHeight = height;
      if (this.historyCanvas) {
        this.historyCanvas.width = width;
        this.historyCanvas.height = height;
      }
    }

    // Draw background
    this.drawBackground(ctx, data);

    // Apply layer effects to background
    this.applyLayerEffect(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;

    const scrollSpeed = this.options.custom?.scrollSpeed as number;
    const colorScheme = this.options.custom?.colorScheme as string;
    const orientation = this.options.custom?.orientation as string;
    const frequencyRange = this.options.custom?.frequencyRange as string;

    // Get frequency data slice based on frequencyWidth setting
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData);

    // Get frequency range to display
    let startIdx = 0;
    let endIdx = frequencyDataSlice.length;

    if (frequencyRange === 'bass') {
      endIdx = Math.floor(frequencyDataSlice.length * 0.1);
    } else if (frequencyRange === 'mid') {
      startIdx = Math.floor(frequencyDataSlice.length * 0.1);
      endIdx = Math.floor(frequencyDataSlice.length * 0.5);
    } else if (frequencyRange === 'high') {
      startIdx = Math.floor(frequencyDataSlice.length * 0.5);
    }

    const rangeLength = endIdx - startIdx;

    if (this.historyCtx && this.historyCanvas && width > 0 && height > 0 && scrollSpeed > 0) {
      // Scroll the history
      if (orientation === 'horizontal') {
        // Shift left
        const scrollWidth = Math.min(scrollSpeed, width);
        if (width > scrollWidth && height > 0) {
          const imageData = this.historyCtx.getImageData(scrollWidth, 0, width - scrollWidth, height);
          this.historyCtx.putImageData(imageData, 0, 0);
        }

        // Draw new column on the right
        for (let i = 0; i < rangeLength; i++) {
          const freqIndex = startIdx + Math.floor((i / rangeLength) * (endIdx - startIdx));
          const value = frequencyDataSlice[freqIndex];
          const sensitiveValue = this.applySensitivity(value);
          const y = (i / rangeLength) * height;
          const barHeight = Math.max(1, height / rangeLength);

          this.historyCtx.fillStyle = this.getColor(sensitiveValue, colorScheme);
          this.historyCtx.fillRect(width - scrollWidth, y, scrollWidth, barHeight);
        }
      } else {
        // Vertical orientation - shift up
        const scrollHeight = Math.min(scrollSpeed, height);
        if (height > scrollHeight && width > 0) {
          const imageData = this.historyCtx.getImageData(0, scrollHeight, width, height - scrollHeight);
          this.historyCtx.putImageData(imageData, 0, 0);
        }

        // Draw new row at the bottom
        for (let i = 0; i < rangeLength; i++) {
          const freqIndex = startIdx + Math.floor((i / rangeLength) * (endIdx - startIdx));
          const value = frequencyDataSlice[freqIndex];
          const sensitiveValue = this.applySensitivity(value);
          const x = (i / rangeLength) * width;
          const barWidth = Math.max(1, width / rangeLength);

          this.historyCtx.fillStyle = this.getColor(sensitiveValue, colorScheme);
          this.historyCtx.fillRect(x, height - scrollHeight, barWidth, scrollHeight);
        }
      }

      // Draw the history canvas to the main canvas
      ctx.globalAlpha = visualizationAlpha;
      ctx.drawImage(this.historyCanvas, 0, 0);
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  /**
   * Get color for a frequency value based on color scheme
   */
  private getColor(value: number, scheme: string): string {
    const normalized = value / 255;

    switch (scheme) {
      case 'heat':
        // Black -> Red -> Yellow -> White
        if (normalized < 0.33) {
          const t = normalized / 0.33;
          return `rgb(${Math.floor(t * 255)}, 0, 0)`;
        } else if (normalized < 0.66) {
          const t = (normalized - 0.33) / 0.33;
          return `rgb(255, ${Math.floor(t * 255)}, 0)`;
        } else {
          const t = (normalized - 0.66) / 0.34;
          return `rgb(255, 255, ${Math.floor(t * 255)})`;
        }

      case 'cool':
        // Black -> Blue -> Cyan -> White
        if (normalized < 0.33) {
          const t = normalized / 0.33;
          return `rgb(0, 0, ${Math.floor(t * 255)})`;
        } else if (normalized < 0.66) {
          const t = (normalized - 0.33) / 0.33;
          return `rgb(0, ${Math.floor(t * 255)}, 255)`;
        } else {
          const t = (normalized - 0.66) / 0.34;
          return `rgb(${Math.floor(t * 255)}, 255, 255)`;
        }

      case 'grayscale': {
        const gray = Math.floor(normalized * 255);
        return `rgb(${gray}, ${gray}, ${gray})`;
      }

      case 'custom':
        // Use primary and secondary colors with interpolation
        return this.interpolateColors(this.options.primaryColor!, this.options.secondaryColor!, normalized);

      case 'rainbow':
      default: {
        // Rainbow spectrum
        const hue = normalized * 270; // 0 to 270 degrees (blue to red)
        const saturation = 100;
        const lightness = 50 + normalized * 30; // Brighter with higher values
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }
    }
  }

  /**
   * Interpolate between two hex colors
   */
  private interpolateColors(color1: string, color2: string, t: number): string {
    // Parse hex colors
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');

    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);

    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);

    // Interpolate
    const r = Math.floor(r1 + (r2 - r1) * t);
    const g = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  destroy(): void {
    this.historyCanvas = null;
    this.historyCtx = null;
    this.historyWidth = 0;
    this.historyHeight = 0;
    super.destroy();
  }
}
