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
 * Background image sizing modes
 */
export type BackgroundSizeMode = 'cover' | 'contain' | 'stretch' | 'tile' | 'center' | 'custom';

/**
 * Layer effect types
 */
export type LayerEffectType = 'none' | 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'invert' | 'sepia' | 'saturate' | 'hue-rotate';

/**
 * Image blink effect styles
 */
export type ImageBlinkStyle = 'gradient-sweep' | 'negative-flash' | 'brightness-pulse' | 'color-flash';

/**
 * Image blink target layer
 */
export type ImageBlinkTarget = 'background' | 'foreground' | 'both';

/**
 * Saturation curve styles for audio enhancement
 */
export type SaturationMode = 'soft-clip' | 'hard-clip' | 'tape' | 'tube';

/**
 * One learned noise band used by profile-based noise reduction.
 */
export interface AudioNoiseProfileBand {
  /** Lower edge of the band in Hz */
  lowerFrequency: number;
  /** Center frequency for the correction filter in Hz */
  centerFrequency: number;
  /** Upper edge of the band in Hz */
  upperFrequency: number;
  /** Filter Q for this band */
  q: number;
  /** Measured average noise level in this band, in dBFS */
  levelDb: number;
  /** Difference from the median profile band level in dB */
  prominenceDb?: number;
  /** Estimated overlap with the speech range, 0-1 */
  voiceOverlap?: number;
  /** Suggested attenuation for this band in dB before user strength is applied */
  reductionDb: number;
}

/**
 * Learned spectral fingerprint of microphone/background noise.
 */
export interface AudioNoiseProfile {
  /** Profile format version */
  version: 1;
  /** Source sample rate in Hz */
  sampleRate: number;
  /** FFT size used to analyze the profile */
  fftSize: number;
  /** Number of analyzed frequency bands */
  bandCount: number;
  /** Lower analyzed frequency in Hz */
  minFrequency: number;
  /** Upper analyzed frequency in Hz */
  maxFrequency: number;
  /** Duration of analyzed noise-only audio in seconds */
  durationSeconds: number;
  /** Time-domain RMS level of the profile source in dBFS */
  averageLevelDb: number;
  /** Log-spaced reduction bands derived from the noise-only source */
  bands: AudioNoiseProfileBand[];
}

/**
 * Options for deriving a noise profile from noise-only audio.
 */
export interface AudioNoiseProfileOptions {
  /** FFT size for profile analysis, power of 2, default: 2048 */
  fftSize?: number;
  /** Number of log-spaced bands to generate, default: 12 */
  bandCount?: number;
  /** Lowest analyzed frequency in Hz, default: 80 */
  minFrequency?: number;
  /** Highest analyzed frequency in Hz, default: min(16000, Nyquist * 0.95) */
  maxFrequency?: number;
  /** Maximum duration to analyze, default: 30 seconds */
  maxDurationSeconds?: number;
  /** Minimum per-band attenuation candidate in dB, default: 1.5 */
  minReductionDb?: number;
  /** Maximum per-band attenuation candidate in dB, default: 18 */
  maxReductionDb?: number;
}

/**
 * Audio enhancement settings. All processing is bypassed unless enabled is true
 * and at least one amount is greater than 0.
 */
export interface AudioEnhancementOptions {
  /** Master switch for audio enhancement, default: false */
  enabled?: boolean;
  /** Low-level noise attenuation amount (0-100), default: 0 */
  noiseReduction?: number;
  /** Learned microphone/background noise profile, default: null */
  noiseProfile?: AudioNoiseProfile | null;
  /** Profile-based reduction amount (0-100), default: 45 when a profile is supplied */
  noiseProfileReduction?: number;
  /** How strongly profile reduction protects speech-range bands (0-100), default: 85 */
  noiseProfileVoiceProtection?: number;
  /** Dynamics smoothing and make-up gain amount (0-100), default: 0 */
  smartNormalization?: number;
  /** Harmonic saturation amount (0-100), default: 0 */
  saturation?: number;
  /** Frequency range in Hz used by the saturation wet path, default: 20-20000 */
  saturationFrequencyRange?: { min: number; max: number };
  /** Saturation curve style, default: soft-clip */
  saturationMode?: SaturationMode;
}

