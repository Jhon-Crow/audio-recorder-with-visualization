import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Glow waveform visualizer (inspired by modern audio players)
 * Displays audio waveform with glow effects and smooth curves
 */
export class GlowWaveformVisualizer extends BaseVisualizer {
  readonly id = 'glow-waveform';
  readonly name = 'Glow Waveform';

  constructor(options: VisualizerOptions = {}) {
    super({
      lineWidth: 3,
      ...options,
      custom: {
        glowIntensity: 20, // Glow blur radius
        fillWave: true, // Fill area under waveform
        fillOpacity: 0.3, // Fill opacity
        smoothCurves: true, // Use smooth bezier curves
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, timeDomainData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Apply position offset
    this.applyTransform(ctx);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = visualizationAlpha;

    const amplitudeScale = this.options.mirror ? 0.5 : 1;
    const glowIntensity = this.options.custom?.glowIntensity as number;
    const fillWave = this.options.custom?.fillWave as boolean;
    const fillOpacity = this.options.custom?.fillOpacity as number;
    const smoothCurves = this.options.custom?.smoothCurves as boolean;

    const sliceWidth = width / timeDomainData.length;

    // Helper function to draw waveform
    const drawWave = (mirror: boolean, withFill: boolean) => {
      ctx.beginPath();

      let x = 0;
      const points: { x: number; y: number }[] = [];

      // Generate points
      for (let i = 0; i < timeDomainData.length; i++) {
        const v = timeDomainData[i] / 128.0 - 1.0;
        const y = mirror
          ? height / 2 - (v * height * amplitudeScale) / 2
          : height / 2 + (v * height * amplitudeScale) / 2;

        points.push({ x, y });
        x += sliceWidth;
      }

      // Draw with smooth curves or straight lines
      if (smoothCurves && points.length > 2) {
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }

        // Draw last segment
        const lastPoint = points[points.length - 1];
        const secondLastPoint = points[points.length - 2];
        ctx.quadraticCurveTo(
          secondLastPoint.x,
          secondLastPoint.y,
          lastPoint.x,
          lastPoint.y
        );
      } else {
        // Straight lines
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }

      if (withFill && fillWave) {
        // Close the path to fill
        ctx.lineTo(width, height / 2);
        ctx.lineTo(0, height / 2);
        ctx.closePath();

        // Fill gradient
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, this.options.secondaryColor! + Math.floor(fillOpacity * 255).toString(16).padStart(2, '0'));
        fillGradient.addColorStop(1, this.options.primaryColor! + Math.floor(fillOpacity * 255).toString(16).padStart(2, '0'));
        ctx.fillStyle = fillGradient;
        ctx.fill();
      }

      // Draw stroke with glow
      ctx.lineWidth = this.options.lineWidth!;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Create gradient stroke
      const strokeGradient = this.createGradient(ctx, 0, 0, width, 0);
      ctx.strokeStyle = strokeGradient;

      // Draw glow effect
      if (glowIntensity > 0) {
        ctx.shadowBlur = glowIntensity;
        ctx.shadowColor = this.options.primaryColor!;
      }

      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
    };

    // Draw main waveform
    drawWave(false, true);

    // Draw mirrored waveform if enabled
    if (this.options.mirror) {
      ctx.globalAlpha = visualizationAlpha * 0.7;
      drawWave(true, false);
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Restore transform
    this.restoreTransform(ctx);

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
