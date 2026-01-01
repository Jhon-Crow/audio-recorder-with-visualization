import { EventEmitter } from './core/EventEmitter';
import { AudioAnalyzer } from './core/AudioAnalyzer';
import { VideoRecorder } from './core/VideoRecorder';
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

    // Get 2D context
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

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
    this.log('AudioRecorder initialized');
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
      this.log('Stopped visualization');
    }
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
    return this.animationFrameId !== null;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
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
   * Clean up all resources
   */
  destroy(): void {
    this.stopVisualization();
    this.stopMicrophone();
    this.cancelRecording();

    if (this.audioElement) {
      this.audioElement.pause();
      if (this.audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioElement.src);
      }
      this.audioElement = null;
    }

    this.visualizer.destroy();
    this.analyzer.destroy();
    this.removeAllListeners();
    this.log('Destroyed AudioRecorder');
  }
}
