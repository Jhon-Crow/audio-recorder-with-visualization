import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import {
  ConversionConfig,
  RecordingFormat,
  Visualizer,
  VisualizationData,
  VisualizerOptions,
} from './types';
import {
  WaveformVisualizer,
  BarVisualizer,
  CircularVisualizer,
  ParticleVisualizer,
  SpectrumGradientVisualizer,
  GlowWaveformVisualizer,
  VUMeterVisualizer,
  SpectrogramVisualizer,
  SpiralWaveformVisualizer,
  RadialBarsVisualizer,
  FrequencyRingsVisualizer,
} from './visualizers';

/**
 * Built-in visualizer registry
 */
const BUILT_IN_VISUALIZERS: Record<string, new (options?: VisualizerOptions) => Visualizer> = {
  waveform: WaveformVisualizer,
  bars: BarVisualizer,
  circular: CircularVisualizer,
  particles: ParticleVisualizer,
  'spectrum-gradient': SpectrumGradientVisualizer,
  'glow-waveform': GlowWaveformVisualizer,
  'vu-meter': VUMeterVisualizer,
  spectrogram: SpectrogramVisualizer,
  'spiral-waveform': SpiralWaveformVisualizer,
  'radial-bars': RadialBarsVisualizer,
  'frequency-rings': FrequencyRingsVisualizer,
};

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
  /** The video blob */
  blob: Blob;
  /** The format that was actually used (may differ from requested if fallback occurred) */
  format: RecordingFormat;
  /** Whether a fallback to a different format occurred */
  usedFallback: boolean;
  /** Message explaining any fallback that occurred */
  fallbackMessage?: string;
}

/**
 * Converts audio files to video with visualization
 */
