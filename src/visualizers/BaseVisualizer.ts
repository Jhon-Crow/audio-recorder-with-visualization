import { Visualizer, VisualizerOptions, VisualizationData } from '../types';

/**
 * Base class for all visualizers
 * Provides common functionality and default implementations
 */
export abstract class BaseVisualizer implements Visualizer {
  abstract readonly id: string;
  abstract readonly name: string;

  protected canvas: HTMLCanvasElement | null = null;
  protected options: VisualizerOptions;
  protected backgroundImageElement: HTMLImageElement | null = null;
  protected foregroundImageElement: HTMLImageElement | null = null;
  protected imageLoadPromises: Promise<void>[] = [];

  constructor(options: VisualizerOptions = {}) {
    this.options = {
      primaryColor: '#00ff88',
      secondaryColor: '#0088ff',
      backgroundColor: '#000000',
      drawBackground: true,
      lineWidth: 2,
      barCount: 64,
      barGap: 0.2,
      mirror: false,
      smoothing: 0.8,
      foregroundAlpha: 1,
      visualizationAlpha: 1,
      offsetX: 0,
      offsetY: 0,
      ...options,
    };
  }

  /**
   * Initialize the visualizer
   * @returns Promise that resolves when initialization is complete (including image loading)
   */
  async init(canvas: HTMLCanvasElement, options?: VisualizerOptions): Promise<void> {
    this.canvas = canvas;
    if (options) {
      this.options = { ...this.options, ...options };
    }
    // Always load images if there are any in this.options (from constructor or passed options)
    // This ensures images are loaded whether they came from the constructor or init()
    if (this.options.backgroundImage || this.options.foregroundImage) {
      await this.loadImages();
    }
  }

  /**
   * Load background and foreground images if specified
   */
  protected async loadImages(): Promise<void> {
    this.imageLoadPromises = [];

    if (this.options.backgroundImage) {
      this.imageLoadPromises.push(this.loadImage(this.options.backgroundImage, 'background'));
    }

    if (this.options.foregroundImage) {
      this.imageLoadPromises.push(this.loadImage(this.options.foregroundImage, 'foreground'));
    }

    await Promise.all(this.imageLoadPromises);
  }

  /**
   * Load a single image
   */
  protected loadImage(source: HTMLImageElement | string, type: 'background' | 'foreground'): Promise<void> {
    return new Promise((resolve) => {
      if (source instanceof HTMLImageElement) {
        if (type === 'background') {
          this.backgroundImageElement = source;
        } else {
          this.foregroundImageElement = source;
        }
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (type === 'background') {
          this.backgroundImageElement = img;
        } else {
          this.foregroundImageElement = img;
        }
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load ${type} image:`, source);
        resolve(); // Don't reject, just continue without the image
      };
      img.src = source;
    });
  }

  /**
   * Update visualizer options
   * @returns Promise that resolves when any image loading is complete
   */
  async setOptions(options: Partial<VisualizerOptions>): Promise<void> {
    const needsImageReload =
      options.backgroundImage !== undefined ||
      options.foregroundImage !== undefined;

    this.options = { ...this.options, ...options };

    if (needsImageReload) {
      await this.loadImages();
    }
  }

  /**
   * Draw background (color or image)
   */
  protected drawBackground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    if (!this.options.drawBackground) {
      return;
    }

    if (this.backgroundImageElement) {
      // Draw background image, scaled to cover
      this.drawImageCover(ctx, this.backgroundImageElement, data.width, data.height);
    } else {
      ctx.fillStyle = this.options.backgroundColor!;
      ctx.fillRect(0, 0, data.width, data.height);
    }
  }

  /**
   * Draw foreground image if specified
   */
  protected drawForeground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    if (this.foregroundImageElement) {
      const alpha = this.options.foregroundAlpha ?? 1;
      const previousAlpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      this.drawImageCover(ctx, this.foregroundImageElement, data.width, data.height);
      ctx.globalAlpha = previousAlpha;
    }
  }

  /**
   * Draw an image to cover the canvas (like CSS background-size: cover)
   */
  protected drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imgRatio > canvasRatio) {
      // Image is wider than canvas
      drawHeight = height;
      drawWidth = height * imgRatio;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Image is taller than canvas
      drawWidth = width;
      drawHeight = width / imgRatio;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  /**
   * Create a gradient
   */
  protected createGradient(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): CanvasGradient {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, this.options.primaryColor!);
    gradient.addColorStop(1, this.options.secondaryColor!);
    return gradient;
  }

  /**
   * Apply position offset transformation to context
   * Call this before drawing visualization, and call restoreTransform() after
   */
  protected applyTransform(ctx: CanvasRenderingContext2D): void {
    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;

    if (offsetX !== 0 || offsetY !== 0) {
      ctx.save();
      ctx.translate(offsetX, offsetY);
    }
  }

  /**
   * Restore context transformation state
   * Call this after drawing visualization if applyTransform() was called
   */
  protected restoreTransform(ctx: CanvasRenderingContext2D): void {
    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;

    if (offsetX !== 0 || offsetY !== 0) {
      ctx.restore();
    }
  }

  /**
   * Abstract draw method - must be implemented by subclasses
   */
  abstract draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void;

  /**
   * Clean up resources
   */
  destroy(): void {
    this.canvas = null;
    this.backgroundImageElement = null;
    this.foregroundImageElement = null;
    this.imageLoadPromises = [];
  }
}
