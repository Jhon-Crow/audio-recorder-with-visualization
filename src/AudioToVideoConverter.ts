import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import { OfflineAudioAnalyzer } from './core/OfflineAudioAnalyzer';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
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
   * Uses WebCodecs API (Chrome 94+) for true faster-than-realtime rendering:
   * - No audio plays through speakers
   * - Encodes directly with VideoEncoder + AudioEncoder + mp4-muxer
   * - Works when window is minimized (no paint cycle dependency)
   * - Typically 5-20x faster than real-time
   *
   * Falls back to real-time rendering (with silent audio) on browsers that
   * don't support WebCodecs (Firefox).
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
      videoWidth = canvas.width,
      videoHeight = canvas.height,
      videoBitrate = 8000000,
      audioBitrate = 192000,
      onProgress,
    } = config;

    this.log('Starting offline rendering mode (no real-time audio playback)');

    // Load audio file as ArrayBuffer
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

    // Pre-analyze audio for visualization data (works offline, no real-time playback)
    const offlineAnalyzer = new OfflineAudioAnalyzer({ fftSize: 2048, debug: this.debug });
    const analysisCache = await offlineAnalyzer.analyzeAudio(arrayBuffer, (p) => {
      if (onProgress) onProgress(p * 0.1);
    });

    if (this.isCancelled) {
      visualizer.destroy();
      offlineAnalyzer.destroy();
      throw new Error('Conversion cancelled by user');
    }

    const duration = analysisCache.duration;
    const sampleRate = analysisCache.sampleRate;
    const totalFrames = Math.ceil(duration * fps);

    this.log('Offline rendering:', { duration: duration.toFixed(2) + 's', sampleRate, totalFrames, fps });

    // WebCodecs path: encode directly without a paint cycle
    if (
      typeof VideoEncoder !== 'undefined' &&
      typeof AudioEncoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined' &&
      typeof AudioData !== 'undefined'
    ) {
      return this.convertOfflineWebCodecs(
        config,
        canvas,
        ctx,
        visualizer,
        offlineAnalyzer,
        analysisCache,
        videoWidth,
        videoHeight,
        fps,
        videoBitrate,
        audioBitrate,
        totalFrames,
        duration,
        sampleRate
      );
    }

    // Fallback: MediaRecorder with silent AudioBufferSourceNode
    this.log('WebCodecs not available, using MediaRecorder fallback');
    return this.convertOfflineMediaRecorder(
      config,
      canvas,
      ctx,
      visualizer,
      offlineAnalyzer,
      analysisCache,
      fps,
      videoBitrate,
      audioBitrate,
      totalFrames,
      duration,
      sampleRate,
      arrayBuffer
    );
  }

  /**
   * WebCodecs-based offline rendering: no paint cycle, no real-time audio playback.
   * Works when window is minimized. Typically 5-20x faster than real-time.
   */
  private async convertOfflineWebCodecs(
    config: ConversionConfig,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    visualizer: Visualizer,
    offlineAnalyzer: OfflineAudioAnalyzer,
    analysisCache: Awaited<ReturnType<OfflineAudioAnalyzer['analyzeAudio']>>,
    videoWidth: number,
    videoHeight: number,
    fps: number,
    videoBitrate: number,
    audioBitrate: number,
    totalFrames: number,
    duration: number,
    sampleRate: number
  ): Promise<Blob> {
    const { onProgress } = config;
    const cleanup = (): void => {
      visualizer.destroy();
      offlineAnalyzer.destroy();
    };

    let encoderError: Error | unknown = null;

    try {
      // Find supported video codec
      const videoCodecInfo = await this.findSupportedVideoCodec(videoWidth, videoHeight, videoBitrate, fps);
      if (!videoCodecInfo) {
        this.log('No supported video codec, falling back to MediaRecorder');
        return this.convertOfflineMediaRecorder(
          config, canvas, ctx, visualizer, offlineAnalyzer, analysisCache,
          fps, videoBitrate, audioBitrate, totalFrames, duration, sampleRate,
          await this.loadArrayBuffer(config.audioSource)
        );
      }

      // Find supported audio codec
      const audioCodecInfo = await this.findSupportedAudioCodec(
        sampleRate,
        analysisCache.audioBuffer.numberOfChannels,
        audioBitrate
      );
      if (!audioCodecInfo) {
        this.log('No supported audio codec, falling back to MediaRecorder');
        return this.convertOfflineMediaRecorder(
          config, canvas, ctx, visualizer, offlineAnalyzer, analysisCache,
          fps, videoBitrate, audioBitrate, totalFrames, duration, sampleRate,
          await this.loadArrayBuffer(config.audioSource)
        );
      }

      const muxerAudioCodec = audioCodecInfo.codec.startsWith('mp4a') ? 'aac' : 'opus';
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: videoCodecInfo.muxerCodec, width: videoWidth, height: videoHeight },
        audio: {
          codec: muxerAudioCodec as 'aac' | 'opus',
          numberOfChannels: analysisCache.audioBuffer.numberOfChannels,
          sampleRate,
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => { this.log('VideoEncoder error:', e); encoderError = e; },
      });
      videoEncoder.configure(videoCodecInfo.config);

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => { this.log('AudioEncoder error:', e); encoderError = e; },
      });
      audioEncoder.configure(audioCodecInfo.config);

      const startTime = performance.now();
      this.log('Encoding video frames...');

      // Encode video frames (as fast as CPU allows, no real-time constraint)
      const BATCH_SIZE = 60;
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (encoderError !== null) {
          videoEncoder.close(); audioEncoder.close(); cleanup();
          throw encoderError;
        }
        if (this.isCancelled) {
          videoEncoder.close(); audioEncoder.close(); cleanup();
          throw new Error('Conversion cancelled by user');
        }

        const simulatedTime = frameIndex / fps;
        const cachedData = offlineAnalyzer.getDataAtTime(simulatedTime);

        if (cachedData) {
          visualizer.draw(ctx, {
            timeDomainData: cachedData.timeDomainData,
            frequencyData: cachedData.frequencyData,
            timestamp: simulatedTime * 1000,
            width: canvas.width,
            height: canvas.height,
            sampleRate,
            fftSize: analysisCache.fftSize,
          });
        }

        const timestamp = Math.round((frameIndex / fps) * 1_000_000);
        const frame = new VideoFrame(canvas, {
          timestamp,
          duration: Math.round(1_000_000 / fps),
        });

        if (videoEncoder.state === 'closed') { frame.close(); throw new Error('VideoEncoder closed'); }

        try {
          videoEncoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
        } finally {
          frame.close();
        }

        if (onProgress && frameIndex % 10 === 0) {
          onProgress(Math.min(0.1 + (frameIndex / totalFrames) * 0.7, 0.8));
        }

        if ((frameIndex + 1) % BATCH_SIZE === 0) {
          await videoEncoder.flush();
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      if (encoderError !== null) { videoEncoder.close(); audioEncoder.close(); cleanup(); throw encoderError; }
      await videoEncoder.flush();
      this.log(`Video encoded in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

      if (onProgress) onProgress(0.85);

      // Encode audio
      this.log('Encoding audio...');
      const audioBuffer = analysisCache.audioBuffer;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const totalSamples = audioBuffer.length;
      const samplesPerChunk = 4096;
      const totalChunks = Math.ceil(totalSamples / samplesPerChunk);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (encoderError !== null) { videoEncoder.close(); audioEncoder.close(); cleanup(); throw encoderError; }
        if (this.isCancelled) { videoEncoder.close(); audioEncoder.close(); cleanup(); throw new Error('Conversion cancelled by user'); }

        const startSample = chunkIndex * samplesPerChunk;
        const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
        const chunkLength = endSample - startSample;

        const planarData = new Float32Array(chunkLength * numberOfChannels);
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          const offset = channel * chunkLength;
          for (let i = 0; i < chunkLength; i++) {
            planarData[offset + i] = channelData[startSample + i];
          }
        }

        const audioTimestamp = Math.round((startSample / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: chunkLength,
          numberOfChannels,
          timestamp: audioTimestamp,
          data: planarData,
        });

        if (audioEncoder.state === 'closed') { audioData.close(); throw new Error('AudioEncoder closed'); }
        audioEncoder.encode(audioData);
        audioData.close();

        if (onProgress && chunkIndex % 100 === 0) {
          onProgress(Math.min(0.85 + (chunkIndex / totalChunks) * 0.1, 0.95));
        }
        if ((chunkIndex + 1) % 100 === 0) await audioEncoder.flush();
      }

      if (encoderError !== null) { videoEncoder.close(); audioEncoder.close(); cleanup(); throw encoderError; }
      await audioEncoder.flush();

      videoEncoder.close();
      audioEncoder.close();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      const finalBlob = new Blob([buffer], { type: 'video/mp4' });

      cleanup();
      if (onProgress) onProgress(1);

      this.log('WebCodecs offline conversion complete, size:', finalBlob.size, 'bytes');
      return finalBlob;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  /**
   * MediaRecorder fallback for offline rendering.
   * Routes audio through AudioBufferSourceNode → MediaStreamDestination (no speakers).
   * NOTE: canvas.captureStream requires the browser's paint cycle; this fallback
   * may not work correctly when the window is minimized in all browsers.
   */
  private async convertOfflineMediaRecorder(
    config: ConversionConfig,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    visualizer: Visualizer,
    offlineAnalyzer: OfflineAudioAnalyzer,
    analysisCache: Awaited<ReturnType<OfflineAudioAnalyzer['analyzeAudio']>>,
    fps: number,
    videoBitrate: number,
    audioBitrate: number,
    _totalFrames: number,
    duration: number,
    sampleRate: number,
    audioArrayBuffer: ArrayBuffer
  ): Promise<Blob> {
    const { format = 'webm', onProgress } = config;

    const mimeType = this.getSupportedMimeType(format);
    if (!mimeType) throw new Error(`Format "${format}" is not supported in this browser`);

    // Decode audio and route to MediaStreamDestination (no speakers)
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer.slice(0));
    const audioStreamDestination = audioContext.createMediaStreamDestination();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(audioStreamDestination);

    const canvasStream = canvas.captureStream(fps);
    const tracks = [...canvasStream.getTracks(), ...audioStreamDestination.stream.getAudioTracks()];
    const combinedStream = new MediaStream(tracks);

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
      audioBitsPerSecond: audioBitrate,
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    // Draw initial frame before starting recorder
    const initial = offlineAnalyzer.getDataAtTime(0);
    if (initial) {
      visualizer.draw(ctx, {
        timeDomainData: initial.timeDomainData,
        frequencyData: initial.frequencyData,
        timestamp: 0,
        width: canvas.width,
        height: canvas.height,
        sampleRate,
        fftSize: analysisCache.fftSize,
      });
    }

    mediaRecorder.start(100);
    bufferSource.start(0);

    const cleanup = (): void => {
      visualizer.destroy();
      offlineAnalyzer.destroy();
      try { bufferSource.stop(); } catch { /* already stopped */ }
      audioContext.close().catch(() => {});
      combinedStream.getTracks().forEach(t => t.stop());
    };

    // Render frames synchronized to audio playback using requestAnimationFrame
    // (best-effort — may drop frames when window is minimized)
    await new Promise<void>((resolve, reject) => {
      let frameCount = 0;
      let hasErrored = false;

      const renderFrame = (): void => {
        if (hasErrored) return;
        if (this.isCancelled) {
          hasErrored = true;
          reject(new Error('Conversion cancelled by user'));
          return;
        }

        try {
          const currentTime = audioContext.currentTime;
          const cachedData = offlineAnalyzer.getDataAtTime(currentTime);

          if (cachedData) {
            visualizer.draw(ctx, {
              timeDomainData: cachedData.timeDomainData,
              frequencyData: cachedData.frequencyData,
              timestamp: currentTime * 1000,
              width: canvas.width,
              height: canvas.height,
              sampleRate,
              fftSize: analysisCache.fftSize,
            });
            frameCount++;
          }

          if (onProgress && duration > 0) {
            onProgress(Math.min(currentTime / duration, 1));
          }

          if (currentTime < duration && !this.isCancelled) {
            requestAnimationFrame(renderFrame);
          } else {
            this.log(`MediaRecorder fallback: ${frameCount} frames rendered`);
            resolve();
          }
        } catch (error) {
          hasErrored = true;
          reject(error);
        }
      };

      requestAnimationFrame(renderFrame);
    });

    // Wait for audio to fully finish playing through the AudioContext
    const remaining = Math.max(0, duration - audioContext.currentTime) * 1000;
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining + 200));
    await new Promise(r => setTimeout(r, 500));

    const blob = await new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        cleanup();
        const result = new Blob(recordedChunks, { type: mimeType });
        this.log(`MediaRecorder stopped, total size: ${result.size} bytes`);
        if (result.size === 0) {
          reject(new Error('Export failed: video blob is empty (0 bytes). Browser may have throttled canvas capture when window was minimized. Try keeping the window visible during export.'));
        } else {
          resolve(result);
        }
      };
      mediaRecorder.onerror = (e) => { cleanup(); reject(new Error(`MediaRecorder error: ${e}`)); };
      mediaRecorder.stop();
    });

    if (onProgress) onProgress(1);
    return blob;
  }

  private async loadArrayBuffer(audioSource: File | string): Promise<ArrayBuffer> {
    if (audioSource instanceof File) return audioSource.arrayBuffer();
    const response = await fetch(audioSource);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
    return response.arrayBuffer();
  }

  /**
   * Video codec candidates in order of preference
   */
  private static readonly VIDEO_CODECS = [
    { codec: 'avc1.42001f', name: 'H.264 Baseline', muxerCodec: 'avc' as const },
    { codec: 'avc1.4d001f', name: 'H.264 Main', muxerCodec: 'avc' as const },
    { codec: 'avc1.64001f', name: 'H.264 High', muxerCodec: 'avc' as const },
    { codec: 'vp09.00.10.08', name: 'VP9', muxerCodec: 'vp9' as const },
    { codec: 'av01.0.04M.08', name: 'AV1', muxerCodec: 'av1' as const },
  ];

  /**
   * Audio codec candidates in order of preference
   */
  private static readonly AUDIO_CODECS = [
    { codec: 'mp4a.40.2', name: 'AAC-LC' },
    { codec: 'mp4a.40.5', name: 'AAC-HE' },
    { codec: 'opus', name: 'Opus' },
  ];

  private async findSupportedVideoCodec(
    width: number,
    height: number,
    bitrate: number,
    framerate: number
  ): Promise<{ codec: string; name: string; muxerCodec: 'avc' | 'vp9' | 'av1' | 'hevc'; config: VideoEncoderConfig } | null> {
    for (const codecInfo of AudioToVideoConverter.VIDEO_CODECS) {
      const videoConfig: VideoEncoderConfig = { codec: codecInfo.codec, width, height, bitrate, framerate };
      try {
        const support = await VideoEncoder.isConfigSupported(videoConfig);
        if (support.supported) {
          this.log(`Video codec supported: ${codecInfo.name}`);
          return { ...codecInfo, config: videoConfig };
        }
      } catch (e) {
        this.log(`Error checking video codec ${codecInfo.name}:`, e);
      }
    }
    return null;
  }

  private async findSupportedAudioCodec(
    sampleRate: number,
    numberOfChannels: number,
    bitrate: number
  ): Promise<{ codec: string; name: string; config: AudioEncoderConfig } | null> {
    for (const codecInfo of AudioToVideoConverter.AUDIO_CODECS) {
      const audioConfig: AudioEncoderConfig = { codec: codecInfo.codec, sampleRate, numberOfChannels, bitrate };
      try {
        const support = await AudioEncoder.isConfigSupported(audioConfig);
        if (support.supported) {
          this.log(`Audio codec supported: ${codecInfo.name}`);
          return { ...codecInfo, config: audioConfig };
        }
      } catch (e) {
        this.log(`Error checking audio codec ${codecInfo.name}:`, e);
      }
    }
    return null;
  }

  /**
   * Get supported MIME type for the format (used by MediaRecorder fallback)
   */
  private getSupportedMimeType(format: string): string | null {
    const mimeTypes: Record<string, string[]> = {
      webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
      mp4: ['video/mp4;codecs=h264,aac', 'video/mp4'],
    };
    const types = mimeTypes[format] || mimeTypes['webm'];
    for (const mimeType of types) {
      if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
    }
    return null;
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
