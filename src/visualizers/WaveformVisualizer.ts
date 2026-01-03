import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Waveform (oscilloscope) visualizer
 * Displays audio as a continuous wave line
 */
export class WaveformVisualizer extends BaseVisualizer {
  readonly id = 'waveform';
  readonly name = 'Waveform';

  constructor(options: VisualizerOptions = {}) {
    super({
      lineWidth: 2,
      ...options,
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, timeDomainData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Apply position offset
    this.applyTransform(ctx);

    // Set up line style
    ctx.lineWidth = this.options.lineWidth!;
    ctx.strokeStyle = this.createGradient(ctx, 0, 0, width, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = visualizationAlpha;

    // When mirror mode is enabled, each half uses half the height to stay centered
    const amplitudeScale = this.options.mirror ? 0.5 : 1;

    // Draw waveform
    ctx.beginPath();

    const sliceWidth = width / timeDomainData.length;
    let x = 0;

    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 128.0 - 1.0; // Normalize to -1 to 1
      const y = height / 2 + (v * height * amplitudeScale) / 2; // Center around height/2

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Draw mirrored waveform if enabled
    if (this.options.mirror) {
      ctx.beginPath();
      x = 0;

      for (let i = 0; i < timeDomainData.length; i++) {
        const v = timeDomainData[i] / 128.0 - 1.0; // Normalize to -1 to 1
        const y = height / 2 - (v * height * amplitudeScale) / 2; // Mirror around height/2

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.globalAlpha = visualizationAlpha * 0.5;
      ctx.stroke();
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Restore transform
    this.restoreTransform(ctx);

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
