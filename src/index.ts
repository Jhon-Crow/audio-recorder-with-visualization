// Main exports
export { AudioRecorder } from './AudioRecorder';
export { AudioToVideoConverter } from './AudioToVideoConverter';
export {
  CustomVisualizerLoader,
  CustomVisualizerError,
} from './CustomVisualizerLoader';

// Core exports
export { AudioAnalyzer } from './core/AudioAnalyzer';
export { VideoRecorder } from './core/VideoRecorder';
export { EventEmitter } from './core/EventEmitter';

// Visualizer exports
export {
  BaseVisualizer,
  WaveformVisualizer,
  BarVisualizer,
  CircularVisualizer,
  ParticleVisualizer,
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
} from './types';

export type {
  CustomVisualizerModule,
  CustomVisualizerMetadata,
  CustomOptionSchema,
  LoadedCustomVisualizer,
} from './CustomVisualizerLoader';

export { SUPPORTED_MIME_TYPES } from './types';
