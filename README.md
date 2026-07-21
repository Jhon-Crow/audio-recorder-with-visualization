# Audio Recorder with Visualization

A TypeScript library for audio visualization and recording. Capture audio from microphone, visualize it in real-time with various visualization effects, and record both audio and visualization to video (MP4/WebM).

## Features

- **Real-time audio visualization** from microphone input
- **Video recording** with audio + visualization (WebM/MP4)
- **Audio file to video conversion** with visualization
- **YouTube upload helper** for publishing generated videos through the YouTube Data API
- **Optional audio enhancement** for profile-based noise reduction, smart normalization, and saturation
- **Multiple visualization types**:
  - Waveform (oscilloscope)
  - Bars (spectrum analyzer)
  - Circular (radial spectrum)
  - Particles (audio-reactive particles)
  - Spectrum Gradient (Winamp-style spectrum with peak indicators)
  - Glow Waveform (waveform with glow effects and smooth curves)
  - VU Meter (classic audio equipment style meters)
  - Spectrogram (waterfall frequency display)
  - Double Spiral (dual spirals rotating in opposite directions)
  - Pulse (concentric rings pulsing from center)
  - Waterfall Bars (bars cascading down showing frequency history)
  - Grid (grid of reactive squares)
  - Lissajous (classic Lissajous curve pattern)
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
  visualizer: 'bars',    // 'waveform', 'bars', 'circular', 'particles', 'spectrum-gradient', 'glow-waveform', 'vu-meter', 'spectrogram', 'double-spiral', 'pulse', 'waterfall-bars', 'grid', 'lissajous'
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
  audioEnhancement?: AudioEnhancementOptions; // Optional audio processing, default: disabled
  debug?: boolean;                      // Enable debug logging
}
```

#### Audio Enhancement Options

All audio enhancement controls are disabled by default. Enable them in the constructor or update them at runtime:

```typescript
interface AudioEnhancementOptions {
  enabled?: boolean;
  noiseReduction?: number;              // 0-100, attenuates quiet background noise
  noiseProfile?: AudioNoiseProfile | null; // Learned noise-only spectrum, default: null
  noiseProfileReduction?: number;       // 0-100, applies learned profile reduction
  noiseProfileVoiceProtection?: number; // 0-100, protects speech bands from over-reduction
  smartNormalization?: number;           // 0-100, smooths loud/quiet sections
  saturation?: number;                   // 0-100, adds harmonic saturation
  saturationFrequencyRange?: { min: number; max: number }; // Hz, default 20-20000
  saturationMode?: 'soft-clip' | 'hard-clip' | 'tape' | 'tube';
}

const noiseProfileBuffer = await audioContext.decodeAudioData(await noiseOnlyFile.arrayBuffer());
const noiseProfile = AudioAnalyzer.createNoiseProfileFromAudioBuffer(noiseProfileBuffer);

recorder.setAudioEnhancement({
  enabled: true,
  noiseReduction: 10,
  noiseProfile,
  noiseProfileReduction: 45,
  noiseProfileVoiceProtection: 85,
  smartNormalization: 25,
  saturation: 0,
  saturationFrequencyRange: { min: 120, max: 8000 },
  saturationMode: 'tube',
});
```

For profile-based reduction, use a short file that contains only the microphone hiss,
fan, hum, or room tone you want to reduce. The profile is most effective for
steady noise. `noiseProfileVoiceProtection` keeps the speech range conservative
when the learned profile overlaps voice, so higher cleanup settings are less
likely to make speech sound hollow or muffled.

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
recorder.setAudioEnhancement(options: AudioEnhancementOptions): void
recorder.getAudioEnhancement(): ResolvedAudioEnhancementOptions
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
  audioEnhancement?: AudioEnhancementOptions,
  fps?: number,
  videoWidth?: number,
  videoHeight?: number,
  videoBitrate?: number,
  audioBitrate?: number,
  format?: 'webm' | 'mp4',
  onProgress?: (progress: number) => void,
});

// Join completed videos in order and rebuild a valid output container.
const joined = await converter.concatenateVideosWithFallback({
  videoSources: [firstVideoBlob, secondVideoBlob],
  canvas,
  videoWidth: 1920,
  videoHeight: 1080,
  format: 'webm',
  onProgress: (progress) => console.log(progress),
});
```

