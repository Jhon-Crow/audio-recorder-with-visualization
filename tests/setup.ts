/**
 * Jest setup file
 * Mock Web Audio API and other browser APIs for testing
 */

// Mock AudioContext
class MockAudioContext {
  private _state: AudioContextState = 'running';
  readonly sampleRate = 44100;

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

  createMediaStreamSource(_stream: MediaStream): MediaStreamAudioSourceNode {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;
  }

  createMediaElementSource(_element: HTMLMediaElement): MediaElementAudioSourceNode {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaElementAudioSourceNode;
  }

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    return {
      stream: new MediaStream(),
    } as unknown as MediaStreamAudioDestinationNode;
  }
}

class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 1024;

  connect(): void {}
  disconnect(): void {}

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

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Set up globals
(global as Record<string, unknown>).AudioContext = MockAudioContext;
(global as Record<string, unknown>).MediaRecorder = MockMediaRecorder;
(global as Record<string, unknown>).MediaStream = MockMediaStream;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream()),
  },
  writable: true,
});

export {};
