/**
 * Jest setup file
 * Mock Web Audio API and other browser APIs for testing
 */

// Mock AudioContext
class MockAudioNode {
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockAudioParam {
  constructor(public value: number) {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

class MockWaveShaperNode extends MockAudioNode {
  curve: Float32Array | null = null;
  oversample: OverSampleType = 'none';
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-24);
  knee = new MockAudioParam(30);
  ratio = new MockAudioParam(12);
  reduction = 0;
  attack = new MockAudioParam(0.003);
  release = new MockAudioParam(0.25);
}

class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam(350);
  detune = new MockAudioParam(0);
  Q = new MockAudioParam(1);
  gain = new MockAudioParam(0);
}

class MockAudioContext {
  private _state: AudioContextState = 'running';
  readonly sampleRate = 44100;
  readonly destination = new MockAudioNode() as unknown as AudioDestinationNode;

  get state(): AudioContextState {
    return this._state;
  }

  async resume(): Promise<void> {
    this._state = 'running';
  }

  async close(): Promise<void> {
    this._state = 'closed';
  }

  createAnalyser(): AnalyserNode {
    return new MockAnalyserNode() as unknown as AnalyserNode;
  }

  createGain(): GainNode {
    return new MockGainNode() as unknown as GainNode;
  }

  createWaveShaper(): WaveShaperNode {
    return new MockWaveShaperNode() as unknown as WaveShaperNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new MockDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new MockBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  createMediaStreamSource(_stream: MediaStream): MediaStreamAudioSourceNode {
    return new MockAudioNode() as unknown as MediaStreamAudioSourceNode;
  }

  createMediaElementSource(_element: HTMLMediaElement): MediaElementAudioSourceNode {
    return new MockAudioNode() as unknown as MediaElementAudioSourceNode;
  }

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    return {
      stream: new MediaStream(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioDestinationNode;
  }
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 1024;

  getByteTimeDomainData(array: Uint8Array): void {
    // Fill with silence (128)
    array.fill(128);
  }

  getByteFrequencyData(array: Uint8Array): void {
    // Fill with zeros
    array.fill(0);
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: MediaStreamTrack[] = [];

  constructor() {
    this.tracks = [
      {
        kind: 'audio',
        stop: jest.fn(),
      } as unknown as MediaStreamTrack,
    ];
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly mimeType: string;

  static isTypeSupported(mimeType: string): boolean {
    return mimeType.includes('webm');
  }

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'video/webm';
  }

  start(_timeslice?: number): void {
    this.state = 'recording';
    // Simulate data available after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob(['test'], { type: this.mimeType }),
        } as BlobEvent);
      }
    }, 10);
  }

  stop(): void {
    this.state = 'inactive';
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 10);
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }
}

// Mock canvas captureStream
HTMLCanvasElement.prototype.captureStream = function (_frameRate?: number): MediaStream {
  return new MockMediaStream() as unknown as MediaStream;
};

// Mock Canvas2D context
class MockCanvasRenderingContext2D {
  canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  globalAlpha = 1;

  fillRect(): void {}
  strokeRect(): void {}
  clearRect(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  stroke(): void {}
  fill(): void {}
  arc(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  drawImage(): void {}

  createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number): CanvasGradient {
    return {
      addColorStop: jest.fn(),
    } as unknown as CanvasGradient;
  }

  createRadialGradient(): CanvasGradient {
    return {
      addColorStop: jest.fn(),
    } as unknown as CanvasGradient;
  }

  createPattern(_image: CanvasImageSource, _repetition: string | null): CanvasPattern | null {
    return {
      setTransform: jest.fn(),
    } as unknown as CanvasPattern;
  }

  // Additional context properties and methods needed for tests
  filter = 'none';
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  textAlign: CanvasTextAlign = 'start';
  font = '10px sans-serif';
  setLineDash(_segments: number[]): void {}
  lineDashOffset = 0;
  getImageData(_sx: number, _sy: number, sw: number, sh: number): ImageData {
    return new ImageData(sw || 1, sh || 1);
  }
  putImageData(): void {}
  fillText(): void {}
  measureText(): TextMetrics {
    return { width: 0 } as TextMetrics;
  }
  clip(): void {}
  resetTransform(): void {}
}

// Override getContext on HTMLCanvasElement prototype
const originalGetContext = HTMLCanvasElement.prototype.getContext;
(HTMLCanvasElement.prototype as unknown as { getContext: (contextType: string, contextAttributes?: unknown) => unknown }).getContext = function(
  contextType: string,
  _contextAttributes?: unknown
): unknown {
  if (contextType === '2d') {
    return new MockCanvasRenderingContext2D(this as HTMLCanvasElement) as unknown as CanvasRenderingContext2D;
  }
  return originalGetContext.call(this, contextType as '2d', _contextAttributes as CanvasRenderingContext2DSettings);
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
};

// Mock HTMLMediaElement methods that jsdom doesn't implement
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  value: jest.fn(),
  writable: true,
  configurable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  value: jest.fn().mockResolvedValue(undefined),
  writable: true,
  configurable: true,
});

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Mock ImageData
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';

  constructor(sw: number, sh: number);
  constructor(data: Uint8ClampedArray, sw: number, sh?: number);
  constructor(dataOrWidth: Uint8ClampedArray | number, swOrHeight: number, sh?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = swOrHeight;
      this.height = sh ?? Math.floor(dataOrWidth.length / (swOrHeight * 4));
    } else {
      this.width = dataOrWidth;
      this.height = swOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

// Set up globals
(global as Record<string, unknown>).AudioContext = MockAudioContext;
(global as Record<string, unknown>).MediaRecorder = MockMediaRecorder;
(global as Record<string, unknown>).MediaStream = MockMediaStream;
(global as Record<string, unknown>).ImageData = MockImageData;

// Mock URL.createObjectURL and URL.revokeObjectURL
// Use Object.defineProperty to ensure the mock is properly applied
if (!global.URL) {
  (global as Record<string, unknown>).URL = class URL {
    constructor(url: string) {
      return new (globalThis.URL || window.URL)(url);
    }
  } as unknown as typeof URL;
}
Object.defineProperty(global.URL, 'createObjectURL', {
  value: jest.fn().mockReturnValue('blob:mock-url'),
  writable: true,
  configurable: true,
});
Object.defineProperty(global.URL, 'revokeObjectURL', {
  value: jest.fn(),
  writable: true,
  configurable: true,
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream()),
  },
  writable: true,
});

// Mock Image to properly trigger onload for data URLs and file URLs
// We need to patch the prototype to ensure onload is called
const originalImageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');

Object.defineProperty(HTMLImageElement.prototype, 'src', {
  get: function() {
    return this._mockSrc || '';
  },
  set: function(value: string) {
    this._mockSrc = value;
    // Call original setter if it exists
    if (originalImageDescriptor && originalImageDescriptor.set) {
      originalImageDescriptor.set.call(this, value);
    }
    // Simulate async image loading
    if (value) {
      setTimeout(() => {
        // Set mock dimensions
        Object.defineProperty(this, 'width', { value: 100, configurable: true });
        Object.defineProperty(this, 'height', { value: 100, configurable: true });
        if (this.onload) {
          this.onload(new Event('load'));
        }
      }, 0);
    }
  },
  configurable: true,
});

export {};
