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

    // Set up line style
    ctx.lineWidth = this.options.lineWidth!;
    ctx.strokeStyle = this.createGradient(ctx, 0, 0, width, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw waveform
    ctx.beginPath();

    const sliceWidth = width / timeDomainData.length;
    let x = 0;

    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 128.0; // Normalize to 0-2
      const y = (v * height) / 2;

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
        const v = timeDomainData[i] / 128.0;
        const y = height - (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw foreground
    this.drawForeground(ctx, data);
  }
}
