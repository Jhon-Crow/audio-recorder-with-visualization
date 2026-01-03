/**
 * Core types for audio-recorder-with-visualization
 */

/**
 * Visualization data passed to visualizers each frame
 */
export interface VisualizationData {
  /** Time domain data (waveform) - values 0-255 */
  timeDomainData: Uint8Array;
  /** Frequency domain data (spectrum) - values 0-255 */
  frequencyData: Uint8Array;
  /** Current timestamp in milliseconds */
  timestamp: number;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Audio sample rate in Hz */
  sampleRate: number;
  /** FFT size used for analysis */
  fftSize: number;
}

/**
 * Base interface for all visualizers
 */
export interface Visualizer {
  /** Unique identifier for the visualizer */
  readonly id: string;
  /** Display name for the visualizer */
  readonly name: string;

  /**
   * Initialize the visualizer
   * @param canvas - The canvas element to draw on
   * @param options - Optional configuration options
   * @returns Promise that resolves when initialization is complete (including image loading)
   */
  init(canvas: HTMLCanvasElement, options?: VisualizerOptions): void | Promise<void>;

  /**
   * Draw a single frame of visualization
   * @param ctx - Canvas 2D rendering context
   * @param data - Visualization data for current frame
   */
  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void;

  /**
   * Clean up resources when visualizer is destroyed
   */
  destroy(): void;

  /**
   * Update visualizer options at runtime
   * @param options - New options to apply
   * @returns Promise that resolves when any image loading is complete
   */
  setOptions?(options: Partial<VisualizerOptions>): void | Promise<void>;
}

/**
 * Options for visualizer configuration
 */
export interface VisualizerOptions {
  /** Primary color for visualization */
  primaryColor?: string;
  /** Secondary color for visualization (gradients, etc.) */
  secondaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Whether to draw background on each frame */
  drawBackground?: boolean;
  /** Line width for drawing */
  lineWidth?: number;
  /** Number of bars for bar visualizations */
  barCount?: number;
  /** Gap between bars as fraction of bar width (0-1) */
  barGap?: number;
  /** Whether to mirror the visualization vertically */
  mirror?: boolean;
  /** Smoothing factor for animations (0-1) */
  smoothing?: number;
  /** Background image or GIF */
  backgroundImage?: HTMLImageElement | string;
  /** Foreground image or GIF */
  foregroundImage?: HTMLImageElement | string;
  /** Foreground image opacity (0-1), default: 1 */
  foregroundAlpha?: number;
  /** Visualization opacity (0-1), default: 1 - controls transparency of waveforms, bars, particles, etc. */
  visualizationAlpha?: number;
  /** Horizontal offset in pixels (can be negative), default: 0 - shifts visualization left/right */
  offsetX?: number;
  /** Vertical offset in pixels (can be negative), default: 0 - shifts visualization up/down */
  offsetY?: number;
  /** Custom options for specific visualizers */
  custom?: Record<string, unknown>;
}

/**
 * Recording format options
 */
export type RecordingFormat = 'webm' | 'mp4';

/**
 * Recording state
 */
export type RecordingState = 'inactive' | 'recording' | 'paused';

/**
 * Audio source type
 */
export type AudioSourceType = 'microphone' | 'file' | 'stream';

/**
 * Configuration for AudioRecorder
 */
export interface AudioRecorderConfig {
  /** Canvas element or selector for visualization */
  canvas: HTMLCanvasElement | string;
  /** FFT size for audio analysis (power of 2, 32-32768) */
  fftSize?: number;
  /** Smoothing time constant for analyzer (0-1) */
  smoothingTimeConstant?: number;
  /** Target frames per second for visualization */
  fps?: number;
  /** Video width in pixels */
  videoWidth?: number;
  /** Video height in pixels */
  videoHeight?: number;
  /** Video bitrate in bits per second */
  videoBitrate?: number;
  /** Audio bitrate in bits per second */
  audioBitrate?: number;
  /** Preferred recording format */
  format?: RecordingFormat;
  /** Initial visualizer to use */
  visualizer?: Visualizer | string;
  /** Visualizer options */
  visualizerOptions?: VisualizerOptions;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Configuration for audio file to video conversion
 */
export interface ConversionConfig {
  /** Source audio file or URL */
  audioSource: File | string;
  /** Canvas element or selector for visualization */
  canvas: HTMLCanvasElement | string;
  /** Visualizer to use */
  visualizer?: Visualizer | string;
  /** Visualizer options */
  visualizerOptions?: VisualizerOptions;
  /** Target frames per second */
  fps?: number;
  /** Video width in pixels */
  videoWidth?: number;
  /** Video height in pixels */
  videoHeight?: number;
  /** Video bitrate in bits per second */
  videoBitrate?: number;
  /** Audio bitrate in bits per second */
  audioBitrate?: number;
  /** Preferred output format */
  format?: RecordingFormat;
  /** Progress callback */
  onProgress?: (progress: number) => void;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Events emitted by AudioRecorder
 */
export type AudioRecorderEvents = {
  /** Emitted when recording starts */
  'recording:start': void;
  /** Emitted when recording stops */
  'recording:stop': Blob;
  /** Emitted when recording is paused */
  'recording:pause': void;
  /** Emitted when recording is resumed */
  'recording:resume': void;
  /** Emitted when an error occurs */
  'error': Error;
  /** Emitted when visualization frame is drawn */
  'frame': VisualizationData;
  /** Emitted when audio source changes */
  'source:change': AudioSourceType;
  /** Emitted when visualizer changes */
  'visualizer:change': Visualizer;
  /** Index signature for compatibility */
  [key: string]: unknown;
}

/**
 * Event handler type
 */
export type EventHandler<T> = (data: T) => void;

/**
 * Supported MIME types for recording
 */
export const SUPPORTED_MIME_TYPES = {
  webm: [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ],
  mp4: [
    'video/mp4;codecs=avc1.424028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ],
} as const;
