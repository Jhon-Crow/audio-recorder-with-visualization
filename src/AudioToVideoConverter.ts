import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import {
  ConversionConfig,
  Visualizer,
  VisualizationData,
  VisualizerOptions,
} from './types';
import {
  WaveformVisualizer,
  BarVisualizer,
  CircularVisualizer,
  ParticleVisualizer,
} from './visualizers';

/**
 * Built-in visualizer registry
 */
const BUILT_IN_VISUALIZERS: Record<string, new (options?: VisualizerOptions) => Visualizer> = {
  waveform: WaveformVisualizer,
  bars: BarVisualizer,
  circular: CircularVisualizer,
  particles: ParticleVisualizer,
};

/**
 * Converts audio files to video with visualization
 */
export class AudioToVideoConverter {
  private debug: boolean;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
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
   * Convert an audio file to video with visualization
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob
   */
  async convert(config: ConversionConfig): Promise<Blob> {
    const {
      audioSource,
      canvas: canvasConfig,
      visualizer: visualizerConfig,
      visualizerOptions,
      fps = 30,
      videoWidth = 1280,
      videoHeight = 720,
      videoBitrate = 2500000,
      audioBitrate = 128000,
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

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

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

    // Render loop
    const frameInterval = 1000 / fps;
    let lastFrameTime = 0;

    return new Promise((resolve, reject) => {
      const renderFrame = (): void => {
        const now = performance.now();

        if (now - lastFrameTime >= frameInterval) {
          lastFrameTime = now;

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
          if (onProgress) {
            const progress = Math.min(audioElement.currentTime / duration, 1);
            onProgress(progress);
          }
        }

        // Continue until audio ends
        if (!audioElement.ended && !audioElement.paused) {
          requestAnimationFrame(renderFrame);
        } else {
          // Audio ended, stop recording
          this.log('Audio playback ended');

          // Wait a bit to ensure final frames are captured
          setTimeout(async () => {
            try {
              const blob = await videoRecorder.stop();

              // Cleanup
              visualizer.destroy();
              analyzer.destroy();
              if (audioSource instanceof File) {
                URL.revokeObjectURL(audioElement.src);
              }

              if (onProgress) {
                onProgress(1);
              }

              this.log('Conversion complete, blob size:', blob.size);
              resolve(blob);
            } catch (error) {
              reject(error);
            }
          }, 500);
        }
      };

      audioElement.onerror = () => {
        videoRecorder.cancel();
        visualizer.destroy();
        analyzer.destroy();
        reject(new Error('Audio playback error'));
      };

      renderFrame();
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