### YouTubeUploader

Browser-friendly helper for uploading a generated video `Blob` with the YouTube Data API resumable upload protocol. Use Google Identity Services to obtain an access token with `YOUTUBE_UPLOAD_SCOPE`, then pass that token to the uploader.

Browser Google sign-in must run from an authorized web origin. For local browser testing, serve the example from `http://localhost:8080` instead of opening `examples/index.html` with a `file://` URL, then add exactly `http://localhost:8080` to the Web application OAuth Client ID's Authorized JavaScript origins. The packaged Electron app uses a Desktop app OAuth Client ID and opens Google sign-in in the default browser with a loopback callback, so it does not use the browser JavaScript origin flow.

```typescript
import { YouTubeUploader, YOUTUBE_UPLOAD_SCOPE } from 'audio-recorder-with-visualization';

const uploader = new YouTubeUploader();
const result = await uploader.upload({
  video: videoBlob,
  thumbnail: thumbnailBlob, // optional JPEG, PNG, or WebP preview image
  accessToken,
  metadata: {
    title: 'Audio visualizer',
    description: 'Rendered with audio-recorder-with-visualization',
    tags: ['audio', 'visualizer'],
    privacyStatus: 'private',
    publishAt: '2026-07-01T12:30:00.000Z', // optional scheduled release time; upload stays private until then
    short: true, // appends #shorts to the description
  },
  onProgress: ({ percent }) => {
    console.log(`Uploaded ${Math.round(percent * 100)}%`);
  },
});

console.log(result.url);
console.log(YOUTUBE_UPLOAD_SCOPE);
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

#### Double Spiral (`double-spiral`)
Dual spirals rotating in opposite directions, reacting to audio frequency data.

**Custom Options:**
```typescript
{
  custom: {
    rotationSpeed: 0.02,      // Rotation speed in radians per frame (default: 0.02)
    spiralTightness: 0.5,     // How tight the spiral is, 0.1-2 (default: 0.5)
    maxRadius: 0.4,           // Max radius as fraction of min dimension (default: 0.4)
    glowEffect: true,         // Enable glow effect (default: true)
  }
}
```

#### Pulse (`pulse`)
Concentric rings that pulse from center based on bass intensity.

**Custom Options:**
```typescript
{
  custom: {
    pulseThreshold: 0.3,      // Minimum bass intensity to trigger pulse (default: 0.3)
    maxRings: 5,              // Maximum number of rings (default: 5)
    ringSpeed: 5,             // Ring expansion speed (default: 5)
    ringSpacing: 80,          // Space between rings in pixels (default: 80)
    fillRings: false,         // Fill rings instead of just stroke (default: false)
  }
}
```

#### Waterfall Bars (`waterfall-bars`)
Bars that cascade down like a waterfall, showing frequency history over time.

**Custom Options:**
```typescript
{
  custom: {
    scrollSpeed: 1,           // Pixels to scroll per frame (default: 1)
    historyLength: 50,        // Number of history frames to keep (default: 50)
    fadeEffect: true,         // Fade older bars (default: true)
  }
}
```

#### Grid (`grid`)
Grid of squares that react to different frequency bands.

**Custom Options:**
```typescript
{
  custom: {
    gridCols: 16,             // Number of columns (default: 16)
    gridRows: 12,             // Number of rows (default: 12)
    cellGap: 4,               // Gap between cells in pixels (default: 4)
    reactToFrequency: true,   // React to frequency or random (default: true)
    glowEffect: true,         // Enable glow effect (default: true)
  }
}
```

#### Lissajous (`lissajous`)
Classic Lissajous curve pattern based on audio waveform.

**Custom Options:**
```typescript
{
  custom: {
    size: 0.4,                // Size as fraction of min dimension (default: 0.4)
    trailLength: 100,         // Number of points in trail (default: 100)
    phaseOffset: Math.PI / 2, // Phase offset between X and Y (default: Math.PI / 2)
    frequencyRatio: 1,        // Frequency ratio X:Y, e.g., 1, 2, 3:2 (default: 1)
    showTrail: true,          // Show trail effect (default: true)
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
