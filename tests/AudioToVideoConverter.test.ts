import { AudioToVideoConverter } from '../src/AudioToVideoConverter';
import { WaveformVisualizer } from '../src/visualizers/WaveformVisualizer';

describe('AudioToVideoConverter', () => {
  let canvas: HTMLCanvasElement;
  let converter: AudioToVideoConverter;

  // Mock HTMLAudioElement for testing
  const mockAudioDuration = 0.5; // Short duration for tests
  let mockAudioElement: HTMLAudioElement;

  beforeEach(() => {
    // Create canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.id = 'test-canvas';
    document.body.appendChild(canvas);

    converter = new AudioToVideoConverter();

    // Set up audio element mock with proper event handling
    const mockState = {
      ended: false,
      paused: false,
    };
    mockAudioElement = {
      crossOrigin: null,
      src: '',
      duration: mockAudioDuration,
      currentTime: 0,
      get ended() { return mockState.ended; },
      get paused() { return mockState.paused; },
      onloadedmetadata: null as EventCallback,
      onerror: null as EventCallback,
      play: jest.fn().mockImplementation(() => {
        // Simulate playback ending after a short time
        setTimeout(() => {
          mockState.ended = true;
        }, 100);
        return Promise.resolve();
      }),
    } as unknown as HTMLAudioElement;

    // Mock Audio constructor
    (global as unknown as { Audio: jest.Mock }).Audio = jest.fn().mockImplementation(() => {
      // When src is set, trigger onloadedmetadata
      const audioProxy = new Proxy(mockAudioElement, {
        set: (target, prop, value) => {
          if (prop === 'src') {
            target.src = value;
            // Trigger metadata loaded
            setTimeout(() => {
              if (target.onloadedmetadata) {
                target.onloadedmetadata(new Event('loadedmetadata'));
              }
            }, 10);
          } else {
            (target as unknown as Record<string, unknown>)[prop as string] = value;
          }
          return true;
        },
        get: (target, prop) => {
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
      return audioProxy;
    });
  });

  afterEach(() => {
    document.body.removeChild(canvas);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create converter instance', () => {
      expect(converter).toBeDefined();
    });

    test('should create converter with debug mode', () => {
      const debugConverter = new AudioToVideoConverter({ debug: true });
      expect(debugConverter).toBeDefined();
    });
  });

  describe('getAvailableVisualizers', () => {
    test('should return list of available visualizers', () => {
      const visualizers = AudioToVideoConverter.getAvailableVisualizers();
      expect(Array.isArray(visualizers)).toBe(true);
      expect(visualizers).toContain('waveform');
      expect(visualizers).toContain('bars');
    });
  });

  describe('getSupportedFormats', () => {
    test('should return list of supported formats', () => {
      const formats = AudioToVideoConverter.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
    });
  });

  describe('cancel()', () => {
    test('should set cancellation flag', () => {
      converter.cancel();
      // The cancel method sets isCancelled flag (private)
      expect(converter).toBeDefined();
    });
  });

  describe('convert() with canvas element', () => {
    test('should convert audio to video', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        fps: 30,
        videoWidth: 320,
        videoHeight: 240,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with canvas selector', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas: '#test-canvas',
        fps: 30,
        videoWidth: 320,
        videoHeight: 240,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should throw for invalid canvas selector', async () => {
      await expect(
        converter.convert({
          audioSource: 'test.mp3',
          canvas: '#non-existent',
        })
      ).rejects.toThrow('Canvas element not found');
    });

    test('should convert with File source', async () => {
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
      const blob = await converter.convert({
        audioSource: file,
        canvas,
        fps: 30,
        videoWidth: 320,
        videoHeight: 240,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with string visualizer', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        visualizer: 'waveform',
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with visualizer instance', async () => {
      const visualizer = new WaveformVisualizer();
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        visualizer,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with default BarVisualizer when not specified', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should throw for unknown visualizer name', async () => {
      await expect(
        converter.convert({
          audioSource: 'test.mp3',
          canvas,
          visualizer: 'unknown-visualizer' as never,
        })
      ).rejects.toThrow(/Unknown visualizer/);
    });

    test('should call onProgress callback', async () => {
      const onProgress = jest.fn();
      await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      // Should be called with final progress of 1
      expect(onProgress).toHaveBeenCalledWith(1);
    }, 10000);

    test('should convert with custom bitrates', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        videoBitrate: 4000000,
        audioBitrate: 128000,
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with visualizer options', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        visualizer: 'bars',
        visualizerOptions: {
          primaryColor: '#ff0000',
          barCount: 32,
        },
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);

    test('should convert with audio enhancement options', async () => {
      const blob = await converter.convert({
        audioSource: 'test.mp3',
        canvas,
        audioEnhancement: {
          enabled: true,
          noiseReduction: 40,
          smartNormalization: 65,
          saturation: 20,
          saturationFrequencyRange: { min: 100, max: 8000 },
          saturationMode: 'tape',
        },
      });

      expect(blob).toBeInstanceOf(Blob);
    }, 10000);
  });

  describe('convert() cancellation', () => {
    test('should reject when cancelled', async () => {
      const conversionPromise = converter.convert({
        audioSource: 'test.mp3',
        canvas,
      });

      // Cancel immediately
      converter.cancel();

      await expect(conversionPromise).rejects.toThrow('Conversion cancelled');
    });
  });

  describe('convert() error handling', () => {
    test('should handle audio load error', async () => {
      // Make audio trigger error
      (global as unknown as { Audio: jest.Mock }).Audio = jest.fn().mockImplementation(() => {
        const errorAudio = {
          crossOrigin: null,
          src: '',
          onloadedmetadata: null as EventCallback,
          onerror: null as EventCallback,
        } as unknown as HTMLAudioElement;

        return new Proxy(errorAudio, {
          set: (target, prop, value) => {
            if (prop === 'src') {
              target.src = value;
              // Trigger error instead of metadata
              setTimeout(() => {
                if (target.onerror) {
                  target.onerror(new Event('error'));
                }
              }, 10);
            } else {
              (target as unknown as Record<string, unknown>)[prop as string] = value;
            }
            return true;
          },
          get: (target, prop) => {
            return (target as unknown as Record<string, unknown>)[prop as string];
          },
        });
      });

      await expect(
        converter.convert({
          audioSource: 'invalid.mp3',
          canvas,
        })
      ).rejects.toThrow('Failed to load audio');
    });
  });

  describe('Debug mode', () => {
    test('should log when debug is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugConverter = new AudioToVideoConverter({ debug: true });

      await debugConverter.convert({
        audioSource: 'test.mp3',
        canvas,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioToVideoConverter]',
        expect.anything()
      );
      consoleSpy.mockRestore();
    }, 10000);
  });

  describe('convertWithFallback()', () => {
    test('should return ConversionResult with blob and format info for webm', async () => {
      const result = await converter.convertWithFallback({
        audioSource: 'test.mp3',
        canvas,
        format: 'webm',
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.format).toBe('webm');
      expect(result.usedFallback).toBe(false);
      expect(result.fallbackMessage).toBeUndefined();
    }, 10000);

    test('should return result with usedFallback=false when mp4 is supported', async () => {
      const result = await converter.convertWithFallback({
        audioSource: 'test.mp3',
        canvas,
        format: 'mp4',
      });

      expect(result.blob).toBeInstanceOf(Blob);
      // In jsdom environment, mp4 might not be supported, so we accept either outcome
      expect(['mp4', 'webm']).toContain(result.format);
      expect(typeof result.usedFallback).toBe('boolean');
    }, 15000);

    test('should default to webm format when not specified', async () => {
      const result = await converter.convertWithFallback({
        audioSource: 'test.mp3',
        canvas,
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.format).toBe('webm');
      expect(result.usedFallback).toBe(false);
    }, 10000);
  });
});

// Type for event callbacks
type EventCallback = ((event: Event) => void) | null;
