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
   * Convert an audio file to video with visualization
   * @param config - Conversion configuration
   * @returns Promise resolving to the video blob
   */
  async convert(config: ConversionConfig): Promise<Blob> {
    // Reset cancellation flag
    this.isCancelled = false;

    const {
      canvas: canvasConfig,
      visualizer: visualizerConfig,
      visualizerOptions,
      videoWidth = 1920,
      videoHeight = 1080,
      offlineRender = false,
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

    // Use offline rendering if requested
    if (offlineRender) {
      return this.convertOffline(config, canvas, ctx, visualizer);
    }

    // Real-time rendering (original implementation)
    return this.convertRealtime(config, canvas, ctx, visualizer);
  }

  /**
   * Convert audio to video using real-time rendering (with audio playback)
   */
  private async convertRealtime(
    config: ConversionConfig,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    visualizer: Visualizer
  ): Promise<Blob> {
    const {
      audioSource,
      fps = 30,
      videoBitrate = 8000000,
      audioBitrate = 192000,
      format = 'webm',
      onProgress,
      audioEnhancement,
    } = config;

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
   * Convert audio to video without real-time audio playback.
   *
   * Unlike the real-time mode, this method:
   * - Does NOT play audio through speakers
   * - Routes audio through an AudioBufferSourceNode → MediaStreamDestination (silent)
   * - Uses frame-index-based timing instead of audioElement.currentTime
   * - Works correctly when the browser window is minimized or in background
   * - Renders at a pace controlled by setTimeout (not RAF, which is throttled when minimized)
   *
   * The audio track in the output video is derived from the decoded AudioBuffer,
   * so it is accurate regardless of rendering speed.
   */
  private async convertOffline(
    config: ConversionConfig,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    visualizer: Visualizer
  ): Promise<Blob> {
    const {
      audioSource,
      fps = 30,
      videoBitrate = 8000000,
      audioBitrate = 192000,
      format = 'webm',
      onProgress,
    } = config;

    this.log('Starting offline rendering mode (no real-time audio playback)');

    // Load audio file as ArrayBuffer
    let audioArrayBuffer: ArrayBuffer;

    if (audioSource instanceof File) {
      audioArrayBuffer = await audioSource.arrayBuffer();
    } else {
      const response = await fetch(audioSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      audioArrayBuffer = await response.arrayBuffer();
    }

    // Decode audio using Web Audio API
    const audioContext = new AudioContext();
    let audioContextClosed = false;
    const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer.slice(0));

    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 2048;
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1000 / fps;

    this.log('Offline rendering:', {
      duration: duration.toFixed(2) + 's',
      sampleRate,
      totalFrames,
      fps,
    });

    // Get raw audio data for visualization analysis (first channel)
    const channelData = audioBuffer.getChannelData(0);

    // Route audio through AudioBufferSourceNode → MediaStreamDestination
    // This provides the audio track for the video WITHOUT playing through speakers
    const audioStreamDestination = audioContext.createMediaStreamDestination();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(audioStreamDestination);

    const audioStream = audioStreamDestination.stream;

    // Get canvas stream for video capture
    const canvasStream = canvas.captureStream(fps);

    this.log('Using canvas stream for offline rendering at', fps, 'fps');

    // Combine canvas video and audio streams
    const tracks = [...canvasStream.getTracks(), ...audioStream.getAudioTracks()];
    const combinedStream = new MediaStream(tracks);

    // Create MediaRecorder
    const mimeType = this.getSupportedMimeType(format);
    if (!mimeType) {
      throw new Error(`Format "${format}" is not supported in this browser`);
    }

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
      audioBitsPerSecond: audioBitrate,
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
        this.log('Received chunk:', event.data.size, 'bytes');
      }
    };

    // Draw initial frame so canvas has content before recording starts
    const { timeDomainData: initialTimeDomain, frequencyData: initialFrequency } = this.analyzeAudioFrame(
      channelData,
      0,
      fftSize,
      sampleRate
    );
    visualizer.draw(ctx, {
      timeDomainData: initialTimeDomain,
      frequencyData: initialFrequency,
      timestamp: 0,
      width: canvas.width,
      height: canvas.height,
      sampleRate,
      fftSize,
    });

    // Start recording before starting audio source
    mediaRecorder.start(100);

    // Start audio source (routes to MediaStreamDestination, not speakers)
    bufferSource.start(0);
    this.log('Audio source started (routed to stream, no speaker output)');

    const cleanup = (): void => {
      visualizer.destroy();
      try { bufferSource.stop(); } catch { /* already stopped */ }
      if (!audioContextClosed) {
        audioContext.close().catch(() => {});
        audioContextClosed = true;
      }
      combinedStream.getTracks().forEach(track => track.stop());
    };

    this.log(`Starting frame rendering loop: ${totalFrames} frames at ${fps} fps`);

    try {
      let frameCount = 0;
      let lastProgressLog = 0;

      await new Promise<void>((resolve, reject) => {
        let hasErrored = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const renderFrame = (): void => {
          if (hasErrored) return;

          if (this.isCancelled) {
            hasErrored = true;
            if (timeoutId !== null) clearTimeout(timeoutId);
            this.log(`Rendering cancelled at frame ${frameCount}`);
            reject(new Error('Conversion cancelled by user'));
            return;
          }

          try {
            // Calculate audio time from frame index (not from audio element)
            const audioTime = frameCount / fps;

            if (frameCount >= totalFrames) {
              this.log(`All ${frameCount} frames rendered`);
              resolve();
              return;
            }

            const sampleIndex = Math.floor(audioTime * sampleRate);

            const { timeDomainData, frequencyData } = this.analyzeAudioFrame(
              channelData,
              sampleIndex,
              fftSize,
              sampleRate
            );

            visualizer.draw(ctx, {
              timeDomainData,
              frequencyData,
              timestamp: audioTime * 1000,
              width: canvas.width,
              height: canvas.height,
              sampleRate,
              fftSize,
            });

            frameCount++;

            const progress = Math.min(frameCount / totalFrames, 1);
            const progressPercent = Math.floor(progress * 10) * 10;
            if (progressPercent > lastProgressLog) {
              lastProgressLog = progressPercent;
              this.log(`Rendering progress: ${(progress * 100).toFixed(1)}% (frame ${frameCount}/${totalFrames})`);
            }

            if (onProgress && duration > 0) {
              onProgress(progress);
            }

            if (!this.isCancelled) {
              // Use setTimeout instead of requestAnimationFrame:
              // - rAF is throttled/paused when window is minimized
              // - setTimeout continues running in background (may be throttled but still runs)
              timeoutId = setTimeout(renderFrame, frameInterval);
            } else {
              resolve();
            }
          } catch (error) {
            hasErrored = true;
            if (timeoutId !== null) clearTimeout(timeoutId);
            this.log(`Error in rendering loop at frame ${frameCount}:`, error);
            reject(error);
          }
        };

        // Start the rendering loop immediately
        timeoutId = setTimeout(renderFrame, 0);
      });

      this.log(`Frame rendering complete. ${totalFrames} frames rendered.`);

      // Wait for MediaRecorder to receive the audio that was produced
      // AudioBufferSourceNode plays in real-time relative to AudioContext clock,
      // so we wait for the audio duration to ensure all audio is captured
      const audioElapsedMs = (audioContext.currentTime) * 1000;
      const audioRemainingMs = Math.max(0, duration * 1000 - audioElapsedMs);
      if (audioRemainingMs > 0) {
        this.log(`Waiting ${Math.round(audioRemainingMs)}ms for audio stream to complete...`);
        await new Promise(resolve => setTimeout(resolve, audioRemainingMs + 200));
      }

      // Extra buffer for MediaRecorder to flush final chunks
      await new Promise(resolve => setTimeout(resolve, 500));

      this.log('Stopping MediaRecorder...');
      const blob = await new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const totalSize = recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
          this.log(`Recording stopped, total size: ${totalSize} bytes from ${recordedChunks.length} chunks`);
          resolve(new Blob(recordedChunks, { type: mimeType }));
        };
        mediaRecorder.onerror = (event) => {
          reject(new Error(`MediaRecorder error: ${event}`));
        };
        mediaRecorder.stop();
      });

      this.log(`Blob type: ${blob.type}, size: ${blob.size} bytes`);
      cleanup();

      if (onProgress) {
        onProgress(1);
      }

      this.log('Offline conversion complete, blob size:', blob.size, 'bytes');

      if (blob.size === 0) {
        throw new Error('Export failed: video blob is empty (0 bytes). ' +
          'This may happen if the browser blocked the AudioContext or MediaRecorder. ' +
          'Check console for details.');
      }

      return blob;
    } catch (error) {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      cleanup();
      throw error;
    }
  }

  /**
   * Get supported MIME type for the format
   */
  private getSupportedMimeType(format: string): string | null {
    const mimeTypes: Record<string, string[]> = {
      webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
      mp4: ['video/mp4;codecs=h264,aac', 'video/mp4'],
    };

    const types = mimeTypes[format] || mimeTypes['webm'];
    for (const mimeType of types) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return null;
  }

  /**
   * Analyze a frame of audio data to extract time domain and frequency data
   * This is a simplified FFT analysis for offline rendering
   */
  private analyzeAudioFrame(
    channelData: Float32Array,
    startSample: number,
    fftSize: number,
    _sampleRate: number
  ): { timeDomainData: Uint8Array; frequencyData: Uint8Array } {
    const timeDomainData = new Uint8Array(fftSize);
    const frequencyData = new Uint8Array(fftSize / 2);

    // Extract time domain data (convert from Float32 to Uint8)
    for (let i = 0; i < fftSize; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex < channelData.length) {
        // Convert from -1..1 to 0..255 (with 128 being silence)
        timeDomainData[i] = Math.round((channelData[sampleIndex] + 1) * 127.5);
      } else {
        timeDomainData[i] = 128; // Silence
      }
    }

    // Simple frequency analysis using DFT approximation
    // This is a simplified version - we calculate magnitude for each frequency bin
    const halfFFT = fftSize / 2;
    for (let k = 0; k < halfFFT; k++) {
      let real = 0;
      let imag = 0;

      // Use a smaller window for faster computation (every 4th sample)
      const step = 4;
      for (let n = 0; n < fftSize; n += step) {
        const sampleIndex = startSample + n;
        if (sampleIndex < channelData.length) {
          const sample = channelData[sampleIndex];
          const angle = (2 * Math.PI * k * n) / fftSize;
          real += sample * Math.cos(angle);
          imag -= sample * Math.sin(angle);
        }
      }

      // Calculate magnitude and scale to 0-255
      const magnitude = Math.sqrt(real * real + imag * imag) / (fftSize / step);
      // Apply log scale for better visualization (similar to Web Audio API)
      const db = 20 * Math.log10(Math.max(magnitude, 0.00001));
      // Scale from -100dB to 0dB to 0-255
      const normalized = Math.max(0, Math.min(255, ((db + 100) / 100) * 255));
      frequencyData[k] = Math.round(normalized);
    }

    return { timeDomainData, frequencyData };
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
