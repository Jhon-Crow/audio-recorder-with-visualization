# Audio Recorder with Visualization

A TypeScript library for audio visualization and recording. Capture audio from microphone, visualize it in real-time with various visualization effects, and record both audio and visualization to video (MP4/WebM).

## Features

- **Real-time audio visualization** from microphone input
- **Video recording** with audio + visualization (WebM/MP4)
- **Audio file to video conversion** with visualization
- **Multiple visualization types**:
  - Waveform (oscilloscope)
  - Bars (spectrum analyzer)
  - Circular (radial spectrum)
  - Particles (audio-reactive particles)
- **Custom images/GIFs** as backgrounds or overlays
- **Extensible visualizer system** - create your own visualizers
- **Maximum performance** - optimized rendering with requestAnimationFrame and typed arrays
- **TypeScript support** with full type definitions

## Installation

```bash
npm install audio-recorder-with-visualization
```

Or include via CDN:

```html
<script src="https://unpkg.com/audio-recorder-with-visualization/dist/audio-recorder-visualization.umd.js"></script>
```

## Quick Start

### Recording from Microphone

```typescript
import { AudioRecorder } from 'audio-recorder-with-visualization';

// Create recorder
const recorder = new AudioRecorder({
  canvas: '#visualizer', // Canvas element or selector
  visualizer: 'bars',    // 'waveform', 'bars', 'circular', 'particles'
  fftSize: 2048,
  fps: 30,
});

// Start microphone capture
await recorder.startMicrophone();

// Start recording
recorder.startRecording();

// ... record for some time ...

// Stop recording and get video blob
const videoBlob = await recorder.stopRecording();

// Download the video
const url = URL.createObjectURL(videoBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'recording.webm';
a.click();

// Clean up
recorder.destroy();
```

### Converting Audio File to Video

```typescript
import { AudioToVideoConverter } from 'audio-recorder-with-visualization';

const converter = new AudioToVideoConverter();

const videoBlob = await converter.convert({
  audioSource: audioFile, // File or URL
  canvas: '#visualizer',
  visualizer: 'circular',
  visualizerOptions: {
    primaryColor: '#ff6b6b',
    secondaryColor: '#4ecdc4',
  },
  onProgress: (progress) => {
    console.log(`Progress: ${Math.round(progress * 100)}%`);
  },
});
```

## API Reference

### AudioRecorder

Main class for capturing audio and recording video.

#### Constructor Options

```typescript
interface AudioRecorderConfig {
  canvas: HTMLCanvasElement | string;  // Canvas element or CSS selector
  fftSize?: number;                     // FFT size (32-32768, power of 2), default: 2048
  smoothingTimeConstant?: number;       // Analyzer smoothing (0-1), default: 0.8
  fps?: number;                         // Target frames per second, default: 30
  videoWidth?: number;                  // Video width in pixels
  videoHeight?: number;                 // Video height in pixels
  videoBitrate?: number;                // Video bitrate in bps, default: 2500000
  audioBitrate?: number;                // Audio bitrate in bps, default: 128000
  format?: 'webm' | 'mp4';              // Recording format, default: 'webm'
  visualizer?: Visualizer | string;     // Visualizer instance or name
  visualizerOptions?: VisualizerOptions;// Visualizer options
  debug?: boolean;                      // Enable debug logging
}
```

#### Methods

```typescript
// Audio source
await recorder.startMicrophone(): Promise<void>
recorder.stopMicrophone(): void
await recorder.connectAudioFile(file: File | string): Promise<HTMLAudioElement>

// Recording
recorder.startRecording(options?: { videoBitrate?: number; audioBitrate?: number }): void
recorder.pauseRecording(): void
recorder.resumeRecording(): void
await recorder.stopRecording(): Promise<Blob>
recorder.cancelRecording(): void

// Visualization
recorder.setVisualizer(visualizer: Visualizer | string, options?: VisualizerOptions): void
recorder.setVisualizerOptions(options: Partial<VisualizerOptions>): void
recorder.stopVisualization(): void

// Properties
recorder.recordingState: 'inactive' | 'recording' | 'paused'
recorder.sourceType: 'microphone' | 'file' | null
recorder.isVisualizationActive: boolean

// Static methods
AudioRecorder.getAvailableVisualizers(): string[]
AudioRecorder.getSupportedFormats(): string[]

// Cleanup
recorder.destroy(): void
```

