import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

/**
 * Particle shape types
 */
export type ParticleShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'heart';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  hue: number;
}

/**
 * Particle-based visualizer
 * Creates particles that react to audio
 */
export class ParticleVisualizer extends BaseVisualizer {
  readonly id = 'particles';
  readonly name = 'Particles';

  private particles: Particle[] = [];
  private maxParticles = 200;

  constructor(options: VisualizerOptions = {}) {
    super({
      ...options,
      custom: {
        maxParticles: 200,
        particleBaseSize: 3,
        particleSpeedFactor: 2,
        spawnRate: 5, // Particles per frame based on audio level
        useCustomColors: false, // Use primary/secondary colors instead of rainbow
        particleShape: 'circle' as ParticleShape, // Default particle shape
        ...options.custom,
      },
    });
    this.maxParticles = (this.options.custom?.maxParticles as number) ?? 200;
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData, timeDomainData } = data;
    // Validate dimensions before drawing
    if (!this.isValidDimensions(width, height)) {
      return;
    }


    // Draw semi-transparent background for trail effect
    ctx.fillStyle = this.options.backgroundColor! + 'cc'; // 80% opacity
    ctx.fillRect(0, 0, width, height);

    // Draw background image if present
    if (this.backgroundImageElement) {
      ctx.globalAlpha = 0.3;
      this.drawImageCover(ctx, this.backgroundImageElement, width, height);
      ctx.globalAlpha = 1;
    }

    // Apply layer effects to background
    this.applyLayerEffect(ctx, data);

    // Get frequency data slice based on frequencyWidth setting
    // Ensure we have at least 10 bins for bass/mid/high split
    const frequencyDataSlice = this.getFrequencyDataSlice(frequencyData, 10);

    // Calculate audio intensity
    let bassIntensity = 0;
    let midIntensity = 0;
    let highIntensity = 0;

    // Ensure all band sizes are at least 1 to prevent division by zero
    const bassEnd = Math.max(1, Math.floor(frequencyDataSlice.length * 0.1));
    const midEnd = Math.max(bassEnd + 1, Math.floor(frequencyDataSlice.length * 0.5));
    const bassCount = bassEnd;
    const midCount = Math.max(1, midEnd - bassEnd);
    const highCount = Math.max(1, frequencyDataSlice.length - midEnd);

    for (let i = 0; i < bassEnd; i++) {
      bassIntensity += frequencyDataSlice[i];
    }
    bassIntensity /= bassCount * 255;

    for (let i = bassEnd; i < midEnd; i++) {
      midIntensity += frequencyDataSlice[i];
    }
    midIntensity /= midCount * 255;

    for (let i = midEnd; i < frequencyDataSlice.length; i++) {
      highIntensity += frequencyDataSlice[i];
    }
    highIntensity /= highCount * 255;

    const overallIntensity = (bassIntensity + midIntensity + highIntensity) / 3;

