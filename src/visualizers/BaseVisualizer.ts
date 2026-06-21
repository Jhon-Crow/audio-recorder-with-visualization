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

  // Image blink state
  private blinkActive: boolean = false;
  private blinkStartTime: number = 0;
  private blinkAnimationPhase: number = 0;

  constructor(options: VisualizerOptions = {}) {
    this.options = {
      primaryColor: '#00ff88',
      secondaryColor: '#0088ff',
      backgroundColor: '#000000',
      drawBackground: true,
      lineWidth: 2,
      barCount: 64,
      barGap: 0.2,
      frequencyWidth: 100,
      mirror: false,
      mirrorHorizontal: false,
      smoothing: 0.8,
      adsrAttack: 20,
      adsrDecay: 30,
      adsrSustain: 10,
      adsrRelease: 50,
      sensitivity: 1.0,
      foregroundAlpha: 1,
      visualizationAlpha: 1,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      backgroundSizeMode: 'cover',
      layerEffect: 'none',
      layerEffectIntensity: 50,
      imageBlinkEnabled: false,
      imageBlinkFrequencyRange: { min: 60, max: 250 },
      imageBlinkVolumeThreshold: 200,
      imageBlinkStyle: 'gradient-sweep',
      imageBlinkIntensity: 80,
      imageBlinkTarget: 'background',
      imageBlinkDuration: 150,
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
      // Deep merge the custom options to preserve existing custom settings from constructor
      if (options.custom && this.options.custom) {
        options = {
          ...options,
          custom: { ...this.options.custom, ...options.custom },
        };
      }
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

    // Deep merge the custom options to preserve existing custom settings
    if (options.custom && this.options.custom) {
      options = {
        ...options,
        custom: { ...this.options.custom, ...options.custom },
      };
    }

    this.options = { ...this.options, ...options };

    if (needsImageReload) {
      await this.loadImages();
    }
  }

  /**
   * Validate that dimensions are valid for drawing
   */
  protected isValidDimensions(width: number, height: number): boolean {
    return width > 0 && height > 0 && isFinite(width) && isFinite(height);
  }

  /**
   * Get a slice of frequency data based on frequencyWidth setting
   * @param frequencyData - Full frequency data array
   * @param minBins - Minimum number of bins to return (default: barCount or 1)
   * @returns Sliced frequency data array based on frequencyWidth percentage
   */
  protected getFrequencyDataSlice(frequencyData: Uint8Array, minBins?: number): Uint8Array {
    const frequencyWidth = this.options.frequencyWidth ?? 100;

    // If displaying full spectrum, return as-is
    if (frequencyWidth >= 100) {
      return frequencyData;
    }

    // Calculate how many bins to use (from the start, as lower frequencies are more important)
    // Ensure we have at least minBins bins to prevent division by zero issues
    const effectiveMinBins = minBins ?? this.options.barCount ?? 1;
    const calculatedBinCount = Math.floor((frequencyData.length * frequencyWidth) / 100);
    const binCount = Math.max(effectiveMinBins, calculatedBinCount);

    // Return a slice of the frequency data (capped at actual length)
    return frequencyData.slice(0, Math.min(binCount, frequencyData.length));
  }

  /**
   * Calculate the average value for a frequency band with safe division
   * @param frequencyData - Frequency data array
   * @param startIndex - Start index in the array
   * @param count - Number of bins to average (will be clamped to valid range)
   * @returns Average value (0-255) or 0 if no valid data
   */
  protected calculateBandAverage(frequencyData: Uint8Array, startIndex: number, count: number): number {
    if (count <= 0 || startIndex >= frequencyData.length) {
      return 0;
    }

    // Clamp count to available data
    const effectiveCount = Math.min(count, frequencyData.length - startIndex);
    if (effectiveCount <= 0) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < effectiveCount; i++) {
      sum += frequencyData[startIndex + i];
    }

    return sum / effectiveCount;
  }

  /**
   * Apply sensitivity multiplier to an audio data value
   * @param value - The raw audio data value (typically 0-255)
   * @returns The value multiplied by sensitivity and clamped to valid range (0-255)
   */
  protected applySensitivity(value: number): number {
    const sensitivity = this.options.sensitivity ?? 1.0;
    return Math.min(255, value * sensitivity);
  }

  /**
   * Check if frequency-based blink should be triggered
   * Analyzes frequency data in the specified range and checks against threshold
   */
  protected checkBlinkTrigger(data: VisualizationData): boolean {
    if (!this.options.imageBlinkEnabled) {
      return false;
    }

    const { frequencyData, sampleRate, fftSize } = data;
    const frequencyRange = this.options.imageBlinkFrequencyRange!;
    const threshold = this.options.imageBlinkVolumeThreshold!;

    // Convert frequency range (Hz) to bin indices
    // Each bin represents: sampleRate / fftSize Hz
    const binSize = sampleRate / fftSize;
    const minBin = Math.floor(frequencyRange.min / binSize);
    const maxBin = Math.ceil(frequencyRange.max / binSize);

    // Calculate average amplitude in the frequency range
    let sum = 0;
    let count = 0;
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      sum += frequencyData[i];
      count++;
    }

    const average = count > 0 ? sum / count : 0;

    // Trigger blink if average exceeds threshold
    return average > threshold;
  }

  /**
   * Update blink animation state based on trigger
   */
  protected updateBlinkState(triggered: boolean, timestamp: number): void {
    const duration = this.options.imageBlinkDuration!;

    if (triggered && !this.blinkActive) {
      // Start new blink
      this.blinkActive = true;
      this.blinkStartTime = timestamp;
      this.blinkAnimationPhase = 0;
    }

    if (this.blinkActive) {
      // Update animation phase (0 to 1 over duration)
      const elapsed = timestamp - this.blinkStartTime;
      this.blinkAnimationPhase = Math.min(1, elapsed / duration);

      // End blink when animation completes
      if (this.blinkAnimationPhase >= 1) {
        this.blinkActive = false;
        this.blinkAnimationPhase = 0;
      }
    }
  }

  /**
   * Apply image blink effect to a canvas
   */
  protected applyImageBlinkEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    phase: number
  ): void {
    if (phase <= 0) return;

    const style = this.options.imageBlinkStyle!;
    const intensity = this.options.imageBlinkIntensity! / 100;

    // Create effect overlay based on style
    switch (style) {
      case 'gradient-sweep':
        this.applyGradientSweepEffect(ctx, width, height, phase, intensity);
        break;
      case 'negative-flash':
        this.applyNegativeFlashEffect(ctx, width, height, phase, intensity);
        break;
      case 'brightness-pulse':
        this.applyBrightnessPulseEffect(ctx, width, height, phase, intensity);
        break;
      case 'color-flash':
        this.applyColorFlashEffect(ctx, width, height, phase, intensity);
        break;
    }
  }

  /**
   * Gradient sweep effect - animated gradient highlight
   */
  private applyGradientSweepEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    phase: number,
    intensity: number
  ): void {
    // Create an animated gradient that sweeps across the image
    // Phase 0->0.5: sweep in, 0.5->1: sweep out
    const sweepPhase = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    const alpha = sweepPhase * intensity * 0.6;

    // Diagonal gradient sweep from top-left to bottom-right
    const gradientStart = (phase - 0.5) * (width + height);
    const gradient = ctx.createLinearGradient(
      gradientStart, gradientStart,
      gradientStart + width, gradientStart + height
    );

    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.3, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Negative flash effect - invert colors briefly
   */
  private applyNegativeFlashEffect(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    phase: number,
    intensity: number
  ): void {
    // Quick flash effect: fade in and out
    const flashPhase = phase < 0.3 ? phase / 0.3 : (1 - phase) / 0.7;
    const effectStrength = flashPhase * intensity * 100;

    // Apply invert filter
    ctx.filter = `invert(${effectStrength}%)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
  }

  /**
   * Brightness pulse effect - brighten image
   */
  private applyBrightnessPulseEffect(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    phase: number,
    intensity: number
  ): void {
    // Smooth pulse: fade in and out
    const pulsePhase = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    const brightness = 100 + pulsePhase * intensity * 100;

    // Apply brightness filter
    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
  }

  /**
   * Color flash effect - flash with primary color
   */
  private applyColorFlashEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    phase: number,
    intensity: number
  ): void {
    // Quick color flash: fade in and out
    const flashPhase = phase < 0.3 ? phase / 0.3 : (1 - phase) / 0.7;
    const alpha = flashPhase * intensity * 0.5;

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.options.primaryColor!;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Draw background (color or image) with optional blink effect
   */
  protected drawBackground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    if (!this.options.drawBackground) {
      return;
    }

    // Check for blink trigger and update state
    const shouldBlink = this.options.imageBlinkEnabled &&
                        (this.options.imageBlinkTarget === 'background' || this.options.imageBlinkTarget === 'both');
    if (shouldBlink) {
      const triggered = this.checkBlinkTrigger(data);
      this.updateBlinkState(triggered, data.timestamp);
    }

    if (this.backgroundImageElement) {
      // Draw background image based on size mode
      const mode = this.options.backgroundSizeMode || 'cover';
      switch (mode) {
        case 'cover':
          this.drawImageCover(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        case 'contain':
          this.drawImageContain(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        case 'stretch':
          this.drawImageStretch(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        case 'tile':
          this.drawImageTile(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        case 'center':
          this.drawImageCenter(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        case 'custom':
          this.drawImageCustom(ctx, this.backgroundImageElement, data.width, data.height);
          break;
        default:
          this.drawImageCover(ctx, this.backgroundImageElement, data.width, data.height);
      }

      // Apply blink effect to background if active
      if (shouldBlink && this.blinkActive) {
        this.applyImageBlinkEffect(ctx, data.width, data.height, this.blinkAnimationPhase);
      }
    } else {
      ctx.fillStyle = this.options.backgroundColor!;
      ctx.fillRect(0, 0, data.width, data.height);
    }
  }

  /**
   * Apply layer effects to the background (between background and visualization)
   * This should be called AFTER drawBackground to apply effect to background only
   */
  protected applyLayerEffect(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const effect = this.options.layerEffect ?? 'none';
    if (effect === 'none') {
      return;
    }

    const intensity = this.options.layerEffectIntensity ?? 50;
    const { width, height } = data;

    // Create a temporary canvas to capture current background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Copy current canvas content (background) to temp canvas
    tempCtx.drawImage(ctx.canvas, 0, 0);

    // Build the CSS filter value
    let filterValue = '';
    switch (effect) {
      case 'blur':
        filterValue = `blur(${(intensity / 100) * 10}px)`;
        break;
      case 'brightness':
        filterValue = `brightness(${50 + (intensity / 100) * 150}%)`;
        break;
      case 'contrast':
        filterValue = `contrast(${50 + (intensity / 100) * 150}%)`;
        break;
      case 'grayscale':
        filterValue = `grayscale(${intensity}%)`;
        break;
      case 'invert':
        filterValue = `invert(${intensity}%)`;
        break;
      case 'sepia':
        filterValue = `sepia(${intensity}%)`;
        break;
      case 'saturate':
        filterValue = `saturate(${intensity * 2}%)`;
        break;
      case 'hue-rotate':
        filterValue = `hue-rotate(${(intensity / 100) * 360}deg)`;
        break;
    }

    if (filterValue) {
      // Clear the main canvas
      ctx.clearRect(0, 0, width, height);
      // Draw the background with the filter effect applied
      ctx.filter = filterValue;
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';
    }
  }

  /**
   * Draw foreground image if specified with optional blink effect
   */
  protected drawForeground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    if (this.foregroundImageElement) {
      const alpha = this.options.foregroundAlpha ?? 1;
      const previousAlpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      this.drawImageCover(ctx, this.foregroundImageElement, data.width, data.height);
      ctx.globalAlpha = previousAlpha;

      // Apply blink effect to foreground if active and target includes foreground
      const shouldBlink = this.options.imageBlinkEnabled &&
                          (this.options.imageBlinkTarget === 'foreground' || this.options.imageBlinkTarget === 'both');
      if (shouldBlink && this.blinkActive) {
        this.applyImageBlinkEffect(ctx, data.width, data.height, this.blinkAnimationPhase);
      }
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
   * Draw an image to fit within the canvas (like CSS background-size: contain)
   */
  protected drawImageContain(
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
      drawWidth = width;
      drawHeight = width / imgRatio;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    } else {
      // Image is taller than canvas
      drawHeight = height;
      drawWidth = height * imgRatio;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    }

    // Fill background first
    ctx.fillStyle = this.options.backgroundColor!;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  /**
   * Draw an image stretched to fill the canvas
   */
  protected drawImageStretch(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    ctx.drawImage(img, 0, 0, width, height);
  }

  /**
   * Draw an image tiled across the canvas
   */
  protected drawImageTile(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    const pattern = ctx.createPattern(img, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /**
   * Draw an image centered (actual size) on the canvas
   */
  protected drawImageCenter(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    // Fill background first
    ctx.fillStyle = this.options.backgroundColor!;
    ctx.fillRect(0, 0, width, height);

    const offsetX = (width - img.width) / 2;
    const offsetY = (height - img.height) / 2;
    ctx.drawImage(img, offsetX, offsetY);
  }

  /**
   * Draw an image with custom dimensions
   */
  protected drawImageCustom(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    // Fill background first
    ctx.fillStyle = this.options.backgroundColor!;
    ctx.fillRect(0, 0, width, height);

    const customWidth = this.options.backgroundWidth ?? img.width;
    const customHeight = this.options.backgroundHeight ?? img.height;
    const offsetX = (width - customWidth) / 2;
    const offsetY = (height - customHeight) / 2;
    ctx.drawImage(img, offsetX, offsetY, customWidth, customHeight);
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
   * Apply position offset and scale transformation to context
   * Call this before drawing visualization, and call restoreTransform() after
   * When mirrorHorizontal is enabled, visualization diverges from center (left goes left, right goes right)
   */
  protected applyTransform(ctx: CanvasRenderingContext2D, data?: { width: number; height: number }): void {
    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const scale = this.options.scale ?? 1;
    const mirrorHorizontal = this.options.mirrorHorizontal ?? false;
    const needsTransform = offsetX !== 0 || offsetY !== 0 || scale !== 1 || mirrorHorizontal;

    if (needsTransform) {
      ctx.save();
      // If we have scale and dimensions, scale around center
      if ((scale !== 1 || mirrorHorizontal) && data) {
        const centerX = data.width / 2;
        const centerY = data.height / 2;
        ctx.translate(centerX, centerY);

        // For horizontal mirror, we draw visualization on the left half only
        // The mirrored copy will be drawn in restoreTransform
        if (mirrorHorizontal) {
          // Scale down to half width and shift to left quarter
          ctx.scale(scale * 0.5, scale);
          ctx.translate(-(centerX / 2) + offsetX / (scale * 0.5), -centerY + offsetY / scale);
        } else {
          ctx.scale(scale, scale);
          ctx.translate(-centerX + offsetX / scale, -centerY + offsetY / scale);
        }
      } else if (offsetX !== 0 || offsetY !== 0) {
        ctx.translate(offsetX, offsetY);
      }
    }
  }

  /**
   * Restore context transformation state and draw mirrored copy if horizontal mirror is enabled
   * Call this after drawing visualization if applyTransform() was called
   * The mirror creates a diverging effect - visualization goes outward from center
   */
  protected restoreTransform(ctx: CanvasRenderingContext2D, data?: { width: number; height: number }): void {
    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const scale = this.options.scale ?? 1;
    const mirrorHorizontal = this.options.mirrorHorizontal ?? false;
    const needsTransform = offsetX !== 0 || offsetY !== 0 || scale !== 1 || mirrorHorizontal;

    if (needsTransform) {
      ctx.restore();

      // Draw horizontally mirrored copy - visualization diverges from center
      // Left half shows normal visualization going left, right half shows mirrored going right
      if (mirrorHorizontal && data) {
        const { width, height } = data;
        const centerX = width / 2;

        // Create a temporary canvas to capture only the visualization (not background)
        // We need to capture what was just drawn on the left half
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Copy the current canvas to temp
        tempCtx.drawImage(ctx.canvas, 0, 0);

        // Draw the left half mirrored to the right half
        // This creates a diverging effect where visualization goes outward from center
        ctx.save();
        // Move to right edge and flip horizontally
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        // Draw left half to right side (which will appear mirrored due to scale -1)
        ctx.drawImage(tempCanvas,
          0, 0, centerX, height,  // Source: left half
          centerX, 0, centerX, height  // Dest: right half (but flipped)
        );
        ctx.restore();
      }
    }
  }

  /**
   * Abstract draw method - must be implemented by subclasses
   */
  abstract draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void;

  /**
   * Apply ADSR envelope smoothing to a value
   * @param previousValue - The previous frame's value
   * @param targetValue - The current target value from audio data
   * @returns The smoothed value with ADSR envelope applied
   */
  protected applyADSRSmoothing(previousValue: number, targetValue: number): number {
    // Get ADSR parameters (0-100 scale)
    const attack = this.options.adsrAttack ?? 20;
    const decay = this.options.adsrDecay ?? 30;
    const sustain = this.options.adsrSustain ?? 10;
    const release = this.options.adsrRelease ?? 50;

    // Calculate sustain floor based on target (higher target = higher sustain floor)
    const sustainFloor = targetValue * (sustain / 100);

    // Determine if we're in attack (rising) or release (falling) phase
    if (targetValue > previousValue) {
      // Attack phase - value is rising toward target
      // Convert attack (0-100) to smoothing factor (0-1)
      // 0 = instant (no smoothing), 100 = very slow (high smoothing)
      const attackSmoothing = attack / 100;
      const attackedValue = previousValue * attackSmoothing + targetValue * (1 - attackSmoothing);
      return attackedValue;
    } else {
      // Release/decay phase - value is falling
      // Apply sustain floor - don't let value fall below sustain level
      const effectiveTarget = Math.max(targetValue, sustainFloor);

      // If we're above sustain level, use decay rate; if below, use release rate
      const isAboveSustain = previousValue > sustainFloor && targetValue >= sustainFloor * 0.5;
      const releaseSmoothing = isAboveSustain ? (decay / 100) : (release / 100);

      const releasedValue = previousValue * releaseSmoothing + effectiveTarget * (1 - releaseSmoothing);
      return Math.max(releasedValue, sustainFloor);
    }
  }

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
