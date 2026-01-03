import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * VU Meter visualizer (inspired by classic audio equipment)
 * Displays audio levels as analog-style VU meters with peak indicators
 */
export class VUMeterVisualizer extends BaseVisualizer {
  readonly id = 'vu-meter';
  readonly name = 'VU Meter';

  private leftPeak = 0;
  private rightPeak = 0;
  private leftLevel = 0;
  private rightLevel = 0;
  private leftPeakTimer = 0;
  private rightPeakTimer = 0;

  constructor(options: VisualizerOptions = {}) {
    super({
      ...options,
      custom: {
        meterStyle: 'modern', // 'classic', 'modern', 'led'
        showPeakIndicator: true,
        peakHoldTime: 30,
        horizontalLayout: true,
        ...options.custom,
      },
    });
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Apply position offset
    this.applyTransform(ctx);

    // Apply visualization alpha
    const visualizationAlpha = this.options.visualizationAlpha ?? 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = visualizationAlpha;

    const meterStyle = this.options.custom?.meterStyle as string;
    const showPeakIndicator = this.options.custom?.showPeakIndicator as boolean;
    const horizontalLayout = this.options.custom?.horizontalLayout as boolean;
    const peakHoldFrames = this.options.custom?.peakHoldTime as number;

    // Calculate audio levels from frequency data (split into L/R channels)
    const midpoint = Math.floor(frequencyData.length / 2);
    let leftSum = 0;
    let rightSum = 0;

    for (let i = 0; i < midpoint; i++) {
      leftSum += frequencyData[i];
    }
    for (let i = midpoint; i < frequencyData.length; i++) {
      rightSum += frequencyData[i];
    }

    const targetLeftLevel = leftSum / (midpoint * 255);
    const targetRightLevel = rightSum / ((frequencyData.length - midpoint) * 255);

    // Smooth level changes
    const smoothing = this.options.smoothing!;
    this.leftLevel = this.leftLevel * smoothing + targetLeftLevel * (1 - smoothing);
    this.rightLevel = this.rightLevel * smoothing + targetRightLevel * (1 - smoothing);

    // Update peaks
    if (this.leftLevel > this.leftPeak) {
      this.leftPeak = this.leftLevel;
      this.leftPeakTimer = peakHoldFrames;
    } else if (this.leftPeakTimer > 0) {
      this.leftPeakTimer--;
    } else {
      this.leftPeak *= 0.95;
    }

    if (this.rightLevel > this.rightPeak) {
      this.rightPeak = this.rightLevel;
      this.rightPeakTimer = peakHoldFrames;
    } else if (this.rightPeakTimer > 0) {
      this.rightPeakTimer--;
    } else {
      this.rightPeak *= 0.95;
    }

    // Draw meters
    if (horizontalLayout) {
      this.drawHorizontalMeter(ctx, width, height, 'L', this.leftLevel, this.leftPeak, meterStyle, showPeakIndicator, true);
      this.drawHorizontalMeter(ctx, width, height, 'R', this.rightLevel, this.rightPeak, meterStyle, showPeakIndicator, false);
    } else {
      this.drawVerticalMeter(ctx, width, height, 'L', this.leftLevel, this.leftPeak, meterStyle, showPeakIndicator, true);
      this.drawVerticalMeter(ctx, width, height, 'R', this.rightLevel, this.rightPeak, meterStyle, showPeakIndicator, false);
    }

    // Restore previous alpha
    ctx.globalAlpha = previousAlpha;

    // Restore transform
    this.restoreTransform(ctx);

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  private drawHorizontalMeter(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    label: string,
    level: number,
    peak: number,
    style: string,
    showPeak: boolean,
    isLeft: boolean
  ): void {
    const meterHeight = height / 2.5;
    const meterY = isLeft ? height / 4 - meterHeight / 2 : (3 * height) / 4 - meterHeight / 2;
    const padding = 60;
    const meterWidth = width - padding * 2;

    // Draw meter background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(padding, meterY, meterWidth, meterHeight);

    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, meterY, meterWidth, meterHeight);

    // Draw level bar
    const levelWidth = meterWidth * level;

    if (style === 'led') {
      // LED style
      const ledCount = 40;
      const ledWidth = meterWidth / ledCount;
      const activeLeds = Math.floor(ledCount * level);

      for (let i = 0; i < activeLeds; i++) {
        const x = padding + i * ledWidth + 2;
        const ratio = i / ledCount;

        if (ratio < 0.7) {
          ctx.fillStyle = '#00ff00'; // Green
        } else if (ratio < 0.9) {
          ctx.fillStyle = '#ffff00'; // Yellow
        } else {
          ctx.fillStyle = '#ff0000'; // Red
        }

        ctx.fillRect(x, meterY + 4, ledWidth - 4, meterHeight - 8);
      }
    } else {
      // Modern/Classic gradient
      const gradient = ctx.createLinearGradient(padding, 0, padding + meterWidth, 0);
      gradient.addColorStop(0, '#00ff00');
      gradient.addColorStop(0.7, '#00ff00');
      gradient.addColorStop(0.85, '#ffff00');
      gradient.addColorStop(1, '#ff0000');

      ctx.fillStyle = gradient;
      ctx.fillRect(padding, meterY, levelWidth, meterHeight);
    }

    // Draw peak indicator
    if (showPeak && peak > 0.01) {
      const peakX = padding + meterWidth * peak;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(peakX - 2, meterY, 4, meterHeight);
    }

    // Draw label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(label, padding - 10, meterY + meterHeight / 2 + 7);

    // Draw scale markings
    ctx.font = '10px Arial';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    const marks = [0, 0.25, 0.5, 0.75, 1.0];
    const labels = ['-∞', '-12', '-6', '-3', '0'];

    for (let i = 0; i < marks.length; i++) {
      const x = padding + meterWidth * marks[i];
      ctx.fillText(labels[i], x, meterY + meterHeight + 15);
    }
  }

