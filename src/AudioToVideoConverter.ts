import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import {
  ConversionConfig,
  RecordingFormat,
  VideoConcatenationConfig,
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
  private readonly encoderSupportCache = new Map<string, boolean>();

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

  private getEncoderSupportCacheKey(
    format: RecordingFormat,
    width: number,
    height: number
  ): string {
    return `${format}:${width}x${height}`;
  }

  private getMP4FallbackMessage(): string {
    return 'MP4 encoding is not supported on this system at the requested resolution. Your video was saved as WebM format instead, which is compatible with most modern browsers and video players.';
  }

  private shouldFallbackFromMP4Error(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('cancelled')) {
      return false;
    }
    return /encod|mediarecorder|mime|mp4|not supported/i.test(message);
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
    const encoderSupportCacheKey = this.getEncoderSupportCacheKey(
      requestedFormat,
      videoWidth,
      videoHeight
    );
    if (requestedFormat === 'mp4') {
      const hasKnownMP4Support = this.encoderSupportCache.get(encoderSupportCacheKey) === true;
      if (hasKnownMP4Support) {
        this.log('Using cached MP4 encoder support at', videoWidth, 'x', videoHeight);
      } else {
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
            fallbackMessage: this.getMP4FallbackMessage(),
          };
        }

        this.encoderSupportCache.set(encoderSupportCacheKey, true);
      }
    }

    // Proceed with requested format
    try {
      const blob = await this.convert(config);
      if (requestedFormat === 'mp4') {
        this.encoderSupportCache.set(encoderSupportCacheKey, true);
      }
      return {
        blob,
        format: requestedFormat,
        usedFallback: false,
      };
    } catch (error) {
      if (requestedFormat !== 'mp4' || !this.shouldFallbackFromMP4Error(error)) {
        throw error;
      }

      this.encoderSupportCache.set(encoderSupportCacheKey, false);
      this.log('MP4 conversion failed, falling back to WebM:', error);
      const blob = await this.convert({ ...config, format: 'webm' });
      return {
        blob,
        format: 'webm',
        usedFallback: true,
        fallbackMessage: this.getMP4FallbackMessage(),
      };
    }
  }

  /**
   * Join completed video files into one continuous recording. The source videos
   * are decoded and composited in order, so container headers and timestamps are
   * rebuilt instead of concatenating encoded file bytes.
   *
   * If MP4 encoding is unavailable, the operation falls back to WebM using the
   * same behavior as audio visualization conversion.
   */
  async concatenateVideosWithFallback(
    config: VideoConcatenationConfig
  ): Promise<ConversionResult> {
    const requestedFormat = config.format ?? 'webm';
    const videoWidth = config.videoWidth ?? 1920;
    const videoHeight = config.videoHeight ?? 1080;
    const encoderSupportCacheKey = this.getEncoderSupportCacheKey(
      requestedFormat,
      videoWidth,
      videoHeight
    );

    if (requestedFormat === 'mp4') {
      const hasKnownMP4Support = this.encoderSupportCache.get(encoderSupportCacheKey) === true;
      if (!hasKnownMP4Support) {
        const mp4Supported = await VideoRecorder.testEncoderSupport(
          'mp4',
          2000,
          videoWidth,
          videoHeight
        );
        if (!mp4Supported) {
          this.encoderSupportCache.set(encoderSupportCacheKey, false);
          const blob = await this.concatenateVideos({ ...config, format: 'webm' });
          return {
            blob,
            format: 'webm',
            usedFallback: true,
            fallbackMessage: this.getMP4FallbackMessage(),
          };
        }
        this.encoderSupportCache.set(encoderSupportCacheKey, true);
      }
    }

    try {
      const blob = await this.concatenateVideos(config);
      if (requestedFormat === 'mp4') {
        this.encoderSupportCache.set(encoderSupportCacheKey, true);
      }
      return {
        blob,
        format: requestedFormat,
        usedFallback: false,
      };
    } catch (error) {
      if (requestedFormat !== 'mp4' || !this.shouldFallbackFromMP4Error(error)) {
        throw error;
      }

      this.encoderSupportCache.set(encoderSupportCacheKey, false);
      this.log('MP4 video concatenation failed, falling back to WebM:', error);
      const blob = await this.concatenateVideos({ ...config, format: 'webm' });
      return {
        blob,
        format: 'webm',
        usedFallback: true,
        fallbackMessage: this.getMP4FallbackMessage(),
      };
    }
  }

  /**
   * Join completed video files into one valid media container.
   */
  async concatenateVideos(config: VideoConcatenationConfig): Promise<Blob> {
    this.isCancelled = false;

    const {
      videoSources,
      canvas: canvasConfig,
      fps = 30,
      videoWidth = 1920,
      videoHeight = 1080,
      videoBitrate = 8000000,
      audioBitrate = 192000,
      format = 'webm',
      onProgress,
    } = config;

    if (!videoSources.length) {
      throw new Error('At least one completed video is required for concatenation');
    }

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

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: false,
    });
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    type PreparedVideo = {
      element: HTMLVideoElement;
      objectUrl: string;
      duration: number;
      audioSourceNode: MediaElementAudioSourceNode;
    };
    type FrameAwareVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };

    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();
    const preparedVideos: PreparedVideo[] = [];
    let videoRecorder: VideoRecorder | null = null;

    const drawVideoFrame = (video: HTMLVideoElement): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    };

    const prepareVideo = async (source: Blob, index: number): Promise<PreparedVideo> => {
      const objectUrl = URL.createObjectURL(source);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.src = objectUrl;

      try {
        await new Promise<void>((resolve, reject) => {
          const cleanupListeners = (): void => {
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('error', handleError);
          };
          const handleLoadedData = (): void => {
            cleanupListeners();
            resolve();
          };
          const handleError = (): void => {
            cleanupListeners();
            reject(new Error(`Failed to load completed video ${index + 1}`));
          };

          if (video.readyState >= 2) {
            resolve();
            return;
          }
          video.addEventListener('loadeddata', handleLoadedData);
          video.addEventListener('error', handleError);
          video.load();
        });

        const audioSourceNode = audioContext.createMediaElementSource(video);
        audioSourceNode.connect(audioDestination);
        return {
          element: video,
          objectUrl,
          duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0,
          audioSourceNode,
        };
      } catch (error) {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        throw error;
      }
    };

    const playVideo = (
      prepared: PreparedVideo,
      index: number,
      allDurationsKnown: boolean,
      totalDuration: number,
      completedDuration: number
    ): Promise<void> => new Promise((resolve, reject) => {
      const video = prepared.element as FrameAwareVideo;
      let frameCallbackHandle: number | null = null;
      let animationFrameHandle: number | null = null;
      let settled = false;

      const cancelScheduledFrame = (): void => {
        if (frameCallbackHandle !== null && video.cancelVideoFrameCallback) {
          video.cancelVideoFrameCallback(frameCallbackHandle);
        }
        if (animationFrameHandle !== null) {
          cancelAnimationFrame(animationFrameHandle);
        }
        frameCallbackHandle = null;
        animationFrameHandle = null;
      };

      const cleanupListeners = (): void => {
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        cancelScheduledFrame();
      };

      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        if (error) {
          reject(error);
        } else {
          const completedProgress = allDurationsKnown && totalDuration > 0
            ? (completedDuration + prepared.duration) / totalDuration
            : (index + 1) / preparedVideos.length;
          onProgress?.(Math.min(completedProgress, 1));
          resolve();
        }
      };

      const reportProgress = (): void => {
        if (!onProgress) return;
        if (allDurationsKnown && totalDuration > 0) {
          onProgress(Math.min((completedDuration + video.currentTime) / totalDuration, 1));
          return;
        }
        const localProgress = prepared.duration > 0
          ? Math.min(video.currentTime / prepared.duration, 1)
          : 0;
        onProgress(Math.min((index + localProgress) / preparedVideos.length, 1));
      };

      const scheduleFrame = (): void => {
        if (video.requestVideoFrameCallback) {
          frameCallbackHandle = video.requestVideoFrameCallback(drawFrame);
        } else {
          animationFrameHandle = requestAnimationFrame(drawFrame);
        }
      };

      const drawFrame = (): void => {
        frameCallbackHandle = null;
        animationFrameHandle = null;
        if (settled) return;
        if (this.isCancelled) {
          video.pause();
          finish(new Error('Video concatenation cancelled by user'));
          return;
        }
        try {
          drawVideoFrame(video);
          reportProgress();
          if (!video.ended) {
            scheduleFrame();
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      };

      const handleEnded = (): void => {
        try {
          drawVideoFrame(video);
          finish();
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      };
      const handleError = (): void => {
        finish(new Error(`Completed video ${index + 1} failed during playback`));
      };

      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      drawVideoFrame(video);
      reportProgress();
      scheduleFrame();
      video.play().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        finish(new Error(`Failed to play completed video ${index + 1}: ${message}`));
      });
    });

    try {
      for (let index = 0; index < videoSources.length; index++) {
        preparedVideos.push(await prepareVideo(videoSources[index], index));
      }

      await audioContext.resume();
      onProgress?.(0);

      const durations = preparedVideos.map(video => video.duration);
      const allDurationsKnown = durations.every(duration => duration > 0);
      const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      let completedDuration = 0;

      videoRecorder = new VideoRecorder({ debug: this.debug });
      let rejectEncoding: (reason: Error) => void = () => undefined;
      const encodingFailed = new Promise<never>((_resolve, reject) => {
        rejectEncoding = reject;
      });
      videoRecorder.onError(error => {
        const helpfulMessage = format === 'mp4'
          ? `${error.message}. Try using WebM format instead for better compatibility.`
          : error.message;
        rejectEncoding(new Error(`Encoding failed: ${helpfulMessage}`));
      });
      videoRecorder.start(canvas, audioDestination.stream, {
        format,
        fps,
        videoBitrate,
        audioBitrate,
      });

      const playAllVideos = async (): Promise<void> => {
        for (let index = 0; index < preparedVideos.length; index++) {
          await playVideo(
            preparedVideos[index],
            index,
            allDurationsKnown,
            totalDuration,
            completedDuration
          );
          completedDuration += preparedVideos[index].duration;
        }
      };

      await Promise.race([playAllVideos(), encodingFailed]);
      await new Promise(resolve => setTimeout(resolve, Math.ceil(1000 / fps)));
      const blob = await Promise.race([videoRecorder.stop(), encodingFailed]);

      if (blob.size === 0) {
        throw new Error('Export failed: concatenated video blob is empty');
      }
      onProgress?.(1);
      this.log('Video concatenation complete, blob size:', blob.size, 'bytes');
      return blob;
    } finally {
      if (videoRecorder?.state !== 'inactive') {
        videoRecorder?.cancel();
      }
      preparedVideos.forEach(prepared => {
        prepared.element.pause();
        prepared.audioSourceNode.disconnect();
        prepared.element.removeAttribute('src');
        prepared.element.load();
        URL.revokeObjectURL(prepared.objectUrl);
      });
      audioDestination.stream.getTracks().forEach(track => track.stop());
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
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
      audioEnhancement,
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
      audioEnhancement,
      debug: this.debug,
    });

    await analyzer.connectAudioElement(audioElement);

    // Create video recorder
    const videoRecorder = new VideoRecorder({ debug: this.debug });

    // Since we've already connected the audio element, we'll capture from it differently
    // Create a new stream from the audio element for recording
    let audioStream: MediaStream | undefined;

    if (analyzer.isAudioEnhancementActive) {
      audioStream = analyzer.getProcessedStream() ?? undefined;
      this.log('Using enhanced audio stream for conversion');
    } else {
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
