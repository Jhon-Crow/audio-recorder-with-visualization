import { BaseVisualizer } from '../src/visualizers/BaseVisualizer';
import { VisualizationData } from '../src/types';

// Create a concrete implementation for testing
class TestVisualizer extends BaseVisualizer {
  readonly id = 'test';
  readonly name = 'Test Visualizer';

  // Expose protected methods for testing
  public testDrawBackground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    this.drawBackground(ctx, data);
  }

  public testDrawForeground(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    this.drawForeground(ctx, data);
  }

  public testApplyLayerEffect(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    this.applyLayerEffect(ctx, data);
  }

  public testApplyTransform(ctx: CanvasRenderingContext2D, data: { width: number; height: number }): void {
    this.applyTransform(ctx, data);
  }

  public testRestoreTransform(ctx: CanvasRenderingContext2D, data: { width: number; height: number }): void {
    this.restoreTransform(ctx, data);
  }

  public testCreateGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    return this.createGradient(ctx, 0, 0, 100, 100);
  }

  public testIsValidDimensions(width: number, height: number): boolean {
    return this.isValidDimensions(width, height);
  }

  public testGetFrequencyDataSlice(frequencyData: Uint8Array, minBins?: number): Uint8Array {
    return this.getFrequencyDataSlice(frequencyData, minBins);
  }

  public testCalculateBandAverage(frequencyData: Uint8Array, startIndex: number, count: number): number {
    return this.calculateBandAverage(frequencyData, startIndex, count);
  }

  public testApplySensitivity(value: number): number {
    return this.applySensitivity(value);
  }

  public testApplyADSRSmoothing(previousValue: number, targetValue: number): number {
    return this.applyADSRSmoothing(previousValue, targetValue);
  }

  public getBackgroundImageElement(): HTMLImageElement | null {
    return this.backgroundImageElement;
  }

  public getForegroundImageElement(): HTMLImageElement | null {
    return this.foregroundImageElement;
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    this.drawBackground(ctx, data);
    ctx.fillStyle = this.options.primaryColor!;
    ctx.fillRect(0, 0, data.width, data.height);
    this.drawForeground(ctx, data);
  }
}

