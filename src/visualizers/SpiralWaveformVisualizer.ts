import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Spiral waveform visualizer
 * Displays waveform data in a spiral pattern
 */
export class SpiralWaveformVisualizer extends BaseVisualizer {
  readonly id = 'spiral-waveform';
  readonly name = 'Spiral Waveform';

  private rotation = 0;

  constructor(options: VisualizerOptions = {}) {
    super({
      lineWidth: 2,
      ...options,
      custom: {
        spiralTightness: 0.5, // How tight the spiral is (0-1)
        rotationSpeed: 0.01, // Rotation speed
        radiusMultiplier: 0.4, // Max radius as fraction of min dimension
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, timeDomainData } = data;
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
    ctx.globalAlpha = visualizationAlpha;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height);

    const spiralTightness = this.options.custom?.spiralTightness as number;
    const rotationSpeed = this.options.custom?.rotationSpeed as number;
    const radiusMultiplier = this.options.custom?.radiusMultiplier as number;

    // Update rotation
    this.rotation += rotationSpeed;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, this.options.primaryColor!);
    gradient.addColorStop(1, this.options.secondaryColor!);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = this.options.lineWidth!;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    ctx.beginPath();
    const dataLength = timeDomainData.length;
    const maxRadius = minDimension * radiusMultiplier;

    for (let i = 0; i < dataLength; i++) {
      const value = (timeDomainData[i] - 128) / 128;
      const sensitivity = this.options.sensitivity ?? 1.0;
      const sensitiveValue = Math.max(-1, Math.min(1, value * sensitivity));
      const angle = (i / dataLength) * Math.PI * 2;
      const spiralRadius = (i / dataLength) * maxRadius * (1 + spiralTightness);
      const radius = spiralRadius + sensitiveValue * 30;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw mirrored spiral if enabled
    if (this.options.mirror) {
      ctx.globalAlpha = visualizationAlpha * 0.5;
      ctx.scale(-1, -1);
      ctx.beginPath();

      for (let i = 0; i < dataLength; i++) {
        const value = (timeDomainData[i] - 128) / 128;
        const sensitivity = this.options.sensitivity ?? 1.0;
        const sensitiveValue = Math.max(-1, Math.min(1, value * sensitivity));
        const angle = (i / dataLength) * Math.PI * 2;
        const spiralRadius = (i / dataLength) * maxRadius * (1 + spiralTightness);
        const radius = spiralRadius + sensitiveValue * 30;

        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = previousAlpha;

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
