import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Grid Visualizer
 * Grid of squares that react to different frequency bands
 */
export class GridVisualizer extends BaseVisualizer {
  readonly id = 'grid';
  readonly name = 'Grid';

  private previousIntensities: number[][] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      ...options,
      custom: {
        gridCols: 16, // Number of columns
        gridRows: 12, // Number of rows
        cellGap: 4, // Gap between cells in pixels
        reactToFrequency: true, // React to frequency or random
        glowEffect: true, // Enable glow effect
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

    // Apply layer effects to background
    this.applyLayerEffect(ctx, data);

    // Apply position offset and scale
    this.applyTransform(ctx, data);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;

    const gridCols = this.options.custom?.gridCols as number;
    const gridRows = this.options.custom?.gridRows as number;
    const cellGap = this.options.custom?.cellGap as number;
    const reactToFrequency = this.options.custom?.reactToFrequency as boolean;
    const glowEffect = this.options.custom?.glowEffect as boolean;

    const cellWidth = (width - (gridCols + 1) * cellGap) / gridCols;
    const cellHeight = (height - (gridRows + 1) * cellGap) / gridRows;

    // Initialize previous intensities if needed
    if (
      this.previousIntensities.length !== gridRows ||
      this.previousIntensities[0]?.length !== gridCols
    ) {
      this.previousIntensities = [];
      for (let row = 0; row < gridRows; row++) {
        this.previousIntensities[row] = new Array(gridCols).fill(0);
      }
    }

    const smoothing = this.options.smoothing!;
    const totalCells = gridCols * gridRows;

    // Draw grid cells
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const x = col * (cellWidth + cellGap) + cellGap;
        const y = row * (cellHeight + cellGap) + cellGap;

        // Calculate intensity for this cell
        let intensity: number;
        if (reactToFrequency) {
          const cellIndex = row * gridCols + col;
          const freqIndex = Math.floor((cellIndex / totalCells) * frequencyData.length);
          const rawValue = frequencyData[freqIndex];
          const sensitiveValue = this.applySensitivity(rawValue);
          intensity = sensitiveValue / 255;
        } else {
          // Random pattern based on overall audio
          const avgIntensity =
            frequencyData.reduce((sum, val) => sum + this.applySensitivity(val), 0) / (frequencyData.length * 255);
          intensity = Math.random() * avgIntensity;
        }

        // Apply smoothing
        const smoothedIntensity =
          this.previousIntensities[row][col] * smoothing + intensity * (1 - smoothing);
        this.previousIntensities[row][col] = smoothedIntensity;

        // Calculate color
        const hue = ((row * gridCols + col) / totalCells) * 360;
        const lightness = 30 + smoothedIntensity * 50;
        const saturation = 60 + smoothedIntensity * 40;

        // Create gradient for each cell
        const gradient = ctx.createLinearGradient(x, y, x + cellWidth, y + cellHeight);
        gradient.addColorStop(0, this.options.primaryColor!);
        gradient.addColorStop(0.5, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
        gradient.addColorStop(1, this.options.secondaryColor!);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = visualizationAlpha * (0.3 + smoothedIntensity * 0.7);

        // Apply glow effect
        if (glowEffect && smoothedIntensity > 0.5) {
          ctx.shadowBlur = 20 * smoothedIntensity;
          ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        }

        // Draw rounded rectangle
        const radius = Math.min(cellWidth, cellHeight) * 0.2;
        this.drawRoundedRect(ctx, x, y, cellWidth, cellHeight, radius);

        // Reset shadow
        if (glowEffect) {
          ctx.shadowBlur = 0;
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

  destroy(): void {
    this.previousIntensities = [];
    super.destroy();
  }
}