describe('BaseVisualizer', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let visualizer: TestVisualizer;
  let mockData: VisualizationData;

  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;

    visualizer = new TestVisualizer();

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

  afterEach(() => {
    visualizer.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default options', async () => {
      await visualizer.init(canvas);
      expect(visualizer).toBeDefined();
    });

    test('should initialize with custom options', async () => {
      await visualizer.init(canvas, {
        primaryColor: '#ff0000',
        secondaryColor: '#0000ff',
      });
      expect(visualizer).toBeDefined();
    });

    test('should merge custom options in init', async () => {
      const v = new TestVisualizer({ custom: { foo: 'bar' } });
      await v.init(canvas, { custom: { baz: 'qux' } });
      // Both custom options should be preserved
      expect(v).toBeDefined();
      v.destroy();
    });
  });

  describe('setOptions', () => {
    test('should update options', async () => {
      await visualizer.init(canvas);
      await visualizer.setOptions({ primaryColor: '#00ff00' });
      expect(visualizer).toBeDefined();
    });

    test('should merge custom options', async () => {
      await visualizer.init(canvas);
      await visualizer.setOptions({ custom: { newOption: 'value' } });
      expect(visualizer).toBeDefined();
    });

    test('should reload images when backgroundImage changes', async () => {
      await visualizer.init(canvas);
      await visualizer.setOptions({ backgroundImage: validPng });
      expect(visualizer.getBackgroundImageElement()).not.toBeNull();
    });

    test('should reload images when foregroundImage changes', async () => {
      await visualizer.init(canvas);
      await visualizer.setOptions({ foregroundImage: validPng });
      expect(visualizer.getForegroundImageElement()).not.toBeNull();
    });
  });

  describe('Image loading', () => {
    test('should load background image from string URL', async () => {
      const v = new TestVisualizer({ backgroundImage: validPng });
      await v.init(canvas);
      expect(v.getBackgroundImageElement()).not.toBeNull();
      v.destroy();
    });

    test('should load foreground image from string URL', async () => {
      const v = new TestVisualizer({ foregroundImage: validPng });
      await v.init(canvas);
      expect(v.getForegroundImageElement()).not.toBeNull();
      v.destroy();
    });

    test('should accept HTMLImageElement directly', async () => {
      const img = new Image();
      const v = new TestVisualizer({ backgroundImage: img as unknown as string });
      await v.init(canvas);
      expect(v.getBackgroundImageElement()).toBe(img);
      v.destroy();
    });

    test('should handle image load error gracefully', async () => {
      // Mock console.warn to verify warning is logged
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock image that triggers error
      const originalImage = global.Image;
      (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(() => {
        const img = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          src: '',
        };
        // When src is set, trigger onerror
        Object.defineProperty(img, 'src', {
          set: () => {
            setTimeout(() => {
              if (img.onerror) img.onerror();
            }, 0);
          },
          get: () => '',
        });
        return img;
      });

      const v = new TestVisualizer({ backgroundImage: 'invalid-url.png' });
      await v.init(canvas);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(warnSpy).toHaveBeenCalled();
      v.destroy();

      global.Image = originalImage;
      warnSpy.mockRestore();
    });
  });

  describe('isValidDimensions', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should return true for valid dimensions', () => {
      expect(visualizer.testIsValidDimensions(800, 600)).toBe(true);
    });

    test('should return false for zero width', () => {
      expect(visualizer.testIsValidDimensions(0, 600)).toBe(false);
    });

    test('should return false for zero height', () => {
      expect(visualizer.testIsValidDimensions(800, 0)).toBe(false);
    });

    test('should return false for negative dimensions', () => {
      expect(visualizer.testIsValidDimensions(-1, 600)).toBe(false);
      expect(visualizer.testIsValidDimensions(800, -1)).toBe(false);
    });

    test('should return false for Infinity', () => {
      expect(visualizer.testIsValidDimensions(Infinity, 600)).toBe(false);
    });

    test('should return false for NaN', () => {
      expect(visualizer.testIsValidDimensions(NaN, 600)).toBe(false);
    });
  });

  describe('getFrequencyDataSlice', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should return full data when frequencyWidth is 100', async () => {
      const v = new TestVisualizer({ frequencyWidth: 100 });
      await v.init(canvas);
      const data = new Uint8Array(1024).fill(128);
      const result = v.testGetFrequencyDataSlice(data);
      expect(result.length).toBe(1024);
      v.destroy();
    });

    test('should return partial data when frequencyWidth is less than 100', async () => {
      const v = new TestVisualizer({ frequencyWidth: 50 });
      await v.init(canvas);
      const data = new Uint8Array(1024).fill(128);
      const result = v.testGetFrequencyDataSlice(data);
      expect(result.length).toBeLessThanOrEqual(1024);
      v.destroy();
    });

    test('should respect minBins parameter', async () => {
      const v = new TestVisualizer({ frequencyWidth: 10 });
      await v.init(canvas);
      const data = new Uint8Array(1024).fill(128);
      const result = v.testGetFrequencyDataSlice(data, 200);
      expect(result.length).toBeGreaterThanOrEqual(200);
      v.destroy();
    });
  });

  describe('calculateBandAverage', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should calculate average correctly', () => {
      const data = new Uint8Array([100, 150, 200]);
      expect(visualizer.testCalculateBandAverage(data, 0, 3)).toBe(150);
    });

    test('should return 0 for invalid count', () => {
      const data = new Uint8Array([100, 150, 200]);
      expect(visualizer.testCalculateBandAverage(data, 0, 0)).toBe(0);
      expect(visualizer.testCalculateBandAverage(data, 0, -1)).toBe(0);
    });

    test('should return 0 for invalid startIndex', () => {
      const data = new Uint8Array([100, 150, 200]);
      expect(visualizer.testCalculateBandAverage(data, 10, 3)).toBe(0);
    });

    test('should clamp count to available data', () => {
      const data = new Uint8Array([100, 150, 200]);
      // Count 5 but only 3 elements available
      expect(visualizer.testCalculateBandAverage(data, 0, 5)).toBe(150);
    });
  });

  describe('applySensitivity', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should return value unchanged when sensitivity is 1.0', async () => {
      const v = new TestVisualizer({ sensitivity: 1.0 });
      await v.init(canvas);
      expect(v.testApplySensitivity(100)).toBe(100);
      v.destroy();
    });

    test('should multiply value by sensitivity', async () => {
      const v = new TestVisualizer({ sensitivity: 2.0 });
      await v.init(canvas);
      expect(v.testApplySensitivity(100)).toBe(200);
      v.destroy();
    });

    test('should clamp result to 255 max', async () => {
      const v = new TestVisualizer({ sensitivity: 3.0 });
      await v.init(canvas);
      expect(v.testApplySensitivity(100)).toBe(255);
      v.destroy();
    });
  });

  describe('applyADSRSmoothing', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should smooth rising values (attack phase)', () => {
      const result = visualizer.testApplyADSRSmoothing(50, 100);
      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThanOrEqual(100);
    });

    test('should smooth falling values (release phase)', () => {
      const result = visualizer.testApplyADSRSmoothing(100, 50);
      expect(result).toBeLessThan(100);
    });

    test('should handle custom ADSR parameters', async () => {
      const v = new TestVisualizer({
        adsrAttack: 0,
        adsrDecay: 0,
        adsrSustain: 50,
        adsrRelease: 0,
      });
      await v.init(canvas);
      // With attack=0, should immediately reach target
      const result = v.testApplyADSRSmoothing(0, 100);
      expect(result).toBe(100);
      v.destroy();
    });
  });

  describe('Layer effects', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should apply no effect when layerEffect is none', async () => {
      const v = new TestVisualizer({ layerEffect: 'none' });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply blur effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'blur', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply brightness effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'brightness', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply contrast effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'contrast', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply grayscale effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'grayscale', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply invert effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'invert', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply sepia effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'sepia', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply saturate effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'saturate', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply hue-rotate effect', async () => {
      const v = new TestVisualizer({ layerEffect: 'hue-rotate', layerEffectIntensity: 50 });
      await v.init(canvas);
      expect(() => v.testApplyLayerEffect(ctx, mockData)).not.toThrow();
      v.destroy();
    });
  });

  describe('Background drawing', () => {
    test('should draw background color', async () => {
      const v = new TestVisualizer({ backgroundColor: '#ff0000' });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should skip background when drawBackground is false', async () => {
      const v = new TestVisualizer({ drawBackground: false });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with cover mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'cover',
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with contain mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'contain',
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with stretch mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'stretch',
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with tile mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'tile',
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with center mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'center',
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should draw background image with custom mode', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        backgroundSizeMode: 'custom',
        backgroundWidth: 400,
        backgroundHeight: 300,
      });
      await v.init(canvas);
      expect(() => v.testDrawBackground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

  });

  describe('Foreground drawing', () => {
    test('should draw foreground image', async () => {
      const v = new TestVisualizer({
        foregroundImage: validPng,
      });
      await v.init(canvas);
      expect(() => v.testDrawForeground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply foreground alpha', async () => {
      const v = new TestVisualizer({
        foregroundImage: validPng,
        foregroundAlpha: 0.5,
      });
      await v.init(canvas);
      expect(() => v.testDrawForeground(ctx, mockData)).not.toThrow();
      v.destroy();
    });

  });

  describe('Transform methods', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should apply offset transform', async () => {
      const v = new TestVisualizer({
        offsetX: 50,
        offsetY: 30,
      });
      await v.init(canvas);
      expect(() => v.testApplyTransform(ctx, mockData)).not.toThrow();
      expect(() => v.testRestoreTransform(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply scale transform', async () => {
      const v = new TestVisualizer({
        scale: 1.5,
      });
      await v.init(canvas);
      expect(() => v.testApplyTransform(ctx, mockData)).not.toThrow();
      expect(() => v.testRestoreTransform(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply horizontal mirror', async () => {
      const v = new TestVisualizer({
        mirrorHorizontal: true,
      });
      await v.init(canvas);
      expect(() => v.testApplyTransform(ctx, mockData)).not.toThrow();
      expect(() => v.testRestoreTransform(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should apply combined transforms', async () => {
      const v = new TestVisualizer({
        offsetX: 10,
        offsetY: 20,
        scale: 0.8,
        mirrorHorizontal: true,
      });
      await v.init(canvas);
      expect(() => v.testApplyTransform(ctx, mockData)).not.toThrow();
      expect(() => v.testRestoreTransform(ctx, mockData)).not.toThrow();
      v.destroy();
    });

    test('should not transform when no offset or scale', () => {
      expect(() => visualizer.testApplyTransform(ctx, mockData)).not.toThrow();
      expect(() => visualizer.testRestoreTransform(ctx, mockData)).not.toThrow();
    });
  });

  describe('createGradient', () => {
    beforeEach(async () => {
      await visualizer.init(canvas);
    });

    test('should create linear gradient', () => {
      const gradient = visualizer.testCreateGradient(ctx);
      expect(gradient).toBeDefined();
    });
  });

  describe('destroy', () => {
    test('should clean up resources', async () => {
      const v = new TestVisualizer({
        backgroundImage: validPng,
        foregroundImage: validPng,
      });
      await v.init(canvas);

      v.destroy();

      expect(v.getBackgroundImageElement()).toBeNull();
      expect(v.getForegroundImageElement()).toBeNull();
    });
  });
});
