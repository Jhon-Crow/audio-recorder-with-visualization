// Main exports
export { AudioRecorder } from './AudioRecorder';
export { AudioToVideoConverter, type ConversionResult } from './AudioToVideoConverter';

// Core exports
export { AudioAnalyzer } from './core/AudioAnalyzer';
export { VideoRecorder } from './core/VideoRecorder';
export { EventEmitter } from './core/EventEmitter';
export {
  YouTubeUploader,
  YouTubeUploadError,
  appendShortHashtag,
  buildYouTubeVideoResource,
  getYouTubeWatchUrl,
  normalizeYouTubeTags,
  YOUTUBE_SHORT_HASHTAG,
  YOUTUBE_UPLOAD_ENDPOINT,
  YOUTUBE_UPLOAD_SCOPE,
  type YouTubePrivacyStatus,
  type YouTubeUploadMetadata,
  type YouTubeUploadProgress,
  type YouTubeUploadRequest,
  type YouTubeUploadResult,
  type YouTubeUploadStage,
  type YouTubeVideoResource,
} from './core/YouTubeUploader';

// Visualizer exports
export {
  BaseVisualizer,
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

// Type exports
export type {
  Visualizer,
  VisualizerOptions,
  VisualizationData,
  AudioRecorderConfig,
  AudioRecorderEvents,
  ConversionConfig,
  AudioEnhancementOptions,
  AudioNoiseProfile,
  AudioNoiseProfileBand,
  AudioNoiseProfileOptions,
  ResolvedAudioEnhancementOptions,
  SaturationMode,
  RecordingFormat,
  RecordingState,
  AudioSourceType,
  EventHandler,
} from './types';

export { SUPPORTED_MIME_TYPES } from './types';
