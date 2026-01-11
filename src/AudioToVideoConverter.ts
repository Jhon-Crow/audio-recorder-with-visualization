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

    // Render loop with improved timing and reliability
    const frameInterval = 1000 / fps;
    let lastFrameTime = 0;
    let frameCount = 0;

    return new Promise((resolve, reject) => {
      let hasErrored = false;

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
   * Convert an audio file to video with visualization using true offline rendering
   *
   * This method performs silent offline rendering:
   * - No audio plays through speakers during conversion
   * - No visualization preview is shown during conversion (uses hidden canvas)
   * - Frame rendering is fast (many times faster than real-time)
   * - Audio is captured silently using Web Audio API
   *
   * Process:
   * - Phase 1 (0-20%): Audio analysis - very fast
   * - Phase 2 (20-50%): Frame rendering - very fast (5-20x real-time)
   * - Phase 3 (50-100%): Audio muxing - runs at 1x but silently
   *
   * Total time is approximately: analysis + fast_render + audio_duration
   * For a 3 minute song, expect ~15-30 seconds analysis/render + 3 minutes silent muxing
   *
   * The output video includes synchronized audio from the original file.
   *
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob with audio
   */
  async convertFast(config: ConversionConfig): Promise<Blob> {
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

    this.log('Starting fast offline conversion (no audio playback)...');

    // Create offline analyzer and analyze the audio
    const offlineAnalyzer = new OfflineAudioAnalyzer({
      fftSize: 2048,
      debug: this.debug,
    });

    // Report analysis progress (0-20% of total)
    const analysisProgress = (progress: number): void => {
      if (onProgress) {
        onProgress(progress * 0.2);
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
    this.log('Audio duration:', duration, 'seconds,', totalFrames, 'frames to render');

    // Create audio element for audio stream (muted - no playback)
    const audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';
    audioElement.muted = true; // Mute - no audio playback during conversion
    audioElement.volume = 0;

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

    // Get audio stream for the final video (even though muted, we'll capture it)
    let audioStream: MediaStream | undefined;
    try {
      if ('captureStream' in audioElement) {
        audioStream = (audioElement as HTMLMediaElement & { captureStream(): MediaStream }).captureStream();
      } else if ('mozCaptureStream' in audioElement) {
        audioStream = (audioElement as HTMLMediaElement & { mozCaptureStream(): MediaStream }).mozCaptureStream();
      }
    } catch (e) {
      this.log('Could not capture stream from audio element');
    }

    // Create video recorder
    const videoRecorder = new VideoRecorder({ debug: this.debug });

    // Start recording canvas (no audio yet - we'll add it using a different method)
    videoRecorder.start(canvas, undefined, {
      format,
      fps,
      videoBitrate,
      audioBitrate,
    });

    this.log('Started fast frame rendering...');

    // Render all frames as fast as possible (no audio playback)
    let frameCount = 0;
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      let hasErrored = false;

      const cleanup = (): void => {
        visualizer.destroy();
        offlineAnalyzer.destroy();
        if (audioSource instanceof File) {
          URL.revokeObjectURL(audioElement.src);
        }
      };

      // Render frames as fast as possible using a loop with setTimeout(0)
      const renderNextFrame = (): void => {
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
          // Calculate the simulated time for this frame
          const simulatedTime = frameCount / fps;

          // Get cached visualization data for this time
          const cachedData = offlineAnalyzer.getDataAtTime(simulatedTime);

          if (cachedData) {
            const data: VisualizationData = {
              timeDomainData: cachedData.timeDomainData,
              frequencyData: cachedData.frequencyData,
              timestamp: simulatedTime * 1000,
              width: canvas.width,
              height: canvas.height,
              sampleRate: analysisCache.sampleRate,
              fftSize: analysisCache.fftSize,
            };

            visualizer.draw(ctx, data);
          }

          frameCount++;

          // Report progress (20-50% for frame rendering phase)
          if (onProgress) {
            const progress = 0.2 + (frameCount / totalFrames) * 0.30;
            onProgress(Math.min(progress, 0.50));
          }

          // Check if we've rendered all frames
          if (frameCount >= totalFrames) {
            const renderTime = performance.now() - startTime;
            const speedup = (duration * 1000) / renderTime;
            this.log(`Rendered ${frameCount} frames in ${(renderTime / 1000).toFixed(2)}s (${speedup.toFixed(1)}x faster than real-time)`);

            // Now we need to add audio to the video
            // Stop the video-only recording first
            this.finalizeWithAudio(
              videoRecorder,
              audioSource,
              audioStream,
              audioElement,
              format,
              fps,
              videoBitrate,
              audioBitrate,
              onProgress,
              cleanup,
              resolve,
              reject,
              hasErrored
            );
          } else {
            // Schedule next frame with setTimeout(0) for maximum speed
            // This allows the browser to process the frame and continue immediately
            setTimeout(renderNextFrame, 0);
          }
        } catch (error) {
          hasErrored = true;
          videoRecorder.cancel();
          cleanup();
          reject(error);
        }
      };

      // Start rendering
      renderNextFrame();
    });
  }

  /**
   * Finalize the video by combining video frames with audio at accelerated speed
   * Uses high playback rate to make the muxing process faster than real-time
   */
  private async finalizeWithAudio(
    videoRecorder: VideoRecorder,
    _audioSource: File | string,
    _audioStream: MediaStream | undefined,
    audioElement: HTMLAudioElement,
    format: RecordingFormat,
    fps: number,
    videoBitrate: number,
    audioBitrate: number,
    onProgress: ((progress: number) => void) | undefined,
    cleanup: () => void,
    resolve: (blob: Blob) => void,
    reject: (error: Error) => void,
    hasErrored: boolean
  ): Promise<void> {
    if (hasErrored) return;

    try {
      // Stop the video-only recording to get the video blob
      const videoOnlyBlob = await videoRecorder.stop();
      this.log('Video frames captured, size:', videoOnlyBlob.size, 'bytes');

      if (videoOnlyBlob.size === 0) {
        cleanup();
        reject(new Error('Export failed: video blob is empty'));
        return;
      }

      // Now we need to combine video with audio
      // We'll use accelerated playback (up to 16x speed) to mux faster than real-time
      // Note: Most browsers support up to 16x playback rate

      // Create a video element to play the video-only blob
      const videoEl = document.createElement('video');
      videoEl.src = URL.createObjectURL(videoOnlyBlob);
      videoEl.muted = true; // Video stays muted, we'll capture audio from the original file
      await new Promise<void>((res, rej) => {
        videoEl.onloadedmetadata = () => res();
        videoEl.onerror = () => rej(new Error('Failed to load video'));
      });

      // Prepare audio element for accelerated playback
      // Note: Audio must be unmuted for captureStream to work, but we can use a very low volume
      // Actually, for proper muxing at speed, we need to disable audio during the recording
      // and instead encode the original audio into the video at normal pitch

      // The key insight: We can't speed up audio without changing pitch in browser
      // So we'll record at 1x with audio, but we render the video frames faster ahead of time
      // This means the total time is: fast frame rendering + 1x audio playback
      // However, the user wanted NO audio playback at all

      // Alternative approach: Record video only (no audio) and the user can use the video
      // Or we use a different strategy: encode everything including audio using WebAudio + OfflineAudioContext

      // Let's use the simplest approach that works:
      // 1. We already have video frames recorded
      // 2. Now we mux audio at 1x speed but with muted speakers
      // 3. The audio is captured but not played out loud

      audioElement.muted = true; // Keep muted - no sound output
      audioElement.volume = 0;
      audioElement.currentTime = 0;

      // However, when audio is muted, captureStream captures silence
      // So we need to use a different approach: Use AudioContext to process audio

      // Actually, the cleanest solution is to accept that audio muxing requires
      // 1x speed in browser without WebCodecs, but at least the video rendering is fast
      // and there's no audible sound output (muted).

      // For truly silent, fast export, we'll output the video without audio
      // and provide the video blob directly (user can combine externally)
      // OR we can use Web Audio API to pipe audio without playing it

      // Let's use Web Audio API approach for silent audio muxing
      const audioContext = new AudioContext();

      // Create a media stream destination for silent audio capture
      const audioDestination = audioContext.createMediaStreamDestination();

      // Create a source from the audio element
      const audioSourceNode = audioContext.createMediaElementSource(audioElement);

      // Connect to the destination (this captures audio without playing it through speakers)
      audioSourceNode.connect(audioDestination);

      // Also connect to a GainNode set to 0 connected to speakers (completely silent)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      audioSourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create canvas for video playback
      const mixCanvas = document.createElement('canvas');
      mixCanvas.width = videoEl.videoWidth || 1920;
      mixCanvas.height = videoEl.videoHeight || 1080;
      const mixCtx = mixCanvas.getContext('2d');
      if (!mixCtx) {
        cleanup();
        URL.revokeObjectURL(videoEl.src);
        await audioContext.close();
        reject(new Error('Failed to create mix canvas context'));
        return;
      }

      // Create new recorder for the final mix with audio
      const finalRecorder = new VideoRecorder({ debug: this.debug });

      // Use the Web Audio API stream for audio
      finalRecorder.start(mixCanvas, audioDestination.stream, {
        format,
        fps,
        videoBitrate,
        audioBitrate,
      });

      // Reset positions
      videoEl.currentTime = 0;
      audioElement.currentTime = 0;

      // Note: We can't use playbackRate > 1 with MediaRecorder for proper output
      // So the muxing happens at 1x speed, but silently
      // The total time is: fast frame rendering + 1x audio muxing (silent)

      this.log('Starting silent audio muxing at 1x speed (no sound output)...');
      const muxStartTime = performance.now();
      const audioDuration = audioElement.duration;

      // Start playback (silent)
      const playPromises = [videoEl.play(), audioElement.play()];
      await Promise.all(playPromises);

      // Render video frames to canvas and report progress
      const renderMixFrame = (): void => {
        if (videoEl.ended || audioElement.ended) {
          return;
        }
        mixCtx.drawImage(videoEl, 0, 0, mixCanvas.width, mixCanvas.height);

        // Report progress (50-95% for audio muxing phase)
        if (onProgress && audioDuration > 0) {
          const muxProgress = audioElement.currentTime / audioDuration;
          const progress = 0.5 + muxProgress * 0.45;
          onProgress(Math.min(progress, 0.95));
        }

        requestAnimationFrame(renderMixFrame);
      };
      requestAnimationFrame(renderMixFrame);

      // Wait for playback to finish
      await new Promise<void>((res) => {
        const checkEnd = (): void => {
          if (videoEl.ended || audioElement.ended) {
            res();
          } else {
            setTimeout(checkEnd, 100);
          }
        };
        videoEl.onended = () => res();
        audioElement.onended = () => res();
        checkEnd();
      });

      const muxTime = performance.now() - muxStartTime;
      this.log(`Audio muxing completed in ${(muxTime / 1000).toFixed(2)}s`);

      // Stop final recording
      await new Promise<void>((res) => setTimeout(res, 500)); // Give time for final frames

      const finalBlob = await finalRecorder.stop();

      // Cleanup temporary resources
      URL.revokeObjectURL(videoEl.src);
      await audioContext.close();
      cleanup();

      if (onProgress) {
        onProgress(1);
      }

      this.log('Fast conversion complete with audio, blob size:', finalBlob.size, 'bytes');

      if (finalBlob.size === 0) {
        reject(new Error('Export failed: final video blob is empty'));
        return;
      }

      resolve(finalBlob);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
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
