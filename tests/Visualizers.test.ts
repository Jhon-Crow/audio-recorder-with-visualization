import { WaveformVisualizer } from '../src/visualizers/WaveformVisualizer';
import { BarVisualizer } from '../src/visualizers/BarVisualizer';
import { CircularVisualizer } from '../src/visualizers/CircularVisualizer';
import { ParticleVisualizer } from '../src/visualizers/ParticleVisualizer';
import { VisualizationData } from '../src/types';

describe('Visualizers', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mockData: VisualizationData;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;

    mockData = {
      timeDomainData: new Uint8Array(2048).fill(128),
      frequencyData: new Uint8Array(1024).fill(128),
      timestamp: performance.now(),
      width: 800,
      height: 600,
      sampleRate: 44100,
      fftSize: 2048,
    };
  });

  describe('WaveformVisualizer', () => {
    let visualizer: WaveformVisualizer;

    beforeEach(() => {
      visualizer = new WaveformVisualizer();
      visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('waveform');
      expect(visualizer.name).toBe('Waveform');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should accept custom options', () => {
      const customVisualizer = new WaveformVisualizer({
        primaryColor: '#ff0000',
        lineWidth: 5,
      });
      customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should draw mirrored when option enabled', () => {
      const mirroredVisualizer = new WaveformVisualizer({ mirror: true });
      mirroredVisualizer.init(canvas);
      expect(() => mirroredVisualizer.draw(ctx, mockData)).not.toThrow();
      mirroredVisualizer.destroy();
    });
  });

  describe('BarVisualizer', () => {
    let visualizer: BarVisualizer;

    beforeEach(() => {
      visualizer = new BarVisualizer();
      visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('bars');
      expect(visualizer.name).toBe('Bars');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should accept custom bar count', () => {
      const customVisualizer = new BarVisualizer({ barCount: 32 });
      customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle smoothing between frames', () => {
      visualizer.draw(ctx, mockData);

      // Second frame should use smoothed values
      mockData.frequencyData = new Uint8Array(1024).fill(255);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('CircularVisualizer', () => {
    let visualizer: CircularVisualizer;

    beforeEach(() => {
      visualizer = new CircularVisualizer();
      visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('circular');
      expect(visualizer.name).toBe('Circular');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should accept custom options', () => {
      const customVisualizer = new CircularVisualizer({
        barCount: 64,
        custom: {
          innerRadius: 0.4,
          rotationSpeed: 0.01,
        },
      });
      customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });
  });

  describe('ParticleVisualizer', () => {
    let visualizer: ParticleVisualizer;

    beforeEach(() => {
      visualizer = new ParticleVisualizer();
      visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('particles');
      expect(visualizer.name).toBe('Particles');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should spawn particles based on audio', () => {
      // Draw multiple frames
      for (let i = 0; i < 10; i++) {
        mockData.frequencyData = new Uint8Array(1024).fill(200);
        visualizer.draw(ctx, mockData);
      }
      // Should not throw even with many particles
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should accept custom particle options', () => {
      const customVisualizer = new ParticleVisualizer({
        custom: {
          maxParticles: 100,
          particleBaseSize: 5,
          spawnRate: 3,
        },
      });
      customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });
  });

  describe('Common functionality', () => {
    test('should update options', () => {
      const visualizer = new BarVisualizer();
      visualizer.init(canvas);

      visualizer.setOptions({ primaryColor: '#ff0000' });
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();

      visualizer.destroy();
    });

    test('should handle background image loading', () => {
      const visualizer = new BarVisualizer({
        backgroundImage: 'data:image/png;base64,iVBORw0KGgo=',
      });
      visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });
});
