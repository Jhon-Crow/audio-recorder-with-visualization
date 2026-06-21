import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Lissajous Visualizer
 * Classic Lissajous curve pattern based on audio waveform
 */
export class LissajousVisualizer extends BaseVisualizer {
  readonly id = 'lissajous';
  readonly name = 'Lissajous';

  private history: Array<{ x: number; y: number }> = [];
  private maxHistoryLength = 100;

  constructor(options: VisualizerOptions = {}) {
    super({
      lineWidth: 2,
      ...options,
      custom: {
        size: 0.4, // Size as fraction of min dimension
        trailLength: 100, // Number of points in trail
        phaseOffset: Math.PI / 2, // Phase offset between X and Y
        frequencyRatio: 1, // Frequency ratio X:Y (1:1, 2:1, 3:2, etc.)
        showTrail: true, // Show trail effect
        ...options.custom,
      },
    });
    this.maxHistoryLength = (this.options.custom?.trailLength as number) ?? 100;
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, timeDomainData } = data;

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

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    const minDimension = Math.min(width, height);
    const size = (this.options.custom?.size as number) * minDimension;
    const phaseOffset = this.options.custom?.phaseOffset as number;
    const frequencyRatio = this.options.custom?.frequencyRatio as number;
    const showTrail = this.options.custom?.showTrail as boolean;

    // Calculate Lissajous coordinates from waveform data
    // Use different parts of the waveform for X and Y to create the curve
    const dataLength = timeDomainData.length;
    const xSample = Math.floor(dataLength / 2);
    const ySample = Math.floor(dataLength / 2 + dataLength / 4);

    // Normalize values to -1 to 1
    const sensitivity = this.options.sensitivity ?? 1.0;
    const xNorm = timeDomainData[xSample] / 128.0 - 1.0;
    const yNorm = timeDomainData[ySample] / 128.0 - 1.0;
    const xValue = Math.max(-1, Math.min(1, xNorm * sensitivity)) * Math.cos(phaseOffset);
    const yValue = Math.max(-1, Math.min(1, yNorm * sensitivity)) * Math.sin(phaseOffset);

    // Calculate position with frequency ratio
    const x = centerX + xValue * size * frequencyRatio;
    const y = centerY + yValue * size;

    // Add to history
    this.history.push({ x, y });
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }

    // Draw the Lissajous curve
    if (this.history.length > 1) {
      // Draw trail if enabled
      if (showTrail) {
        for (let i = 1; i < this.history.length; i++) {
          const point = this.history[i];
          const prevPoint = this.history[i - 1];
          const age = i / this.history.length;

          // Calculate color gradient based on position in trail
          const gradient = ctx.createLinearGradient(
            prevPoint.x,
            prevPoint.y,
            point.x,
            point.y
          );
          gradient.addColorStop(0, this.options.primaryColor!);
          gradient.addColorStop(1, this.options.secondaryColor!);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = this.options.lineWidth! * (0.5 + age * 0.5);
          ctx.globalAlpha = visualizationAlpha * age;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(prevPoint.x, prevPoint.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      }

      // Draw main curve with smooth bezier curves
      ctx.globalAlpha = visualizationAlpha;
      ctx.lineWidth = this.options.lineWidth! * 2;
      ctx.strokeStyle = this.createGradient(
        ctx,
        centerX - size,
        centerY - size,
        centerX + size,
        centerY + size
      );
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Add glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.options.primaryColor!;

      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);

      // Draw smooth curve through history points
      for (let i = 1; i < this.history.length - 1; i++) {
        const currentPoint = this.history[i];
        const nextPoint = this.history[i + 1];
        const controlX = (currentPoint.x + nextPoint.x) / 2;
        const controlY = (currentPoint.y + nextPoint.y) / 2;
        ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
      }

      // Draw to last point
      const lastPoint = this.history[this.history.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw current point as a bright dot
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
      gradient.addColorStop(0, this.options.primaryColor!);
      gradient.addColorStop(1, this.options.secondaryColor!);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = visualizationAlpha;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
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
