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
        colorScheme: 'rainbow', // 'rainbow', 'heat', 'cool', 'grayscale'
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

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;

    const scrollSpeed = this.options.custom?.scrollSpeed as number;
    const colorScheme = this.options.custom?.colorScheme as string;
    const orientation = this.options.custom?.orientation as string;
    const frequencyRange = this.options.custom?.frequencyRange as string;

    // Get frequency range to display
    let startIdx = 0;
    let endIdx = frequencyData.length;

    if (frequencyRange === 'bass') {
      endIdx = Math.floor(frequencyData.length * 0.1);
    } else if (frequencyRange === 'mid') {
      startIdx = Math.floor(frequencyData.length * 0.1);
      endIdx = Math.floor(frequencyData.length * 0.5);
    } else if (frequencyRange === 'high') {
      startIdx = Math.floor(frequencyData.length * 0.5);
    }

    const rangeLength = endIdx - startIdx;

    if (this.historyCtx && this.historyCanvas) {
      // Scroll the history
      if (orientation === 'horizontal') {
        // Shift left
        const imageData = this.historyCtx.getImageData(scrollSpeed, 0, width - scrollSpeed, height);
        this.historyCtx.putImageData(imageData, 0, 0);

        // Draw new column on the right
        for (let i = 0; i < rangeLength; i++) {
          const freqIndex = startIdx + Math.floor((i / rangeLength) * (endIdx - startIdx));
          const value = frequencyData[freqIndex];
          const y = (i / rangeLength) * height;
          const barHeight = Math.max(1, height / rangeLength);

          this.historyCtx.fillStyle = this.getColor(value, colorScheme);
          this.historyCtx.fillRect(width - scrollSpeed, y, scrollSpeed, barHeight);
        }
      } else {
        // Vertical orientation - shift up
        const imageData = this.historyCtx.getImageData(0, scrollSpeed, width, height - scrollSpeed);
        this.historyCtx.putImageData(imageData, 0, 0);

        // Draw new row at the bottom
        for (let i = 0; i < rangeLength; i++) {
          const freqIndex = startIdx + Math.floor((i / rangeLength) * (endIdx - startIdx));
          const value = frequencyData[freqIndex];
          const x = (i / rangeLength) * width;
          const barWidth = Math.max(1, width / rangeLength);

          this.historyCtx.fillStyle = this.getColor(value, colorScheme);
          this.historyCtx.fillRect(x, height - scrollSpeed, barWidth, scrollSpeed);
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

      case 'grayscale':
        const gray = Math.floor(normalized * 255);
        return `rgb(${gray}, ${gray}, ${gray})`;

      case 'rainbow':
      default:
        // Rainbow spectrum
        const hue = normalized * 270; // 0 to 270 degrees (blue to red)
        const saturation = 100;
        const lightness = 50 + normalized * 30; // Brighter with higher values
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
  }

  destroy(): void {
    this.historyCanvas = null;
    this.historyCtx = null;
    this.historyWidth = 0;
    this.historyHeight = 0;
    super.destroy();
  }
}
