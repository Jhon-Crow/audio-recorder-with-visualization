import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import { OfflineAudioAnalyzer } from './core/OfflineAudioAnalyzer';
import {
  ConversionConfig,
  RecordingFormat,
  Visualizer,
  VisualizationData,
  VisualizerOptions,
} from './types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
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
    // Get target resolution for encoder testing
    // This is important because hardware encoders may support low resolutions
    // but fail at higher ones (e.g., 1080p or 4K)
    const videoWidth = config.videoWidth ?? 1920;
    const videoHeight = config.videoHeight ?? 1080;

    // For MP4, test encoder support first and fall back to WebM if needed
    if (requestedFormat === 'mp4') {
      this.log('Testing MP4 encoder support at', videoWidth, 'x', videoHeight, '...');
      // Test at target resolution to catch hardware encoder limitations
      const mp4Supported = await VideoRecorder.testEncoderSupport('mp4', 2000, videoWidth, videoHeight);

      if (!mp4Supported) {
        this.log('MP4 encoder not available at target resolution, falling back to WebM');
        const blob = await this.convert({ ...config, format: 'webm' });
        return {
          blob,
          format: 'webm',
          usedFallback: true,
          fallbackMessage: 'MP4 encoding is not supported on this system at the requested resolution. Your video was saved as WebM format instead, which is compatible with most modern browsers and video players.',
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
   * Convert an audio file to video with visualization using pre-computed analysis
   *
   * This method pre-analyzes the audio file before conversion, which means:
   * - The analysis phase is fast (typically 1-3 seconds)
   * - The visualization data is cached and ready
   * - During conversion, frames are drawn from cache (no real-time FFT computation)
   * - Audio still plays at normal speed to ensure proper sync with video
   *
   * The progress bar shows:
   * - 0-30%: Audio analysis phase (fast)
   * - 30-100%: Video encoding phase (plays audio)
   *
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob
   */
  async convertOffline(config: ConversionConfig): Promise<Blob> {
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

    this.log('Starting offline conversion...');

    // Create offline analyzer and analyze the audio
    const offlineAnalyzer = new OfflineAudioAnalyzer({
      fftSize: 2048,
      debug: this.debug,
    });

    // Report analysis progress (0-30% of total)
    const analysisProgress = (progress: number): void => {
      if (onProgress) {
        onProgress(progress * 0.3);
      }
    };

    let arrayBuffer: ArrayBuffer;
    if (audioSource instanceof File) {
      arrayBuffer = await audioSource.arrayBuffer();
    } else {
      const response = await fetch(audioSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    }

    // Analyze the audio to get visualization data
    const analysisCache = await offlineAnalyzer.analyzeAudio(arrayBuffer, analysisProgress);
    this.log('Audio analysis complete:', analysisCache.segmentCount, 'segments');

    if (this.isCancelled) {
      visualizer.destroy();
      offlineAnalyzer.destroy();
      throw new Error('Conversion cancelled by user');
    }

    const duration = analysisCache.duration;
    this.log('Audio duration:', duration, 'seconds');

    // Now create audio element and play it while recording
    // The visualization will use pre-computed data from cache
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

    // Create video recorder
    const videoRecorder = new VideoRecorder({ debug: this.debug });

    // Get audio stream for recording
    let audioStream: MediaStream | undefined;
    try {
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

    // Render loop using cached data
    const frameInterval = 1000 / fps;
    let lastFrameTime = 0;
    let frameCount = 0;

    return new Promise((resolve, reject) => {
      let hasErrored = false;

      const cleanup = (): void => {
        visualizer.destroy();
        offlineAnalyzer.destroy();
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

            // Get current audio time and fetch cached visualization data
            const currentTime = audioElement.currentTime;
            const cachedData = offlineAnalyzer.getDataAtTime(currentTime);

            if (cachedData) {
              const data: VisualizationData = {
                timeDomainData: cachedData.timeDomainData,
                frequencyData: cachedData.frequencyData,
                timestamp: now,
                width: canvas.width,
                height: canvas.height,
                sampleRate: analysisCache.sampleRate,
                fftSize: analysisCache.fftSize,
              };

              visualizer.draw(ctx, data);
            }

            // Report progress (30-100% for encoding phase)
            if (onProgress && duration > 0) {
              const progress = 0.3 + (currentTime / duration) * 0.7;
              onProgress(Math.min(progress, 1));
            }
          }

          // Continue until audio ends or cancelled
          if (!audioElement.ended && !audioElement.paused && !this.isCancelled) {
            requestAnimationFrame(renderFrame);
          } else {
            // Audio ended, stop recording
            this.log('Audio playback ended after', frameCount, 'frames');

            // Wait for MediaRecorder to capture final frames
            setTimeout(async () => {
              if (hasErrored) return;

              try {
                const blob = await videoRecorder.stop();

                // Cleanup
                cleanup();

                if (onProgress) {
                  onProgress(1);
                }

                this.log('Offline conversion complete, blob size:', blob.size, 'bytes');

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
            }, 1000);
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

      // Start render loop
      requestAnimationFrame(renderFrame);
    });
  }

  /**
   * Check if WebCodecs API is supported in this browser
   */
  static isWebCodecsSupported(): boolean {
    return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
  }

  /**
   * List of video codecs to try in order of preference
   * H.264 profiles: Baseline (42001f), Main (4d001f), High (64001f)
   * VP9, AV1, HEVC as fallbacks (all supported by mp4-muxer)
   */
  private static readonly VIDEO_CODECS = [
    { codec: 'avc1.42001f', name: 'H.264 Baseline', muxerCodec: 'avc' as const },
    { codec: 'avc1.4d001f', name: 'H.264 Main', muxerCodec: 'avc' as const },
    { codec: 'avc1.64001f', name: 'H.264 High', muxerCodec: 'avc' as const },
    { codec: 'vp09.00.10.08', name: 'VP9', muxerCodec: 'vp9' as const },
    { codec: 'av01.0.04M.08', name: 'AV1', muxerCodec: 'av1' as const },
    { codec: 'hev1.1.6.L93.B0', name: 'HEVC', muxerCodec: 'hevc' as const },
  ];

  /**
   * List of audio codecs to try in order of preference
   */
  private static readonly AUDIO_CODECS = [
    { codec: 'mp4a.40.2', name: 'AAC-LC' },
    { codec: 'mp4a.40.5', name: 'AAC-HE' },
    { codec: 'opus', name: 'Opus' },
  ];

  /**
   * Find a supported video codec configuration
   */
  private async findSupportedVideoCodec(
    width: number,
    height: number,
    bitrate: number,
    framerate: number
  ): Promise<{ codec: string; name: string; muxerCodec: 'avc' | 'vp9' | 'av1' | 'hevc'; config: VideoEncoderConfig } | null> {
    for (const codecInfo of AudioToVideoConverter.VIDEO_CODECS) {
      const config: VideoEncoderConfig = {
        codec: codecInfo.codec,
        width,
        height,
        bitrate,
        framerate,
      };

      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          this.log(`Video codec ${codecInfo.name} (${codecInfo.codec}) is supported`);
          return { ...codecInfo, config };
        }
        this.log(`Video codec ${codecInfo.name} (${codecInfo.codec}) not supported`);
      } catch (e) {
        this.log(`Error checking video codec ${codecInfo.name}:`, e);
      }
    }
    return null;
  }

  /**
   * Find a supported audio codec configuration
   */
  private async findSupportedAudioCodec(
    sampleRate: number,
    numberOfChannels: number,
    bitrate: number
  ): Promise<{ codec: string; name: string; config: AudioEncoderConfig } | null> {
    for (const codecInfo of AudioToVideoConverter.AUDIO_CODECS) {
      const config: AudioEncoderConfig = {
        codec: codecInfo.codec,
        sampleRate,
        numberOfChannels,
        bitrate,
      };

      try {
        const support = await AudioEncoder.isConfigSupported(config);
        if (support.supported) {
          this.log(`Audio codec ${codecInfo.name} (${codecInfo.codec}) is supported`);
          return { ...codecInfo, config };
        }
        this.log(`Audio codec ${codecInfo.name} (${codecInfo.codec}) not supported`);
      } catch (e) {
        this.log(`Error checking audio codec ${codecInfo.name}:`, e);
      }
    }
    return null;
  }

  /**
   * Convert an audio file to video with visualization using true offline rendering
   *
   * This method performs REAL faster-than-realtime rendering using WebCodecs API:
   * - No audio plays through speakers during conversion
   * - No real-time playback required - encoding happens as fast as CPU allows
   * - Typically 5-20x faster than real-time depending on hardware
   * - Output includes full audio track
   *
   * Process:
   * - Phase 1 (0-10%): Audio analysis - instant
   * - Phase 2 (10-90%): Video frame encoding - very fast (5-20x real-time)
   * - Phase 3 (90-100%): Audio encoding and muxing - very fast
   *
   * Total time for a 3 minute song: typically 10-30 seconds total
   *
   * Note: Requires WebCodecs API support (Chrome 94+, Edge 94+, Opera 80+)
   * Falls back to regular convert() method if WebCodecs is not available.
   *
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob with audio
   */
  async convertFast(config: ConversionConfig): Promise<Blob> {
    // Check for WebCodecs support
    if (!AudioToVideoConverter.isWebCodecsSupported()) {
      this.log('WebCodecs not supported, falling back to regular convert()');
      return this.convert(config);
    }

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
      willReadFrequently: true, // Required for VideoFrame creation from canvas
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

    this.log('Starting WebCodecs fast offline conversion...');

    // Create offline analyzer and analyze the audio
    const offlineAnalyzer = new OfflineAudioAnalyzer({
      fftSize: 2048,
      debug: this.debug,
    });

    // Report analysis progress (0-10% of total)
    const analysisProgress = (progress: number): void => {
      if (onProgress) {
        onProgress(progress * 0.1);
      }
    };

    let arrayBuffer: ArrayBuffer;
    if (audioSource instanceof File) {
      arrayBuffer = await audioSource.arrayBuffer();
    } else {
      const response = await fetch(audioSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    }

    // Analyze the audio to get visualization data
    const analysisCache = await offlineAnalyzer.analyzeAudio(arrayBuffer, analysisProgress);
    this.log('Audio analysis complete:', analysisCache.segmentCount, 'segments');

    if (this.isCancelled) {
      visualizer.destroy();
      offlineAnalyzer.destroy();
      throw new Error('Conversion cancelled by user');
    }

    const duration = analysisCache.duration;
    const totalFrames = Math.ceil(duration * fps);
    const sampleRate = analysisCache.sampleRate;
    this.log('Audio duration:', duration, 'seconds,', totalFrames, 'frames to render');

    const cleanup = (): void => {
      visualizer.destroy();
      offlineAnalyzer.destroy();
    };

    // Track encoder error state to prevent encoding on closed codec
    // Using 'unknown' type since DOMException can be thrown but isn't strictly an Error
    let encoderError: Error | DOMException | unknown = null;

    try {
      // Find supported video codec
      const videoCodecInfo = await this.findSupportedVideoCodec(
        videoWidth,
        videoHeight,
        videoBitrate,
        fps
      );

      if (!videoCodecInfo) {
        this.log('No supported video codec found, falling back to regular convert()');
        return this.convert(config);
      }

      // Find supported audio codec
      const audioCodecInfo = await this.findSupportedAudioCodec(
        sampleRate,
        analysisCache.audioBuffer.numberOfChannels,
        audioBitrate
      );

      if (!audioCodecInfo) {
        this.log('No supported audio codec found, falling back to regular convert()');
        return this.convert(config);
      }

      // Determine the appropriate audio codec for muxer based on the selected codec
      // mp4-muxer supports 'aac' and 'opus' audio codecs
      const muxerAudioCodec = audioCodecInfo.codec.startsWith('mp4a') ? 'aac' : 'opus';

      // Create mp4 muxer with detected codecs
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: videoCodecInfo.muxerCodec,
          width: videoWidth,
          height: videoHeight,
        },
        audio: {
          codec: muxerAudioCodec as 'aac' | 'opus',
          numberOfChannels: analysisCache.audioBuffer.numberOfChannels,
          sampleRate: sampleRate,
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });

      // Configure video encoder with error tracking
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          this.log('VideoEncoder error:', e);
          encoderError = e;
        },
      });

      videoEncoder.configure(videoCodecInfo.config);
      this.log('Video encoder configured:', videoCodecInfo.config);

      // Configure audio encoder with error tracking
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => {
          this.log('AudioEncoder error:', e);
          encoderError = e;
        },
      });

      audioEncoder.configure(audioCodecInfo.config);
      this.log('Audio encoder configured:', audioCodecInfo.config);

      const startTime = performance.now();

      // Encode video frames as fast as possible
      // Process in batches to allow encoder queue flushing and prevent GPU memory exhaustion
      const BATCH_SIZE = 60; // Process 60 frames then flush (2 seconds at 30fps)
      this.log('Encoding video frames...');

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        // Check for encoder errors before each frame
        if (encoderError !== null) {
          this.log('Encoder error detected, aborting:', encoderError);
          videoEncoder.close();
          audioEncoder.close();
          cleanup();
          throw encoderError;
        }

        if (this.isCancelled) {
          videoEncoder.close();
          audioEncoder.close();
          cleanup();
          throw new Error('Conversion cancelled by user');
        }

        // Calculate the simulated time for this frame
        const simulatedTime = frameIndex / fps;

        // Get cached visualization data for this time
        const cachedData = offlineAnalyzer.getDataAtTime(simulatedTime);

        if (cachedData) {
          const data: VisualizationData = {
            timeDomainData: cachedData.timeDomainData,
            frequencyData: cachedData.frequencyData,
            timestamp: simulatedTime * 1000,
            width: canvas.width,
            height: canvas.height,
            sampleRate: sampleRate,
            fftSize: analysisCache.fftSize,
          };

          visualizer.draw(ctx, data);
        }

        // Create VideoFrame from canvas
        const timestamp = Math.round((frameIndex / fps) * 1_000_000); // microseconds
        const frame = new VideoFrame(canvas, {
          timestamp: timestamp,
          duration: Math.round(1_000_000 / fps),
        });

        // Check encoder state before encoding
        if (videoEncoder.state === 'closed') {
          frame.close();
          throw new Error('VideoEncoder closed unexpectedly');
        }

        try {
          // Encode frame (keyframe every 2 seconds for good seeking)
          const isKeyFrame = frameIndex % (fps * 2) === 0;
          videoEncoder.encode(frame, { keyFrame: isKeyFrame });
        } finally {
          // Always close the frame to prevent memory leaks and GPU resource exhaustion
          frame.close();
        }

        // Report progress (10-80% for video encoding)
        if (onProgress && frameIndex % 10 === 0) {
          const progress = 0.1 + (frameIndex / totalFrames) * 0.7;
          onProgress(Math.min(progress, 0.8));
        }

        // Periodically flush encoder and yield to prevent GPU memory exhaustion
        // This is critical for long videos to prevent "Can't readback frame textures" error
        if ((frameIndex + 1) % BATCH_SIZE === 0) {
          // Flush encoder to process queued frames before adding more
          await videoEncoder.flush();
          // Yield to allow GPU resources to be freed
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      // Check for errors after video encoding loop
      if (encoderError !== null) {
        videoEncoder.close();
        audioEncoder.close();
        cleanup();
        throw encoderError;
      }

      // Final flush of video encoder
      await videoEncoder.flush();
      this.log('Video encoding complete');

      const videoEncodeTime = performance.now() - startTime;
      const videoSpeedup = (duration * 1000) / videoEncodeTime;
      this.log(`Video encoded in ${(videoEncodeTime / 1000).toFixed(2)}s (${videoSpeedup.toFixed(1)}x faster than real-time)`);

      // Report progress
      if (onProgress) {
        onProgress(0.85);
      }

      // Encode audio
      this.log('Encoding audio...');
      const audioBuffer = analysisCache.audioBuffer;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const totalSamples = audioBuffer.length;

      // Process audio in chunks to avoid memory issues
      const samplesPerChunk = 4096; // Process in 4096-sample chunks
      const totalChunks = Math.ceil(totalSamples / samplesPerChunk);
      const AUDIO_FLUSH_INTERVAL = 100; // Flush every 100 chunks to prevent memory buildup

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // Check for encoder errors
        if (encoderError !== null) {
          this.log('Encoder error detected during audio encoding:', encoderError);
          videoEncoder.close();
          audioEncoder.close();
          cleanup();
          throw encoderError;
        }

        if (this.isCancelled) {
          videoEncoder.close();
          audioEncoder.close();
          cleanup();
          throw new Error('Conversion cancelled by user');
        }

        const startSample = chunkIndex * samplesPerChunk;
        const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
        const chunkLength = endSample - startSample;

        // For f32-planar format, create a buffer with all channels concatenated
        // Layout: [ch0_sample0, ch0_sample1, ..., ch0_sampleN, ch1_sample0, ch1_sample1, ..., ch1_sampleN]
        const planarData = new Float32Array(chunkLength * numberOfChannels);
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          const offset = channel * chunkLength;
          for (let i = 0; i < chunkLength; i++) {
            planarData[offset + i] = channelData[startSample + i];
          }
        }

        // Create AudioData with planar format
        const timestamp = Math.round((startSample / sampleRate) * 1_000_000); // microseconds
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: chunkLength,
          numberOfChannels: numberOfChannels,
          timestamp: timestamp,
          data: planarData,
        });

        // Check encoder state before encoding
        if (audioEncoder.state === 'closed') {
          audioData.close();
          throw new Error('AudioEncoder closed unexpectedly');
        }

        audioEncoder.encode(audioData);
        audioData.close();

        // Report progress (85-95% for audio encoding)
        if (onProgress && chunkIndex % 100 === 0) {
          const progress = 0.85 + (chunkIndex / totalChunks) * 0.1;
          onProgress(Math.min(progress, 0.95));
        }

        // Periodically flush audio encoder to prevent queue overflow
        if ((chunkIndex + 1) % AUDIO_FLUSH_INTERVAL === 0) {
          await audioEncoder.flush();
        }
      }

      // Check for errors before final flush
      if (encoderError !== null) {
        videoEncoder.close();
        audioEncoder.close();
        cleanup();
        throw encoderError;
      }

      // Flush audio encoder
      await audioEncoder.flush();
      this.log('Audio encoding complete');

      // Close encoders
      videoEncoder.close();
      audioEncoder.close();

      // Finalize muxer
      muxer.finalize();

      // Get the final MP4 buffer
      const { buffer } = muxer.target as ArrayBufferTarget;
      const finalBlob = new Blob([buffer], { type: 'video/mp4' });

      cleanup();

      if (onProgress) {
        onProgress(1);
      }

      const totalTime = performance.now() - startTime;
      const totalSpeedup = (duration * 1000) / totalTime;
      this.log(`Total conversion time: ${(totalTime / 1000).toFixed(2)}s (${totalSpeedup.toFixed(1)}x faster than real-time)`);
      this.log('Final MP4 size:', finalBlob.size, 'bytes');

      return finalBlob;
    } catch (error) {
      cleanup();
      throw error;
    }
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
