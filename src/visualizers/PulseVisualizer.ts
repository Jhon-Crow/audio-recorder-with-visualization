import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

interface PulseRing {
  radius: number;
  opacity: number;
  color: string;
  maxRadius: number;
}

/**
 * Pulse Visualizer
 * Concentric rings that pulse from center based on audio intensity
 */
export class PulseVisualizer extends BaseVisualizer {
  readonly id = 'pulse';
  readonly name = 'Pulse';

  private rings: PulseRing[] = [];
  private lastPulseTime = 0;
  private bassIntensityHistory: number[] = [];

  constructor(options: VisualizerOptions = {}) {
    super({
      lineWidth: 3,
      ...options,
      custom: {
        pulseThreshold: 0.3, // Minimum bass intensity to trigger pulse
        maxRings: 5, // Maximum number of rings
        ringSpeed: 5, // Ring expansion speed
        ringSpacing: 80, // Space between rings
        fillRings: false, // Fill rings instead of just stroke
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData, timestamp } = data;

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
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const maxRadius = Math.sqrt(width * width + height * height) / 2;

    // Calculate bass intensity
    let bassIntensity = 0;
    const bassEnd = Math.floor(frequencyData.length * 0.15);
    for (let i = 0; i < bassEnd; i++) {
      bassIntensity += this.applySensitivity(frequencyData[i]);
    }
    bassIntensity /= bassEnd * 255;

    // Track bass intensity history for smoothing
    this.bassIntensityHistory.push(bassIntensity);
    if (this.bassIntensityHistory.length > 5) {
      this.bassIntensityHistory.shift();
    }

    // Calculate average bass intensity
    const avgBassIntensity =
      this.bassIntensityHistory.reduce((sum, val) => sum + val, 0) /
      this.bassIntensityHistory.length;

    // Trigger new pulse on bass hit
    const pulseThreshold = this.options.custom?.pulseThreshold as number;
    const maxRings = this.options.custom?.maxRings as number;
    const ringSpacing = this.options.custom?.ringSpacing as number;
    const timeSinceLastPulse = timestamp - this.lastPulseTime;

    if (
      avgBassIntensity > pulseThreshold &&
      timeSinceLastPulse > 150 &&
      this.rings.length < maxRings
    ) {
      // Alternate between primary and secondary colors
      const color =
        this.rings.length % 2 === 0
          ? this.options.primaryColor!
          : this.options.secondaryColor!;

      this.rings.push({
        radius: 0,
        opacity: 1,
        color,
        maxRadius: maxRadius + ringSpacing * this.rings.length,
      });
      this.lastPulseTime = timestamp;
    }

    // Update and draw rings
    const ringSpeed = this.options.custom?.ringSpeed as number;
    const fillRings = this.options.custom?.fillRings as boolean;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];

      // Update ring
      ring.radius += ringSpeed;
      ring.opacity = Math.max(0, 1 - ring.radius / ring.maxRadius);

      // Remove dead rings
      if (ring.opacity <= 0) {
        this.rings.splice(i, 1);
        continue;
      }

      // Draw ring
      ctx.globalAlpha = visualizationAlpha * ring.opacity;
      ctx.lineWidth = this.options.lineWidth!;

      if (fillRings) {
        // Draw filled ring
        ctx.fillStyle = ring.color;
        ctx.globalAlpha = visualizationAlpha * ring.opacity * 0.2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw ring stroke
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = visualizationAlpha * ring.opacity;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Add glow effect
      ctx.shadowBlur = 20 * ring.opacity;
      ctx.shadowColor = ring.color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw center circle that reacts to audio
    const centerRadius = 30 + avgBassIntensity * 50;
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      centerRadius
    );
    gradient.addColorStop(0, this.options.primaryColor!);
    gradient.addColorStop(1, this.options.secondaryColor!);

    ctx.fillStyle = gradient;
    ctx.globalAlpha = visualizationAlpha;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.rings = [];
    this.bassIntensityHistory = [];
    super.destroy();
  }
}