/**
 * Fully resolved audio enhancement settings
 */
export interface ResolvedAudioEnhancementOptions {
  enabled: boolean;
  noiseReduction: number;
  noiseProfile: AudioNoiseProfile | null;
  noiseProfileReduction: number;
  noiseProfileVoiceProtection: number;
  smartNormalization: number;
  saturation: number;
  saturationFrequencyRange: { min: number; max: number };
  saturationMode: SaturationMode;
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
  /** Frequency width as percentage of spectrum to display (10-100), default: 100 */
  frequencyWidth?: number;
  /** Whether to mirror the visualization vertically */
  mirror?: boolean;
  /** Whether to mirror the visualization horizontally (reflect around center) */
  mirrorHorizontal?: boolean;
  /** Smoothing factor for animations (0-1) - deprecated, use ADSR envelope instead */
  smoothing?: number;
  /** ADSR Attack time (0-100) - how quickly visualization responds to audio onset. 0 = instant, 100 = slow rise */
  adsrAttack?: number;
  /** ADSR Decay time (0-100) - how quickly visualization falls from peak to sustain level. 0 = instant, 100 = slow decay */
  adsrDecay?: number;
  /** ADSR Sustain level (0-100) - minimum level maintained during audio input. 0 = no sustain, 100 = full sustain */
  adsrSustain?: number;
  /** ADSR Release time (0-100) - how quickly visualization fades when audio stops. 0 = instant, 100 = slow release */
  adsrRelease?: number;
  /** Visualization sensitivity multiplier (0.1-5.0) - controls how responsive visualization is to audio. 1.0 = normal, >1.0 = more sensitive, <1.0 = less sensitive */
  sensitivity?: number;
  /** Background image or GIF */
  backgroundImage?: HTMLImageElement | string;
  /** Background image sizing mode (cover, contain, stretch, tile, center, custom) */
  backgroundSizeMode?: BackgroundSizeMode;
  /** Custom background width (used with backgroundSizeMode: 'custom') */
  backgroundWidth?: number;
  /** Custom background height (used with backgroundSizeMode: 'custom') */
  backgroundHeight?: number;
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
  /** Scale factor for visualization size (0.5 - 2.0), default: 1.0 - scales visualization around center */
  scale?: number;
  /** Layer effect type applied between background and visualization */
  layerEffect?: LayerEffectType;
  /** Layer effect intensity (0-100), default: 50 */
  layerEffectIntensity?: number;
  /** Enable image blinking based on frequency and volume, default: false */
  imageBlinkEnabled?: boolean;
  /** Frequency range in Hz to monitor for blinking trigger, default: { min: 60, max: 250 } (bass range) */
  imageBlinkFrequencyRange?: { min: number; max: number };
  /** Volume threshold (0-255) that must be exceeded to trigger blink, default: 200 */
  imageBlinkVolumeThreshold?: number;
  /** Style of blinking effect, default: 'gradient-sweep' */
  imageBlinkStyle?: ImageBlinkStyle;
  /** Intensity of blink effect (0-100), default: 80 */
  imageBlinkIntensity?: number;
  /** Target layer for blink effect, default: 'background' */
  imageBlinkTarget?: ImageBlinkTarget;
  /** Duration of blink effect in milliseconds, default: 150 */
  imageBlinkDuration?: number;
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
  /** Optional audio enhancement applied before visualization and recording */
  audioEnhancement?: AudioEnhancementOptions;
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
  /** Optional audio enhancement applied before visualization and recording */
  audioEnhancement?: AudioEnhancementOptions;
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
    // Constrained Baseline Profile, Level 3.0 - widely supported, good for mobile
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    // Main Profile, Level 3.1 - better compression, good compatibility
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    // High Profile, Level 3.1 - best compression, may need hardware support
    'video/mp4;codecs=avc1.64001F,mp4a.40.2',
    // Fallback without specific codec
    'video/mp4',
  ],
} as const;
