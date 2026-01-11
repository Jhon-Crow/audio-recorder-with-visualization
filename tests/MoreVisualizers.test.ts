import { SpectrogramVisualizer } from '../src/visualizers/SpectrogramVisualizer';
import { VUMeterVisualizer } from '../src/visualizers/VUMeterVisualizer';
import { SpectrumGradientVisualizer } from '../src/visualizers/SpectrumGradientVisualizer';
import { SpiralWaveformVisualizer } from '../src/visualizers/SpiralWaveformVisualizer';
import { RadialBarsVisualizer } from '../src/visualizers/RadialBarsVisualizer';
import { FrequencyRingsVisualizer } from '../src/visualizers/FrequencyRingsVisualizer';
import { DoubleSpiralVisualizer } from '../src/visualizers/DoubleSpiralVisualizer';
import { PulseVisualizer } from '../src/visualizers/PulseVisualizer';
import { WaterfallBarsVisualizer } from '../src/visualizers/WaterfallBarsVisualizer';
import { GridVisualizer } from '../src/visualizers/GridVisualizer';
import { LissajousVisualizer } from '../src/visualizers/LissajousVisualizer';
import { VisualizationData } from '../src/types';

describe('Additional Visualizers', () => {
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

  describe('SpectrogramVisualizer', () => {
    let visualizer: SpectrogramVisualizer;

    beforeEach(async () => {
      visualizer = new SpectrogramVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('spectrogram');
      expect(visualizer.name).toBe('Spectrogram');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle multiple frames (scrolling)', () => {
      // Draw multiple frames to test scrolling behavior
      for (let i = 0; i < 10; i++) {
        mockData.frequencyData = new Uint8Array(1024).fill(Math.floor(Math.random() * 256));
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });

    test('should accept custom scroll speed', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { scrollSpeed: 3 },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle heat color scheme', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { colorScheme: 'heat' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle cool color scheme', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { colorScheme: 'cool' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle grayscale color scheme', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { colorScheme: 'grayscale' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle custom color scheme', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { colorScheme: 'custom' },
        primaryColor: '#ff0000',
        secondaryColor: '#0000ff',
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle horizontal orientation', async () => {
      const customVisualizer = new SpectrogramVisualizer({
        custom: { orientation: 'horizontal' },
      });
      await customVisualizer.init(canvas);
      // Draw multiple frames to test horizontal scrolling
      for (let i = 0; i < 5; i++) {
        expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      }
      customVisualizer.destroy();
    });

    test('should handle frequency ranges', async () => {
      for (const range of ['bass', 'mid', 'high', 'full']) {
        const customVisualizer = new SpectrogramVisualizer({
          custom: { frequencyRange: range },
        });
        await customVisualizer.init(canvas);
        expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
        customVisualizer.destroy();
      }
    });

    test('should handle resize', async () => {
      visualizer.draw(ctx, mockData);
      // Resize canvas
      mockData.width = 1280;
      mockData.height = 720;
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('VUMeterVisualizer', () => {
    let visualizer: VUMeterVisualizer;

    beforeEach(async () => {
      visualizer = new VUMeterVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('vu-meter');
      expect(visualizer.name).toBe('VU Meter');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle level changes across frames', () => {
      // Draw multiple frames with different levels
      for (let i = 0; i < 50; i++) {
        mockData.frequencyData = new Uint8Array(1024).fill(i * 5);
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });

    test('should update peak indicators', () => {
      // Start with high level
      mockData.frequencyData = new Uint8Array(1024).fill(255);
      visualizer.draw(ctx, mockData);

      // Drop to low level - peak should hold
      mockData.frequencyData = new Uint8Array(1024).fill(0);
      for (let i = 0; i < 60; i++) {
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });

    test('should handle LED style', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { meterStyle: 'led' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle classic style', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { meterStyle: 'classic' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle vertical layout', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { horizontalLayout: false },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should handle vertical layout with LED style', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { horizontalLayout: false, meterStyle: 'led' },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should hide peak indicator when disabled', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { showPeakIndicator: false },
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });

    test('should use custom colors when enabled', async () => {
      const customVisualizer = new VUMeterVisualizer({
        custom: { useCustomColors: true },
        primaryColor: '#ff0000',
        secondaryColor: '#0000ff',
      });
      await customVisualizer.init(canvas);
      expect(() => customVisualizer.draw(ctx, mockData)).not.toThrow();
      customVisualizer.destroy();
    });
  });

  describe('SpectrumGradientVisualizer', () => {
    let visualizer: SpectrumGradientVisualizer;

    beforeEach(async () => {
      visualizer = new SpectrumGradientVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('spectrum-gradient');
      expect(visualizer.name).toBe('Spectrum Gradient');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle smoothing between frames', () => {
      visualizer.draw(ctx, mockData);
      mockData.frequencyData = new Uint8Array(1024).fill(255);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('SpiralWaveformVisualizer', () => {
    let visualizer: SpiralWaveformVisualizer;

    beforeEach(async () => {
      visualizer = new SpiralWaveformVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('spiral-waveform');
      expect(visualizer.name).toBe('Spiral Waveform');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle rotation over time', () => {
      for (let i = 0; i < 20; i++) {
        mockData.timestamp = performance.now() + i * 100;
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });
  });

  describe('RadialBarsVisualizer', () => {
    let visualizer: RadialBarsVisualizer;

    beforeEach(async () => {
      visualizer = new RadialBarsVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('radial-bars');
      expect(visualizer.name).toBe('Radial Bars');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('FrequencyRingsVisualizer', () => {
    let visualizer: FrequencyRingsVisualizer;

    beforeEach(async () => {
      visualizer = new FrequencyRingsVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('frequency-rings');
      expect(visualizer.name).toBe('Frequency Rings');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('DoubleSpiralVisualizer', () => {
    let visualizer: DoubleSpiralVisualizer;

    beforeEach(async () => {
      visualizer = new DoubleSpiralVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('double-spiral');
      expect(visualizer.name).toBe('Double Spiral');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });
  });

  describe('PulseVisualizer', () => {
    let visualizer: PulseVisualizer;

    beforeEach(async () => {
      visualizer = new PulseVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('pulse');
      expect(visualizer.name).toBe('Pulse');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle high intensity audio', () => {
      mockData.frequencyData = new Uint8Array(1024).fill(255);
      for (let i = 0; i < 10; i++) {
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });
  });

  describe('WaterfallBarsVisualizer', () => {
    let visualizer: WaterfallBarsVisualizer;

    beforeEach(async () => {
      visualizer = new WaterfallBarsVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('waterfall-bars');
      expect(visualizer.name).toBe('Waterfall Bars');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should create bars over multiple frames', () => {
      for (let i = 0; i < 30; i++) {
        mockData.frequencyData = new Uint8Array(1024).fill(Math.floor(Math.random() * 256));
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });
  });

  describe('GridVisualizer', () => {
    let visualizer: GridVisualizer;

    beforeEach(async () => {
      visualizer = new GridVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('grid');
      expect(visualizer.name).toBe('Grid');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle varying frequency data', () => {
      for (let i = 0; i < 10; i++) {
        mockData.frequencyData = new Uint8Array(1024).fill(i * 25);
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });
  });

  describe('LissajousVisualizer', () => {
    let visualizer: LissajousVisualizer;

    beforeEach(async () => {
      visualizer = new LissajousVisualizer();
      await visualizer.init(canvas);
    });

    afterEach(() => {
      visualizer.destroy();
    });

    test('should have correct id and name', () => {
      expect(visualizer.id).toBe('lissajous');
      expect(visualizer.name).toBe('Lissajous');
    });

    test('should draw without errors', () => {
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
    });

    test('should handle varying waveform data', () => {
      // Generate sine wave pattern
      for (let j = 0; j < 10; j++) {
        const data = new Uint8Array(2048);
        for (let i = 0; i < 2048; i++) {
          data[i] = Math.floor(128 + 100 * Math.sin(i * 0.1 + j));
        }
        mockData.timeDomainData = data;
        expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      }
    });
  });

  describe('Visualizers with invalid dimensions', () => {
    test('should handle zero width/height gracefully', () => {
      const visualizer = new SpectrogramVisualizer();
      visualizer.init(canvas);

      const zeroData = { ...mockData, width: 0, height: 0 };
      expect(() => visualizer.draw(ctx, zeroData)).not.toThrow();
      visualizer.destroy();
    });

    test('should handle negative dimensions gracefully', () => {
      const visualizer = new VUMeterVisualizer();
      visualizer.init(canvas);

      const negativeData = { ...mockData, width: -100, height: -100 };
      expect(() => visualizer.draw(ctx, negativeData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with images', () => {
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    test('SpectrogramVisualizer should handle background image', async () => {
      const visualizer = new SpectrogramVisualizer({
        backgroundImage: validPng,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });

    test('VUMeterVisualizer should handle foreground image', async () => {
      const visualizer = new VUMeterVisualizer({
        foregroundImage: validPng,
        foregroundAlpha: 0.5,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with sensitivity settings', () => {
    test('should apply sensitivity multiplier', async () => {
      const visualizer = new SpectrogramVisualizer({
        sensitivity: 2.0,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with visualization alpha', () => {
    test('should apply visualization alpha', async () => {
      const visualizer = new VUMeterVisualizer({
        visualizationAlpha: 0.7,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with frequency width', () => {
    test('should apply frequency width restriction', async () => {
      const visualizer = new SpectrogramVisualizer({
        frequencyWidth: 50,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with zero dimensions', () => {
    test('should handle zero width gracefully', async () => {
      const visualizer = new VUMeterVisualizer();
      await visualizer.init(canvas);
      const zeroWidthData = { ...mockData, width: 0 };
      // Should not throw, just skip drawing
      expect(() => visualizer.draw(ctx, zeroWidthData)).not.toThrow();
      visualizer.destroy();
    });

    test('should handle zero height gracefully', async () => {
      const visualizer = new GridVisualizer();
      await visualizer.init(canvas);
      const zeroHeightData = { ...mockData, height: 0 };
      // Should not throw, just skip drawing
      expect(() => visualizer.draw(ctx, zeroHeightData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with different bar counts', () => {
    test('should handle very small bar count', async () => {
      const visualizer = new RadialBarsVisualizer({
        barCount: 4,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });

    test('should handle very large bar count', async () => {
      const visualizer = new FrequencyRingsVisualizer({
        barCount: 256,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with custom colors', () => {
    test('should apply secondary color', async () => {
      const visualizer = new DoubleSpiralVisualizer({
        primaryColor: '#ff0000',
        secondaryColor: '#00ff00',
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });

    test('should apply background color', async () => {
      const visualizer = new PulseVisualizer({
        backgroundColor: '#333333',
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });

  describe('Visualizers with high sensitivity', () => {
    test('should handle very high sensitivity', async () => {
      const visualizer = new WaterfallBarsVisualizer({
        sensitivity: 5,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });

    test('should handle very low sensitivity', async () => {
      const visualizer = new LissajousVisualizer({
        sensitivity: 0.1,
      });
      await visualizer.init(canvas);
      expect(() => visualizer.draw(ctx, mockData)).not.toThrow();
      visualizer.destroy();
    });
  });
});
