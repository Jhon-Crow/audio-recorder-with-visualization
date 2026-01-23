// Main exports
export { AudioRecorder } from './AudioRecorder';
export { AudioToVideoConverter, type ConversionResult } from './AudioToVideoConverter';

// Core exports
export { AudioAnalyzer } from './core/AudioAnalyzer';
export { VideoRecorder } from './core/VideoRecorder';
export { EventEmitter } from './core/EventEmitter';
export { OfflineAudioAnalyzer } from './core/OfflineAudioAnalyzer';

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
  RecordingFormat,
  RecordingState,
  AudioSourceType,
  EventHandler,
  // Offline audio analyzer types
  CachedVisualizationData,
  AudioAnalysisCache,
  AnalysisProgressCallback,
  OfflineAnalyzerOptions,
} from './types';

export { SUPPORTED_MIME_TYPES } from './types';
