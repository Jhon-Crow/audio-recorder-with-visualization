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
  private centerImageElement: HTMLImageElement | null = null;

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 128,
      ...options,
      custom: {
        innerRadius: 0.3, // Inner radius as fraction of min dimension
        maxBarHeight: 0.35, // Max bar height as fraction of min dimension
        rotationSpeed: 0, // Rotation speed in radians per frame
        centerImage: null, // Center image for circular visualization
        centerImageOffsetX: 0, // Center image X offset for positioning
        centerImageOffsetY: 0, // Center image Y offset for positioning
        centerImageZoom: 1, // Center image zoom level (1 = fit to circle)
        useColorGradient: false, // Use primary/secondary colors instead of rainbow
        ...options.custom,
      },
    });
  }

  async init(canvas: HTMLCanvasElement, options?: VisualizerOptions): Promise<void> {
    await super.init(canvas, options);
    if (this.options.custom?.centerImage) {
      await this.loadCenterImage(this.options.custom.centerImage as HTMLImageElement | string);
    }
  }

  private async loadCenterImage(source: HTMLImageElement | string): Promise<void> {
    return new Promise((resolve) => {
      if (source instanceof HTMLImageElement) {
        this.centerImageElement = source;
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.centerImageElement = img;
        resolve();
      };
      img.onerror = () => {
        console.warn('Failed to load center image:', source);
        resolve();
      };
      img.src = source;
    });
  }

  async setOptions(options: Partial<VisualizerOptions>): Promise<void> {
    await super.setOptions(options);
    if (options.custom?.centerImage !== undefined) {
      if (options.custom.centerImage) {
        await this.loadCenterImage(options.custom.centerImage as HTMLImageElement | string);
      } else {
        this.centerImageElement = null;
      }
    }
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

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const scale = this.options.scale ?? 1;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height) * scale;

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

    // Get frequency data slice based on frequencyWidth setting
    // Ensure we have at least barCount bins to prevent division by zero
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData, barCount);

    // Calculate bar heights from frequency data
    // Use Math.max(1, ...) to ensure step is never 0
    const step = Math.max(1, Math.floor(frequencyDataSlice.length / barCount));
    const angleStep = (Math.PI * 2) / barCount;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar using safe calculation
      const average = this.calculateBandAverage(frequencyDataSlice, i * step, step);

      // Apply sensitivity, normalize and apply ADSR envelope smoothing
      const sensitiveAverage = this.applySensitivity(average);
      const targetHeight = (sensitiveAverage / 255) * maxBarHeight;
      const smoothedHeight = this.applyADSRSmoothing(this.previousHeights[i], targetHeight);
      this.previousHeights[i] = smoothedHeight;

      const angle = i * angleStep - Math.PI / 2;
      const barHeight = smoothedHeight;

      // Calculate bar position
      const x1 = Math.cos(angle) * innerRadius;
      const y1 = Math.sin(angle) * innerRadius;
      const x2 = Math.cos(angle) * (innerRadius + barHeight);
      const y2 = Math.sin(angle) * (innerRadius + barHeight);

      // Calculate color
      const useColorGradient = this.options.custom?.useColorGradient as boolean;
      if (useColorGradient && isFinite(innerRadius) && isFinite(maxBarHeight)) {
        // Use primary/secondary color gradient
        const primaryColor = this.options.primaryColor!;
        const secondaryColor = this.options.secondaryColor!;

        const x1 = Math.cos(angle) * innerRadius;
        const y1 = Math.sin(angle) * innerRadius;
        const x2 = Math.cos(angle) * (innerRadius + maxBarHeight);
        const y2 = Math.sin(angle) * (innerRadius + maxBarHeight);

        // Only create gradient if all values are finite
        if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2)) {
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, primaryColor);
          gradient.addColorStop(1, secondaryColor);
          ctx.strokeStyle = gradient;
        } else {
          // Fallback to primary color if gradient can't be created
          ctx.strokeStyle = primaryColor;
        }
      } else {
        // Use rainbow colors based on position
        const hue = (i / barCount) * 360;
        const saturation = 80;
        const lightness = 50 + (sensitiveAverage / 255) * 20;
        ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }

      ctx.lineWidth = Math.max(1, (angleStep * innerRadius) * 0.8);
      ctx.lineCap = 'round';
      ctx.globalAlpha = visualizationAlpha;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw mirrored bar
      if (this.options.mirror) {
        const x1Mirror = Math.cos(angle) * (innerRadius - barHeight * 0.5);
        const y1Mirror = Math.sin(angle) * (innerRadius - barHeight * 0.5);

        ctx.globalAlpha = visualizationAlpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1Mirror, y1Mirror);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw center circle or image
    ctx.globalAlpha = visualizationAlpha;
    const centerRadius = innerRadius * 0.9;

    if (this.centerImageElement) {
      // Draw center image with offset and zoom support
      ctx.save();

      // Enable high-quality image smoothing to prevent pixelation
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.beginPath();
      ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
      ctx.clip();

      // Get center image offset and zoom
      const imgOffsetX = (this.options.custom?.centerImageOffsetX as number) ?? 0;
      const imgOffsetY = (this.options.custom?.centerImageOffsetY as number) ?? 0;
      const imgZoom = (this.options.custom?.centerImageZoom as number) ?? 1;

      // Calculate zoomed size - use larger size for better quality when scaling down
      const zoomedSize = centerRadius * 2 * imgZoom;

      // Get the image to draw
      const img = this.centerImageElement;

      // For better quality, especially with .webp images, always use full source image
      // This ensures proper downscaling and prevents pixelation
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        centerX - zoomedSize / 2 + imgOffsetX,
        centerY - zoomedSize / 2 + imgOffsetY,
        zoomedSize,
        zoomedSize
      );

      ctx.restore();
    } else {
      // Draw center circle with background color
      ctx.beginPath();
      ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.options.backgroundColor!;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.centerImageElement = null;
    super.destroy();
  }
}
