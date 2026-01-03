import { VisualizationData, VisualizerOptions } from '../types';
import { BaseVisualizer } from './BaseVisualizer';

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
        ...options.custom,
      },
    });
    this.maxParticles = (this.options.custom?.maxParticles as number) ?? 200;
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData, timeDomainData } = data;

    // Draw semi-transparent background for trail effect
    ctx.fillStyle = this.options.backgroundColor! + 'cc'; // 80% opacity
    ctx.fillRect(0, 0, width, height);

    // Draw background image if present
    if (this.backgroundImageElement) {
      ctx.globalAlpha = 0.3;
      this.drawImageCover(ctx, this.backgroundImageElement, width, height);
      ctx.globalAlpha = 1;
    }

    // Calculate audio intensity
    let bassIntensity = 0;
    let midIntensity = 0;
    let highIntensity = 0;

    const bassEnd = Math.floor(frequencyData.length * 0.1);
    const midEnd = Math.floor(frequencyData.length * 0.5);

    for (let i = 0; i < bassEnd; i++) {
      bassIntensity += frequencyData[i];
    }
    bassIntensity /= bassEnd * 255;

    for (let i = bassEnd; i < midEnd; i++) {
      midIntensity += frequencyData[i];
    }
    midIntensity /= (midEnd - bassEnd) * 255;

    for (let i = midEnd; i < frequencyData.length; i++) {
      highIntensity += frequencyData[i];
    }
    highIntensity /= (frequencyData.length - midEnd) * 255;

    const overallIntensity = (bassIntensity + midIntensity + highIntensity) / 3;

    // Calculate waveform deviation
    let waveformDeviation = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      waveformDeviation += Math.abs(timeDomainData[i] - 128);
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

      this.particles.push({
        x: width / 2 + offsetX + (Math.random() - 0.5) * 50,
        y: height / 2 + offsetY + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: baseSize + Math.random() * baseSize * bassIntensity * 3,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        hue: Math.random() * 60 + (bassIntensity > 0.5 ? 0 : midIntensity > 0.5 ? 120 : 240),
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

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
      ctx.fill();

      // Add glow effect
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.2})`;
      ctx.fill();
    }

    // Draw foreground
    this.drawForeground(ctx, data);
  }

  destroy(): void {
    this.particles = [];
    super.destroy();
  }
}