export class AudioToVideoConverter {
  private debug: boolean;
  private isCancelled: boolean = false;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * Cancel the current conversion
   */
  cancel(): void {
    this.isCancelled = true;
    this.log('Conversion cancelled by user');
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AudioToVideoConverter]', ...args);
    }
  }

  /**
   * Create a built-in visualizer by name
   */
  private createBuiltInVisualizer(
    name: string,
    options?: VisualizerOptions
  ): Visualizer {
    const VisualizerClass = BUILT_IN_VISUALIZERS[name];
    if (!VisualizerClass) {
      throw new Error(
        `Unknown visualizer: ${name}. Available: ${Object.keys(BUILT_IN_VISUALIZERS).join(', ')}`
      );
    }
    return new VisualizerClass(options);
  }

  /**
   * Convert an audio file to video with visualization.
   * If the requested format fails (e.g., MP4 without hardware encoder),
   * automatically falls back to WebM format.
   * @param config - Conversion configuration
   * @returns Promise resolving to conversion result with blob and format info
   */
  async convertWithFallback(config: ConversionConfig): Promise<ConversionResult> {
    const requestedFormat = config.format ?? 'webm';

    // For MP4, test encoder support first and fall back to WebM if needed
    if (requestedFormat === 'mp4') {
      this.log('Testing MP4 encoder support...');
      const mp4Supported = await VideoRecorder.testEncoderSupport('mp4');

      if (!mp4Supported) {
        this.log('MP4 encoder not available, falling back to WebM');
        const blob = await this.convert({ ...config, format: 'webm' });
        return {
          blob,
          format: 'webm',
          usedFallback: true,
          fallbackMessage: 'MP4 encoding is not supported on this system. Your video was saved as WebM format instead, which is compatible with most modern browsers and video players.',
        };
      }
    }

    // Proceed with requested format
    const blob = await this.convert(config);
    return {
      blob,
      format: requestedFormat,
      usedFallback: false,
    };
  }

  /**
   * Convert an audio file to video with visualization
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob
   */
  async convert(config: ConversionConfig): Promise<Blob> {
    // Reset cancellation flag
    this.isCancelled = false;

    const {
      audioSource,
      canvas: canvasConfig,
      visualizer: visualizerConfig,
      visualizerOptions,
      fps = 30,
      videoWidth = 1920,
      videoHeight = 1080,
      videoBitrate = 8000000,
      audioBitrate = 192000,
      format = 'webm',
      onProgress,
    } = config;

    // Get canvas element
    let canvas: HTMLCanvasElement;
    if (typeof canvasConfig === 'string') {
      const element = document.querySelector(canvasConfig);
      if (!element || !(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas element not found: ${canvasConfig}`);
      }
      canvas = element;
    } else {
      canvas = canvasConfig;
    }

    // Set canvas size
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Get 2D context with color space settings for better color accuracy
    const ctx = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: false,
    });
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Set image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Create visualizer
    let visualizer: Visualizer;
    if (visualizerConfig) {
      if (typeof visualizerConfig === 'string') {
        visualizer = this.createBuiltInVisualizer(visualizerConfig, visualizerOptions);
      } else {
        visualizer = visualizerConfig;
      }
    } else {
      visualizer = new BarVisualizer(visualizerOptions);
    }
    // Wait for visualizer initialization (including image loading) to prevent flickering
    await visualizer.init(canvas, visualizerOptions);

    // Create audio element
    const audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';

    if (audioSource instanceof File) {
      audioElement.src = URL.createObjectURL(audioSource);
    } else {
      audioElement.src = audioSource;
    }

    // Wait for audio metadata to load
    await new Promise<void>((resolve, reject) => {
      audioElement.onloadedmetadata = () => resolve();
      audioElement.onerror = () => reject(new Error('Failed to load audio'));
    });

    const duration = audioElement.duration;
    this.log('Audio duration:', duration, 'seconds');

    // Create audio analyzer
    const analyzer = new AudioAnalyzer({
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      debug: this.debug,
    });

    await analyzer.connectAudioElement(audioElement);

    // Create video recorder
    const videoRecorder = new VideoRecorder({ debug: this.debug });

    // Since we've already connected the audio element, we'll capture from it differently
    // Create a new stream from the audio element for recording
    let audioStream: MediaStream | undefined;

    try {
      // Try to capture audio using captureStream if available
      if ('captureStream' in audioElement) {
        audioStream = (audioElement as HTMLMediaElement & { captureStream(): MediaStream }).captureStream();
      } else if ('mozCaptureStream' in audioElement) {
        audioStream = (audioElement as HTMLMediaElement & { mozCaptureStream(): MediaStream }).mozCaptureStream();
      }
    } catch (e) {
      this.log('Could not capture stream from audio element, video will have no audio');
    }

    // Render loop with improved timing and reliability
    const frameInterval = 1000 / fps;
    let lastFrameTime = 0;
    let frameCount = 0;

    return new Promise((resolve, reject) => {
      let hasErrored = false;

      // Set up error handler for encoder errors before starting
      videoRecorder.onError((error) => {
        if (hasErrored) return;
        hasErrored = true;
        this.log('Encoder error during conversion:', error.message);
        audioElement.pause();
        videoRecorder.cancel();
        visualizer.destroy();
        analyzer.destroy();
        if (audioSource instanceof File) {
          URL.revokeObjectURL(audioElement.src);
        }
        // Provide helpful error message with format recommendation
        const helpfulMessage = format === 'mp4'
          ? `${error.message}. Try using WebM format instead for better compatibility.`
          : error.message;
        reject(new Error(`Encoding failed: ${helpfulMessage}`));
      });

      // Start recording
      videoRecorder.start(canvas, audioStream, {
        format,
        fps,
        videoBitrate,
        audioBitrate,
      });

      // Start playback
      audioElement.play();
      this.log('Started playback and recording');

      const cleanup = (): void => {
        visualizer.destroy();
        analyzer.destroy();
        if (audioSource instanceof File) {
          URL.revokeObjectURL(audioElement.src);
        }
      };

      const renderFrame = (): void => {
        if (hasErrored) return;

        // Check for cancellation
        if (this.isCancelled) {
          hasErrored = true;
          videoRecorder.cancel();
          cleanup();
          reject(new Error('Conversion cancelled by user'));
          return;
        }

        try {
          const now = performance.now();

          if (now - lastFrameTime >= frameInterval) {
            lastFrameTime = now;
            frameCount++;

            const data: VisualizationData = {
              timeDomainData: analyzer.getTimeDomainData(),
              frequencyData: analyzer.getFrequencyData(),
              timestamp: now,
              width: canvas.width,
              height: canvas.height,
              sampleRate: analyzer.sampleRate,
              fftSize: analyzer.fftSize,
            };

            visualizer.draw(ctx, data);

            // Report progress
            if (onProgress && duration > 0) {
              const progress = Math.min(audioElement.currentTime / duration, 1);
              onProgress(progress);
            }
          }

          // Continue until audio ends or cancelled
          if (!audioElement.ended && !audioElement.paused && !this.isCancelled) {
            requestAnimationFrame(renderFrame);
          } else {
            // Audio ended, stop recording
            this.log('Audio playback ended after', frameCount, 'frames');

            // Wait longer to ensure all frames are captured by MediaRecorder
            setTimeout(async () => {
              if (hasErrored) return;

              try {
                const blob = await videoRecorder.stop();

                // Cleanup
                cleanup();

                if (onProgress) {
                  onProgress(1);
                }

                this.log('Conversion complete, blob size:', blob.size, 'bytes');

                // Verify blob is valid
                if (blob.size === 0) {
                  reject(new Error('Export failed: video blob is empty'));
                  return;
                }

                resolve(blob);
              } catch (error) {
                hasErrored = true;
                cleanup();
                reject(error);
              }
            }, 1000); // Increased from 500ms to 1000ms for better reliability
          }
        } catch (error) {
          hasErrored = true;
          videoRecorder.cancel();
          cleanup();
          reject(error);
        }
      };

      audioElement.onerror = () => {
        hasErrored = true;
        videoRecorder.cancel();
        cleanup();
        reject(new Error('Audio playback error'));
      };

      // Render first frame immediately to ensure recording starts with content
      requestAnimationFrame(renderFrame);
    });
  }

  /**
   * Get list of available built-in visualizers
   */
  static getAvailableVisualizers(): string[] {
    return Object.keys(BUILT_IN_VISUALIZERS);
  }

  /**
   * Get supported output formats
   */
  static getSupportedFormats(): string[] {
    return VideoRecorder.getSupportedFormats();
  }
}
