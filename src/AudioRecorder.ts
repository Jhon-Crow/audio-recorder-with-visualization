import { EventEmitter } from './core/EventEmitter';
import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
import {
  OfflineAudioAnalyzer,
  AudioAnalysisCache,
  AnalysisProgressCallback,
} from './core/OfflineAudioAnalyzer';
import {
  AudioRecorderConfig,
  AudioRecorderEvents,
  AudioSourceType,
  RecordingState,
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
  DoubleSpiralVisualizer,
  PulseVisualizer,
  WaterfallBarsVisualizer,
  GridVisualizer,
  LissajousVisualizer,
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
  'double-spiral': DoubleSpiralVisualizer,
  pulse: PulseVisualizer,
  'waterfall-bars': WaterfallBarsVisualizer,
  grid: GridVisualizer,
  lissajous: LissajousVisualizer,
};

/**
 * Main AudioRecorder class
 * Handles audio capture, visualization, and video recording
 */
export class AudioRecorder extends EventEmitter<AudioRecorderEvents> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyzer: AudioAnalyzer;
  private videoRecorder: VideoRecorder;
  private visualizer: Visualizer;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private frameInterval: number;
  private micStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private _sourceType: AudioSourceType | null = null;
  private debug: boolean;
  private _readyPromise: Promise<void>;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private debugVisualActive = false;
  private debugVisualAnimationId: number | null = null;
  private debugVisualStartTime = 0;

  // Offline preview mode properties
  private offlineAnalyzer: OfflineAudioAnalyzer | null = null;
  private previewMode: boolean = false;
  private previewTime: number = 0;
  private previewAudioElement: HTMLAudioElement | null = null;

  constructor(config: AudioRecorderConfig) {
    super();

    // Get canvas element
    if (typeof config.canvas === 'string') {
      const element = document.querySelector(config.canvas);
      if (!element || !(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas element not found: ${config.canvas}`);
      }
      this.canvas = element;
    } else {
      this.canvas = config.canvas;
    }

    // Get 2D context with color space settings for better color accuracy
    const ctx = this.canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: false,
    });
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    // Set image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.debug = config.debug ?? false;

    // Set canvas size
    if (config.videoWidth) {
      this.canvas.width = config.videoWidth;
    }
    if (config.videoHeight) {
      this.canvas.height = config.videoHeight;
    }

    // Initialize audio analyzer
    this.analyzer = new AudioAnalyzer({
      fftSize: config.fftSize ?? 2048,
      smoothingTimeConstant: config.smoothingTimeConstant ?? 0.8,
      debug: this.debug,
    });

    // Initialize video recorder
    this.videoRecorder = new VideoRecorder({ debug: this.debug });

    // Calculate frame interval for target FPS
    const fps = config.fps ?? 30;
    this.frameInterval = 1000 / fps;

    // Initialize visualizer
    if (config.visualizer) {
      if (typeof config.visualizer === 'string') {
        this.visualizer = this.createBuiltInVisualizer(
          config.visualizer,
          config.visualizerOptions
        );
      } else {
        this.visualizer = config.visualizer;
      }
    } else {
      this.visualizer = new BarVisualizer(config.visualizerOptions);
    }

    // Initialize visualizer and store the ready promise
    const initResult = this.visualizer.init(this.canvas, config.visualizerOptions);
    this._readyPromise = initResult instanceof Promise ? initResult : Promise.resolve();

    // Set up visibility change handler for tab switching
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.log('AudioRecorder initialized');
  }

  /**
   * Handle page visibility changes to ensure visualization continues when tab is hidden or window is minimized
   */
  private handleVisibilityChange(): void {
    // Check if we have an active audio source that needs visualization
    if (this._sourceType === null) {
      return;
    }

    if (document.hidden) {
      // Page is hidden, switch to timer-based animation
      this.log('Page hidden, switching to timer-based visualization');

      // Stop requestAnimationFrame
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Start timer-based animation
      this.startTimerFallback();
    } else {
      // Page is visible again, switch back to requestAnimationFrame
      this.log('Page visible, switching to requestAnimationFrame');

      // Stop timer
      this.stopTimerFallback();

      // Restart requestAnimationFrame if we have an active source
      if (this._sourceType !== null) {
        this.startVisualization();
      }
    }
  }

  /**
   * Start timer-based fallback for visualization when tab is hidden or window is minimized
   * Note: setInterval is used instead of requestAnimationFrame because rAF pauses when tab/window is not visible
   * We use a shorter interval (16ms) than the target frame rate because browsers may throttle timers
   * when the page is hidden, so we want to ensure frames are drawn as frequently as possible
   */
  private startTimerFallback(): void {
    if (this.timerIntervalId !== null) {
      return;
    }

    // Use a shorter polling interval (16ms ~ 60fps) to ensure frames are drawn
    // even when the browser throttles the timer. The actual frame rate is still
    // controlled by lastFrameTime check.
    const pollingInterval = Math.min(16, this.frameInterval);

    this.timerIntervalId = setInterval(() => {
      const timestamp = performance.now();
      if (timestamp - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        this.drawFrame(timestamp);
      }
    }, pollingInterval);

    this.log('Started timer fallback visualization with polling interval:', pollingInterval);
  }

  /**
   * Stop timer-based fallback
   */
  private stopTimerFallback(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
      this.log('Stopped timer fallback visualization');
    }
  }

  /**
   * Wait for the AudioRecorder to be fully ready (including image loading)
   * Call this before starting visualization if using background/foreground images
   */
  async ready(): Promise<void> {
    return this._readyPromise;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AudioRecorder]', ...args);
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
   * Start capturing audio from microphone
   */
  async startMicrophone(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      await this.analyzer.connectStream(this.micStream);
      this._sourceType = 'microphone';
      this.emit('source:change', 'microphone');
      this.startVisualization();
      this.log('Started microphone capture');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Connect an audio file for visualization
   */
  async connectAudioFile(file: File | string): Promise<HTMLAudioElement> {
    try {
      this.stopMicrophone();

      // Create audio element
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';

      if (file instanceof File) {
        this.audioElement.src = URL.createObjectURL(file);
      } else {
        this.audioElement.src = file;
      }

      await this.analyzer.connectAudioElement(this.audioElement);
      this._sourceType = 'file';
      this.emit('source:change', 'file');
      this.startVisualization();
      this.log('Connected audio file');

      return this.audioElement;
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop microphone capture
   */
  stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
      this.log('Stopped microphone');
    }
    this.analyzer.disconnect();
    this._sourceType = null;
  }

  /**
   * Start visualization loop
   */
  private startVisualization(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const animate = (timestamp: number): void => {
      // Limit frame rate
      if (timestamp - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        this.drawFrame(timestamp);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
    this.log('Started visualization');
  }

  /**
   * Stop visualization loop
   */
  stopVisualization(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Also stop timer fallback if active
    this.stopTimerFallback();
    this.log('Stopped visualization');
  }

  /**
   * Resume visualization loop
   * Use this to restart visualization after it was stopped (e.g., during audio-to-video conversion)
   * Only works if an audio source is connected
   */
  resumeVisualization(): void {
    if (this._sourceType !== null) {
      this.startVisualization();
    }
  }

  /**
   * Draw a single visualization frame
   */
  private drawFrame(timestamp: number): void {
    const data: VisualizationData = {
      timeDomainData: this.analyzer.getTimeDomainData(),
      frequencyData: this.analyzer.getFrequencyData(),
      timestamp,
      width: this.canvas.width,
      height: this.canvas.height,
      sampleRate: this.analyzer.sampleRate,
      fftSize: this.analyzer.fftSize,
    };

    this.visualizer.draw(this.ctx, data);
    this.emit('frame', data);
  }

  /**
   * Draw a single demo frame (for preview without audio source)
   */
  private drawDemoFrame(timestamp: number): void {
    const data: VisualizationData = {
      timeDomainData: this.analyzer.generateDemoTimeDomainData(),
      frequencyData: this.analyzer.generateDemoFrequencyData(),
      timestamp,
      width: this.canvas.width,
      height: this.canvas.height,
      sampleRate: this.analyzer.sampleRate,
      fftSize: this.analyzer.fftSize,
    };

    this.visualizer.draw(this.ctx, data);
    this.emit('frame', data);
  }

  /**
   * Show a brief demo visualization (for preview without audio source)
   * Useful for previewing visualization settings changes
   */
  showDemoVisualization(durationMs: number = 1000): void {
    // Stop any existing visualization
    this.stopVisualization();

    let startTime: number | null = null;
    const animate = (timestamp: number): void => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;

      // Limit frame rate
      if (timestamp - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        this.drawDemoFrame(timestamp);
      }

      // Continue animation if duration hasn't elapsed
      if (elapsed < durationMs) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        // Clean up after demo
        this.animationFrameId = null;
        // If there was an active source, restart its visualization
        if (this._sourceType !== null) {
          this.startVisualization();
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
    this.log('Started demo visualization for', durationMs, 'ms');
  }

  /**
   * Analyze an audio file for offline preview mode
   * This pre-computes visualization data for the entire file, enabling:
   * - Instant waveform preview before playback
   * - Smooth scrubbing through the audio
   * - Visualization that persists when window is minimized
   *
   * @param source - File, URL string, or ArrayBuffer containing audio data
   * @param onProgress - Optional progress callback (0-1)
   * @returns Promise resolving to the analysis cache
   */
  async analyzeAudioFile(
    source: File | string | ArrayBuffer,
    onProgress?: AnalysisProgressCallback
  ): Promise<AudioAnalysisCache> {
    // Create offline analyzer if not exists
    if (!this.offlineAnalyzer) {
      this.offlineAnalyzer = new OfflineAudioAnalyzer({
        fftSize: this.analyzer.fftSize,
        debug: this.debug,
      });
    }

    this.log('Starting offline audio analysis...');
    const cache = await this.offlineAnalyzer.analyzeAudio(source, onProgress);
    this.log('Audio analysis complete:', cache.segmentCount, 'segments');

    return cache;
  }

  /**
   * Connect an audio file with offline preview support
   * This will analyze the audio file first, then set up playback
   * The waveform will be visible immediately after analysis, before pressing Play
   *
   * @param file - File or URL string for the audio
   * @param onAnalysisProgress - Optional progress callback for analysis phase (0-1)
   * @returns Promise resolving to the HTMLAudioElement for playback control
   */
  async connectAudioFileWithPreview(
    file: File | string,
    onAnalysisProgress?: AnalysisProgressCallback
  ): Promise<HTMLAudioElement> {
    try {
      this.stopMicrophone();
      this.stopPreview();

      // First, analyze the audio file offline
      await this.analyzeAudioFile(file, onAnalysisProgress);

      // Create audio element for playback
      this.previewAudioElement = new Audio();
      this.previewAudioElement.crossOrigin = 'anonymous';

      if (file instanceof File) {
        this.previewAudioElement.src = URL.createObjectURL(file);
      } else {
        this.previewAudioElement.src = file;
      }

      // Wait for audio element to be ready
      await new Promise<void>((resolve, reject) => {
        if (this.previewAudioElement) {
          this.previewAudioElement.onloadedmetadata = () => resolve();
          this.previewAudioElement.onerror = () => reject(new Error('Failed to load audio'));
        } else {
          reject(new Error('Audio element not created'));
        }
      });

      // Enable preview mode and show initial visualization
      this.previewMode = true;
      this.previewTime = 0;
      this._sourceType = 'file';

      // Set up audio element event handlers for synchronized visualization
      this.previewAudioElement.ontimeupdate = () => {
        if (this.previewAudioElement && this.previewMode) {
          this.previewTime = this.previewAudioElement.currentTime;
        }
      };

      // Start preview visualization
      this.startPreviewVisualization();

      this.emit('source:change', 'file');
      this.log('Connected audio file with preview mode');

      return this.previewAudioElement;
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start visualization in preview mode using cached offline data
   */
  private startPreviewVisualization(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const animate = (timestamp: number): void => {
      // Limit frame rate
      if (timestamp - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        this.drawPreviewFrame(timestamp);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
    this.log('Started preview visualization');
  }

  /**
   * Draw a frame using cached offline data
   */
  private drawPreviewFrame(timestamp: number): void {
    if (!this.offlineAnalyzer || !this.offlineAnalyzer.isCached) {
      // Fallback to demo data if cache not available
      this.drawDemoFrame(timestamp);
      return;
    }

    // Get cached data for current preview time
    const cachedData = this.offlineAnalyzer.getDataAtTime(this.previewTime);
    if (!cachedData) {
      this.drawDemoFrame(timestamp);
      return;
    }

    const cache = this.offlineAnalyzer.analysisCache!;

    const data: VisualizationData = {
      timeDomainData: cachedData.timeDomainData,
      frequencyData: cachedData.frequencyData,
      timestamp,
      width: this.canvas.width,
      height: this.canvas.height,
      sampleRate: cache.sampleRate,
      fftSize: cache.fftSize,
    };

    this.visualizer.draw(this.ctx, data);
    this.emit('frame', data);
  }

  /**
   * Seek to a specific time in preview mode
   * This will instantly update the visualization to show the waveform at that time
   *
   * @param time - Time in seconds to seek to
   */
  seekPreview(time: number): void {
    if (!this.previewMode || !this.offlineAnalyzer?.isCached) {
      return;
    }

    const duration = this.offlineAnalyzer.duration;
    this.previewTime = Math.max(0, Math.min(time, duration));

    // Also seek the audio element if it exists
    if (this.previewAudioElement) {
      this.previewAudioElement.currentTime = this.previewTime;
    }

    // Force an immediate redraw
    this.drawPreviewFrame(performance.now());

    this.log('Seeked preview to:', this.previewTime.toFixed(2), 'seconds');
  }

  /**
   * Get the waveform overview for the analyzed audio
   * Returns peak amplitudes suitable for drawing a waveform preview/scrubber
   *
   * @param numPoints - Number of points to generate (default: 200)
   * @returns Array of peak amplitude values (0-1), or null if no audio is analyzed
   */
  getWaveformOverview(numPoints: number = 200): Float32Array | null {
    return this.offlineAnalyzer?.getWaveformOverview(numPoints) ?? null;
  }

  /**
   * Get the duration of the analyzed audio
   * @returns Duration in seconds, or 0 if no audio is analyzed
   */
  getPreviewDuration(): number {
    return this.offlineAnalyzer?.duration ?? 0;
  }

  /**
   * Get the current preview time
   * @returns Current time in seconds
   */
  getPreviewTime(): number {
    return this.previewTime;
  }

  /**
   * Check if preview mode is active
   */
  get isPreviewMode(): boolean {
    return this.previewMode;
  }

  /**
   * Check if offline analysis is in progress
   */
  get isAnalyzing(): boolean {
    return this.offlineAnalyzer?.isAnalyzing ?? false;
  }

  /**
   * Check if audio has been analyzed and cached
   */
  get hasAnalysisCache(): boolean {
    return this.offlineAnalyzer?.isCached ?? false;
  }

  /**
   * Get the audio element used for preview playback
   */
  getPreviewAudioElement(): HTMLAudioElement | null {
    return this.previewAudioElement;
  }

  /**
   * Play the preview audio
   * Visualization will sync with playback automatically
   */
  async playPreview(): Promise<void> {
    if (this.previewAudioElement) {
      await this.previewAudioElement.play();
      this.log('Started preview playback');
    }
  }

  /**
   * Pause the preview audio
   */
  pausePreview(): void {
    if (this.previewAudioElement) {
      this.previewAudioElement.pause();
      this.log('Paused preview playback');
    }
  }

  /**
   * Stop preview mode and clean up resources
   */
  stopPreview(): void {
    this.stopVisualization();
    this.previewMode = false;
    this.previewTime = 0;

    if (this.previewAudioElement) {
      this.previewAudioElement.pause();
      if (this.previewAudioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.previewAudioElement.src);
      }
      this.previewAudioElement = null;
    }

    this.log('Stopped preview mode');
  }

  /**
   * Abort any in-progress offline analysis
   */
  abortAnalysis(): void {
    this.offlineAnalyzer?.abortAnalysis();
    this.log('Aborted offline analysis');
  }

  /**
   * Start recording video
   */
  startRecording(options?: {
    videoBitrate?: number;
    audioBitrate?: number;
  }): void {
    if (this.videoRecorder.state !== 'inactive') {
      throw new Error('Recording already in progress');
    }

    this.videoRecorder.start(this.canvas, this.micStream ?? undefined, {
      fps: 1000 / this.frameInterval,
      ...options,
    });

    this.emit('recording:start', undefined);
    this.log('Started recording');
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    this.videoRecorder.pause();
    this.emit('recording:pause', undefined);
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    this.videoRecorder.resume();
    this.emit('recording:resume', undefined);
  }

  /**
   * Stop recording and return the video blob
   */
  async stopRecording(): Promise<Blob> {
    const blob = await this.videoRecorder.stop();
    this.emit('recording:stop', blob);
    this.log('Stopped recording, blob size:', blob.size);
    return blob;
  }

  /**
   * Cancel recording and discard data
   */
  cancelRecording(): void {
    this.videoRecorder.cancel();
    this.log('Cancelled recording');
  }

  /**
   * Change visualizer
   * @returns Promise that resolves when the new visualizer is fully initialized
   */
  async setVisualizer(visualizer: Visualizer | string, options?: VisualizerOptions): Promise<void> {
    this.visualizer.destroy();

    if (typeof visualizer === 'string') {
      this.visualizer = this.createBuiltInVisualizer(visualizer, options);
    } else {
      this.visualizer = visualizer;
    }

    // Wait for visualizer initialization (including image loading) to prevent flickering
    const initResult = this.visualizer.init(this.canvas, options);
    this._readyPromise = initResult instanceof Promise ? initResult : Promise.resolve();
    await this._readyPromise;
    this.emit('visualizer:change', this.visualizer);
    this.log('Changed visualizer to:', this.visualizer.name);
  }

  /**
   * Update visualizer options
   * @returns Promise that resolves when any image loading is complete
   */
  async setVisualizerOptions(options: Partial<VisualizerOptions>): Promise<void> {
    if (this.visualizer.setOptions) {
      const result = this.visualizer.setOptions(options);
      if (result instanceof Promise) {
        await result;
      }
    }
  }

  /**
   * Get current visualizer
   */
  getVisualizer(): Visualizer {
    return this.visualizer;
  }

  /**
   * Get list of available built-in visualizers
   */
  static getAvailableVisualizers(): string[] {
    return Object.keys(BUILT_IN_VISUALIZERS);
  }

  /**
   * Get recording state
   */
  get recordingState(): RecordingState {
    return this.videoRecorder.state;
  }

  /**
   * Get current audio source type
   */
  get sourceType(): AudioSourceType | null {
    return this._sourceType;
  }

  /**
   * Check if visualization is active
   */
  get isVisualizationActive(): boolean {
    return this.animationFrameId !== null || this.timerIntervalId !== null;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get current frequency data (spectrum) for external use (e.g., presentation mode)
   * Returns empty data if no audio source is active
   */
  getFrequencyData(): Uint8Array | null {
    return this.analyzer.getFrequencyData();
  }

  /**
   * Get current time domain data (waveform) for external use (e.g., presentation mode)
   * Returns empty data if no audio source is active
   */
  getTimeDomainData(): Uint8Array | null {
    return this.analyzer.getTimeDomainData();
  }

  /**
   * Get audio context
   */
  getAudioContext(): AudioContext {
    return this.analyzer.getAudioContext();
  }

  /**
   * Get supported recording formats
   */
  static getSupportedFormats(): string[] {
    return VideoRecorder.getSupportedFormats();
  }

  /**
   * Show debug visual boundaries with blink effect
   * Displays a blinking boundary around the canvas to indicate active parameter changes
   */
  showDebugVisual(): void {
    if (this.debugVisualActive) {
      return;
    }

    this.debugVisualActive = true;
    this.debugVisualStartTime = performance.now();
    this.log('Debug visual activated');

    // Start the animation loop for the debug visual
    const animateDebugVisual = (timestamp: number): void => {
      if (!this.debugVisualActive) {
        return;
      }

      // Draw the debug visual boundaries
      this.drawDebugBoundaries(timestamp);

      // Continue animation
      this.debugVisualAnimationId = requestAnimationFrame(animateDebugVisual);
    };

    this.debugVisualAnimationId = requestAnimationFrame(animateDebugVisual);
  }

  /**
   * Hide debug visual boundaries
   */
  hideDebugVisual(): void {
    if (!this.debugVisualActive) {
      return;
    }

    this.debugVisualActive = false;

    if (this.debugVisualAnimationId !== null) {
      cancelAnimationFrame(this.debugVisualAnimationId);
      this.debugVisualAnimationId = null;
    }

    this.log('Debug visual deactivated');
  }

  /**
   * Draw debug boundaries with blink effect
   */
  private drawDebugBoundaries(timestamp: number): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Calculate blink effect using sine wave for smooth pulsing
    // Period: 800ms for complete blink cycle
    const blinkPeriod = 800;
    const phase = ((timestamp - this.debugVisualStartTime) % blinkPeriod) / blinkPeriod;
    const opacity = 0.3 + 0.5 * Math.abs(Math.sin(phase * Math.PI * 2));

    // Save current context state
    ctx.save();

    // Draw outer boundary (main canvas boundary)
    ctx.strokeStyle = `rgba(255, 100, 100, ${opacity})`;
    ctx.lineWidth = 8;
    ctx.setLineDash([20, 10]);
    ctx.lineDashOffset = -(timestamp / 20);
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Draw inner boundary (visualization area indicator)
    ctx.strokeStyle = `rgba(100, 200, 255, ${opacity * 0.7})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 8]);
    ctx.lineDashOffset = timestamp / 15;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Draw corner markers for better visibility
    const markerSize = 30;
    const markerColor = `rgba(255, 200, 50, ${opacity})`;
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(10, 10 + markerSize);
    ctx.lineTo(10, 10);
    ctx.lineTo(10 + markerSize, 10);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(width - 10 - markerSize, 10);
    ctx.lineTo(width - 10, 10);
    ctx.lineTo(width - 10, 10 + markerSize);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(10, height - 10 - markerSize);
    ctx.lineTo(10, height - 10);
    ctx.lineTo(10 + markerSize, height - 10);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(width - 10 - markerSize, height - 10);
    ctx.lineTo(width - 10, height - 10);
    ctx.lineTo(width - 10, height - 10 - markerSize);
    ctx.stroke();

    // Restore context state
    ctx.restore();
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    // Remove visibility change listener
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.hideDebugVisual();
    this.stopVisualization();
    this.stopMicrophone();
    this.stopPreview();
    this.cancelRecording();

    if (this.audioElement) {
      this.audioElement.pause();
      if (this.audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioElement.src);
      }
      this.audioElement = null;
    }

    // Clean up offline analyzer
    if (this.offlineAnalyzer) {
      this.offlineAnalyzer.destroy();
      this.offlineAnalyzer = null;
    }

    this.visualizer.destroy();
    this.analyzer.destroy();
    this.removeAllListeners();
    this.log('Destroyed AudioRecorder');
  }
}
