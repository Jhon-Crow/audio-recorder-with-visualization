import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Double Spiral Visualizer
 * Two spirals rotating in opposite directions, reacting to audio
 */
export class DoubleSpiralVisualizer extends BaseVisualizer {
  readonly id = 'double-spiral';
  readonly name = 'Double Spiral';

  private rotation = 0;
  private previousHeights: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      barCount: 64,
      ...options,
      custom: {
        rotationSpeed: 0.02, // Rotation speed in radians per frame
        spiralTightness: 0.5, // How tight the spiral is (0.1 - 2)
        maxRadius: 0.4, // Max radius as fraction of min dimension
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

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const scale = this.options.scale ?? 1;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height) * scale;

    const barCount = this.options.barCount!;
    const rotationSpeed = this.options.custom?.rotationSpeed as number;
    const spiralTightness = this.options.custom?.spiralTightness as number;
    const maxRadius = (this.options.custom?.maxRadius as number) * minDimension;
    const glowEffect = this.options.custom?.glowEffect as boolean;

    // Update rotation
    this.rotation += rotationSpeed;

    // Initialize previous heights if needed
    if (this.previousHeights.length !== barCount) {
      this.previousHeights = new Array(barCount).fill(0);
    }

    // Calculate bar heights from frequency data
    const step = Math.floor(frequencyData.length / barCount);
    const smoothing = this.options.smoothing!;

    // Draw both spirals
    for (let spiralDirection = -1; spiralDirection <= 1; spiralDirection += 2) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(this.rotation * spiralDirection);

      if (glowEffect) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.options.primaryColor!;
      }

      for (let i = 0; i < barCount; i++) {
        // Average frequency values for this bar
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += frequencyData[i * step + j];
        }
        const average = sum / step;

        // Apply sensitivity, normalize and apply smoothing
        const sensitiveAverage = this.applySensitivity(average);
        const targetHeight = (sensitiveAverage / 255) * 30;
        const smoothedHeight =
          this.previousHeights[i] * smoothing + targetHeight * (1 - smoothing);
        this.previousHeights[i] = smoothedHeight;

        // Calculate spiral position
        const t = (i / barCount) * Math.PI * 4;
        const radius = (i / barCount) * maxRadius * spiralTightness;
        const x = Math.cos(t) * radius;
        const y = Math.sin(t) * radius;

        // Calculate color gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, smoothedHeight);
        if (spiralDirection === 1) {
          gradient.addColorStop(0, this.options.primaryColor!);
          gradient.addColorStop(1, this.options.secondaryColor!);
        } else {
          gradient.addColorStop(0, this.options.secondaryColor!);
          gradient.addColorStop(1, this.options.primaryColor!);
        }

        ctx.fillStyle = gradient;
        ctx.globalAlpha = visualizationAlpha * (0.6 + (average / 255) * 0.4);

        // Draw circle at spiral point
        ctx.beginPath();
        ctx.arc(x, y, smoothedHeight, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