  private drawVerticalMeter(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    label: string,
    level: number,
    peak: number,
    style: string,
    showPeak: boolean,
    isLeft: boolean
  ): void {
    const meterWidth = width / 4;
    const meterX = isLeft ? width / 4 - meterWidth / 2 : (3 * width) / 4 - meterWidth / 2;
    const padding = 40;
    const meterHeight = height - padding * 2;

    // Draw meter background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(meterX, padding, meterWidth, meterHeight);

    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, padding, meterWidth, meterHeight);

    // Draw level bar (from bottom)
    const levelHeight = meterHeight * level;
    const levelY = padding + meterHeight - levelHeight;

    if (style === 'led') {
      // LED style
      const ledCount = 40;
      const ledHeight = meterHeight / ledCount;
      const activeLeds = Math.floor(ledCount * level);

      for (let i = 0; i < activeLeds; i++) {
        const y = padding + meterHeight - (i + 1) * ledHeight + 2;
        const ratio = i / ledCount;

        if (ratio < 0.7) {
          ctx.fillStyle = '#00ff00'; // Green
        } else if (ratio < 0.9) {
          ctx.fillStyle = '#ffff00'; // Yellow
        } else {
          ctx.fillStyle = '#ff0000'; // Red
        }

        ctx.fillRect(meterX + 4, y, meterWidth - 8, ledHeight - 4);
      }
    } else {
      // Modern/Classic gradient
      const gradient = ctx.createLinearGradient(0, padding + meterHeight, 0, padding);
      gradient.addColorStop(0, '#00ff00');
      gradient.addColorStop(0.7, '#00ff00');
      gradient.addColorStop(0.85, '#ffff00');
      gradient.addColorStop(1, '#ff0000');

      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, levelY, meterWidth, levelHeight);
    }

    // Draw peak indicator
    if (showPeak && peak > 0.01) {
      const peakY = padding + meterHeight - meterHeight * peak;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(meterX, peakY - 2, meterWidth, 4);
    }

    // Draw label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, meterX + meterWidth / 2, height - 10);
  }

  destroy(): void {
    this.leftPeak = 0;
    this.rightPeak = 0;
    this.leftLevel = 0;
    this.rightLevel = 0;
    this.leftPeakTimer = 0;
    this.rightPeakTimer = 0;
    super.destroy();
  }
}
