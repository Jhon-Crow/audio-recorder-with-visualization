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
  - Spectrum Gradient (Winamp-style spectrum with peak indicators)
  - Glow Waveform (waveform with glow effects and smooth curves)
  - VU Meter (classic audio equipment style meters)
  - Spectrogram (waterfall frequency display)
- **Custom images/GIFs** as backgrounds or overlays
- **Extensible visualizer system** - create your own visualizers
- **Custom visualizer loader** - upload and use custom visualization JS files directly in the UI
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
  visualizer: 'bars',    // 'waveform', 'bars', 'circular', 'particles', 'spectrum-gradient', 'glow-waveform', 'vu-meter', 'spectrogram'
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
recorder.resumeVisualization(): void  // Resume after stopVisualization (e.g., during conversion)

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

### Built-in Visualizers

#### Spectrum Gradient (`spectrum-gradient`)
Winamp-style spectrum analyzer with gradient fills and peak indicators.

**Custom Options:**
```typescript
{
  custom: {
    fillStyle: 'gradient' | 'solid' | 'rainbow',  // Fill style (default: 'gradient')
    peakDots: true,                                // Show peak indicator dots (default: true)
    peakFallSpeed: 0.5,                           // Peak fall speed (default: 0.5)
    gradientColors: ['#ff0000', '#ff7700', '#ffff00', '#00ff00'],  // Custom gradient colors
  }
}
```

#### Glow Waveform (`glow-waveform`)
Enhanced waveform with glow effects and smooth curves.

**Custom Options:**
```typescript
{
  custom: {
    glowIntensity: 20,      // Glow blur radius (default: 20)
    fillWave: true,         // Fill area under waveform (default: true)
    fillOpacity: 0.3,       // Fill opacity (default: 0.3)
    smoothCurves: true,     // Use smooth bezier curves (default: true)
  }
}
```

#### VU Meter (`vu-meter`)
Classic audio equipment style VU meters with peak hold.

**Custom Options:**
```typescript
{
  custom: {
    meterStyle: 'modern' | 'classic' | 'led',  // Meter style (default: 'modern')
    showPeakIndicator: true,                    // Show peak indicator (default: true)
    peakHoldTime: 30,                           // Frames to hold peak (default: 30)
    horizontalLayout: true,                     // Horizontal or vertical layout (default: true)
  }
}
```

#### Spectrogram (`spectrogram`)
Waterfall display showing frequency data over time.

**Custom Options:**
```typescript
{
  custom: {
    scrollSpeed: 1,                              // Pixels to scroll per frame (default: 1)
    colorScheme: 'rainbow' | 'heat' | 'cool' | 'grayscale',  // Color scheme (default: 'rainbow')
    orientation: 'vertical' | 'horizontal',      // Scroll direction (default: 'vertical')
    frequencyRange: 'full' | 'bass' | 'mid' | 'high',  // Frequency range to display (default: 'full')
  }
}
```

#### Usage Example with Custom Options

```typescript
const recorder = new AudioRecorder({
  canvas: '#visualizer',
  visualizer: 'spectrum-gradient',
  visualizerOptions: {
    primaryColor: '#00ff88',
    secondaryColor: '#0088ff',
    barCount: 128,
    custom: {
      fillStyle: 'rainbow',
      peakDots: true,
      peakFallSpeed: 0.8,
    },
  },
});
```

## Creating Custom Visualizers

### Using the UI (Recommended)

The easiest way to create and use custom visualizers:

1. Click **"Download Template"** in the Visualization Options panel
2. Edit the downloaded `custom-visualizer-template.js` file
3. Upload your modified `.js` file using the **"Custom Visualizer"** file input
4. Your visualizer will appear in the dropdown and be automatically selected

### Programmatic Usage

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

### Loading Custom Visualizers from Files

Use `CustomVisualizerLoader` to load visualizers from JavaScript files:

```typescript
import { CustomVisualizerLoader, AudioRecorder } from 'audio-recorder-with-visualization';

const loader = new CustomVisualizerLoader({ debug: true });

// Load from file
const fileInput = document.getElementById('visualizer-file');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const loaded = await loader.loadFromFile(file);

  // Use the loaded visualizer
  await recorder.setVisualizer(loaded.visualizer);
  console.log(`Loaded: ${loaded.metadata.name}`);
});

// Generate a template
const template = CustomVisualizerLoader.generateTemplate({
  name: 'MyVisualizer',
  id: 'my-visualizer'
});
```

For detailed documentation on creating custom visualizers, see [docs/CUSTOM_VISUALIZERS.md](docs/CUSTOM_VISUALIZERS.md).

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