#### Events

```typescript
recorder.on('recording:start', () => { ... });
recorder.on('recording:stop', (blob: Blob) => { ... });
recorder.on('recording:pause', () => { ... });
recorder.on('recording:resume', () => { ... });
recorder.on('error', (error: Error) => { ... });
recorder.on('frame', (data: VisualizationData) => { ... });
recorder.on('visualizer:change', (visualizer: Visualizer) => { ... });
```

### AudioToVideoConverter

Class for converting audio files to videos with visualization.

```typescript
const converter = new AudioToVideoConverter({ debug?: boolean });

const blob = await converter.convert({
  audioSource: File | string,
  canvas: HTMLCanvasElement | string,
  visualizer?: Visualizer | string,
  visualizerOptions?: VisualizerOptions,
  fps?: number,
  videoWidth?: number,
  videoHeight?: number,
  videoBitrate?: number,
  audioBitrate?: number,
  format?: 'webm' | 'mp4',
  onProgress?: (progress: number) => void,
});
```

### Visualizer Options

```typescript
interface VisualizerOptions {
  primaryColor?: string;         // Primary color for visualization
  secondaryColor?: string;       // Secondary color (gradients, etc.)
  backgroundColor?: string;      // Background color
  drawBackground?: boolean;      // Whether to draw background each frame
  lineWidth?: number;            // Line width for drawing
  barCount?: number;             // Number of bars (bar visualizer)
  barGap?: number;               // Gap between bars (0-1)
  mirror?: boolean;              // Mirror visualization vertically
  smoothing?: number;            // Animation smoothing (0-1)
  backgroundImage?: string | HTMLImageElement;  // Background image/GIF
  foregroundImage?: string | HTMLImageElement;  // Foreground overlay
  custom?: Record<string, unknown>;  // Visualizer-specific options
}
```

## Creating Custom Visualizers

Extend the `BaseVisualizer` class to create custom visualizations:

```typescript
import { BaseVisualizer, VisualizationData, VisualizerOptions } from 'audio-recorder-with-visualization';

class MyVisualizer extends BaseVisualizer {
  readonly id = 'my-visualizer';
  readonly name = 'My Custom Visualizer';

  constructor(options?: VisualizerOptions) {
    super(options);
  }

  draw(ctx: CanvasRenderingContext2D, data: VisualizationData): void {
    const { width, height, frequencyData, timeDomainData } = data;

    // Draw background
    this.drawBackground(ctx, data);

    // Your custom drawing logic here
    // ...

    // Draw foreground overlay if set
    this.drawForeground(ctx, data);
  }
}

// Use custom visualizer
const recorder = new AudioRecorder({
  canvas: '#visualizer',
  visualizer: new MyVisualizer({ primaryColor: '#ff0000' }),
});
```

### VisualizationData

Data passed to the `draw` method each frame:

```typescript
interface VisualizationData {
  timeDomainData: Uint8Array;  // Waveform data (0-255, 128 = silence)
  frequencyData: Uint8Array;   // Spectrum data (0-255)
  timestamp: number;           // Current timestamp in ms
  width: number;               // Canvas width
  height: number;              // Canvas height
  sampleRate: number;          // Audio sample rate
  fftSize: number;             // FFT size
}
```

## Browser Support

- Chrome 53+
- Firefox 36+
- Safari 11+
- Edge 79+

Note: MP4 recording support varies by browser. WebM is supported in all modern browsers.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start development server with examples
npm run serve
```

## License

This is free and unencumbered software released into the public domain (Unlicense).