    // Calculate waveform deviation
    const sensitivity = this.options.sensitivity ?? 1.0;
    let waveformDeviation = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const deviation = Math.abs(timeDomainData[i] - 128);
      waveformDeviation += Math.min(128, deviation * sensitivity);
    }
    waveformDeviation /= timeDomainData.length * 128;

    // Spawn new particles based on audio
    const spawnRate = this.options.custom?.spawnRate as number;
    const particlesToSpawn = Math.floor(overallIntensity * spawnRate);
    const speedFactor = this.options.custom?.particleSpeedFactor as number;
    const baseSize = this.options.custom?.particleBaseSize as number;

    const offsetX = this.options.offsetX ?? 0;
    const offsetY = this.options.offsetY ?? 0;

    for (let i = 0; i < particlesToSpawn && this.particles.length < this.maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 1.5) * speedFactor * (0.5 + overallIntensity);

      const useCustomColors = this.options.custom?.useCustomColors as boolean;
      let hue: number;

      if (useCustomColors) {
        // Alternate between primary and secondary color hues
        const primaryHue = this.getHueFromColor(this.options.primaryColor!);
        const secondaryHue = this.getHueFromColor(this.options.secondaryColor!);
        hue = Math.random() > 0.5 ? primaryHue : secondaryHue;
      } else {
        // Use rainbow colors based on audio intensity
        hue = Math.random() * 60 + (bassIntensity > 0.5 ? 0 : midIntensity > 0.5 ? 120 : 240);
      }

      this.particles.push({
        x: width / 2 + offsetX + (Math.random() - 0.5) * 50,
        y: height / 2 + offsetY + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: baseSize + Math.random() * baseSize * bassIntensity * 3,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        hue,
      });
    }

    // Update and draw particles
    const gravity = 0.02;
    const friction = 0.99;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.vy += gravity;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;

      // Add some reaction to audio
      p.vx += (Math.random() - 0.5) * waveformDeviation * 2;
      p.vy += (Math.random() - 0.5) * waveformDeviation * 2;

      // Update life
      p.life -= 1 / p.maxLife;

      // Remove dead particles
      if (p.life <= 0 || p.x < -50 || p.x > width + 50 || p.y > height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw particle
      const visualizationAlpha = this.options.visualizationAlpha ?? 1;
      const alpha = p.life * visualizationAlpha;
      const radius = p.radius * (0.5 + p.life * 0.5);

      // Get particle shape from custom options
      const particleShape = (this.options.custom?.particleShape as ParticleShape) || 'circle';

      // Draw particle with selected shape
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
      this.drawParticleShape(ctx, p.x, p.y, radius, particleShape);

      // Add glow effect
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.2})`;
      this.drawParticleShape(ctx, p.x, p.y, radius * 2, particleShape);
    }

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  /**
   * Draw particle with specified shape
   */
  private drawParticleShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    shape: ParticleShape
  ): void {
    switch (shape) {
      case 'circle':
        this.drawCircleParticle(ctx, x, y, radius);
        break;
      case 'square':
        this.drawSquareParticle(ctx, x, y, radius);
        break;
      case 'triangle':
        this.drawTriangleParticle(ctx, x, y, radius);
        break;
      case 'diamond':
        this.drawDiamondParticle(ctx, x, y, radius);
        break;
      case 'star':
        this.drawStarParticle(ctx, x, y, radius);
        break;
      case 'heart':
        this.drawHeartParticle(ctx, x, y, radius);
        break;
      default:
        this.drawCircleParticle(ctx, x, y, radius);
    }
  }

  /**
   * Draw a circle particle
   */
  private drawCircleParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a square particle
   */
  private drawSquareParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const size = radius * 2;
    ctx.fillRect(x - radius, y - radius, size, size);
  }

  /**
   * Draw a triangle particle
   */
  private drawTriangleParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const height = radius * 1.732; // sqrt(3) for equilateral triangle
    ctx.beginPath();
    ctx.moveTo(x, y - height * 0.667); // Top point
    ctx.lineTo(x + radius, y + height * 0.333); // Bottom right
    ctx.lineTo(x - radius, y + height * 0.333); // Bottom left
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw a diamond particle
   */
  private drawDiamondParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y - radius); // Top point
    ctx.lineTo(x + radius, y); // Right point
    ctx.lineTo(x, y + radius); // Bottom point
    ctx.lineTo(x - radius, y); // Left point
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw a star particle (5-pointed)
   */
  private drawStarParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.5;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(x, y - outerRadius);

    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(
        x + Math.cos(rot) * outerRadius,
        y + Math.sin(rot) * outerRadius
      );
      rot += step;

      ctx.lineTo(
        x + Math.cos(rot) * innerRadius,
        y + Math.sin(rot) * innerRadius
      );
      rot += step;
    }

    ctx.lineTo(x, y - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw a heart particle
   */
  private drawHeartParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y + radius * 0.3);

    // Left side of heart
    ctx.bezierCurveTo(
      x, y - radius * 0.3,
      x - radius, y - radius * 0.3,
      x - radius, y + radius * 0.15
    );
    ctx.bezierCurveTo(
      x - radius, y + radius * 0.6,
      x, y + radius * 0.8,
      x, y + radius
    );

    // Right side of heart
    ctx.bezierCurveTo(
      x, y + radius * 0.8,
      x + radius, y + radius * 0.6,
      x + radius, y + radius * 0.15
    );
    ctx.bezierCurveTo(
      x + radius, y - radius * 0.3,
      x, y - radius * 0.3,
      x, y + radius * 0.3
    );

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Extract hue value from hex color
   */
  private getHueFromColor(color: string): number {
    // Simple hex to HSL conversion for hue extraction
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        hue = ((b - r) / delta + 2) / 6;
      } else {
        hue = ((r - g) / delta + 4) / 6;
      }
    }

    return hue * 360;
  }

  destroy(): void {
    this.particles = [];
    super.destroy();
  }
}
