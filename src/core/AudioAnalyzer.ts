/**
 * Audio analyzer using Web Audio API
 * Provides FFT data for visualization
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private timeDomainData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private _fftSize: number;
  private _smoothingTimeConstant: number;
  private debug: boolean;

  constructor(options: {
    fftSize?: number;
    smoothingTimeConstant?: number;
    debug?: boolean;
  } = {}) {
    this._fftSize = options.fftSize ?? 2048;
    this._smoothingTimeConstant = options.smoothingTimeConstant ?? 0.8;
    this.debug = options.debug ?? false;

    // Validate FFT size (must be power of 2 between 32 and 32768)
    if (!this.isValidFftSize(this._fftSize)) {
      throw new Error('FFT size must be a power of 2 between 32 and 32768');
    }
  }

  private isValidFftSize(size: number): boolean {
    return size >= 32 && size <= 32768 && (size & (size - 1)) === 0;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AudioAnalyzer]', ...args);
    }
  }

  /**
   * Get the audio context (lazily initialized)
   */
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.log('Created AudioContext, sample rate:', this.audioContext.sampleRate);
    }
    return this.audioContext;
  }

  /**
   * Get or create the analyzer node
   */
  private getAnalyzerNode(): AnalyserNode {
    if (!this.analyzerNode) {
      const ctx = this.getAudioContext();
      this.analyzerNode = ctx.createAnalyser();
      this.analyzerNode.fftSize = this._fftSize;
      this.analyzerNode.smoothingTimeConstant = this._smoothingTimeConstant;

      // Pre-allocate typed arrays
      this.timeDomainData = new Uint8Array(this.analyzerNode.fftSize);
      this.frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);

      this.log('Created AnalyserNode, fftSize:', this._fftSize, 'frequencyBinCount:', this.analyzerNode.frequencyBinCount);
    }
    return this.analyzerNode;
  }

  /**
   * Connect a media stream (from microphone) to the analyzer
   */
  async connectStream(stream: MediaStream): Promise<void> {
    this.disconnect();

    const ctx = this.getAudioContext();
    const analyzer = this.getAnalyzerNode();

    // Resume audio context if suspended (required for autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
      this.log('Resumed AudioContext');
    }

    this.sourceNode = ctx.createMediaStreamSource(stream);
    this.sourceNode.connect(analyzer);

    this.log('Connected MediaStream source');
  }

  /**
   * Connect an audio element to the analyzer
   */
  async connectAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    this.disconnect();

    const ctx = this.getAudioContext();
    const analyzer = this.getAnalyzerNode();

    // Resume audio context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
      this.log('Resumed AudioContext');
    }

    this.sourceNode = ctx.createMediaElementSource(audioElement);
    this.sourceNode.connect(analyzer);
    // Also connect to destination so audio plays through speakers
    analyzer.connect(ctx.destination);

    this.log('Connected AudioElement source');
  }

  /**
   * Disconnect current source
   */
  disconnect(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
      this.log('Disconnected source');
    }
    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
    }
  }

  /**
   * Get current time domain data (waveform)
   * Values range from 0-255, with 128 being silence
   */
  getTimeDomainData(): Uint8Array {
    if (this.analyzerNode) {
      this.analyzerNode.getByteTimeDomainData(this.timeDomainData);
    }
    return this.timeDomainData;
  }

  /**
   * Get current frequency data (spectrum)
   * Values range from 0-255
   */
  getFrequencyData(): Uint8Array {
    if (this.analyzerNode) {
      this.analyzerNode.getByteFrequencyData(this.frequencyData);
    }
    return this.frequencyData;
  }

  /**
   * Get FFT size
   */
  get fftSize(): number {
    return this._fftSize;
  }

  /**
   * Set FFT size (will recreate analyzer node)
   */
  set fftSize(value: number) {
    if (!this.isValidFftSize(value)) {
      throw new Error('FFT size must be a power of 2 between 32 and 32768');
    }
    this._fftSize = value;
    if (this.analyzerNode) {
      this.analyzerNode.fftSize = value;
      this.timeDomainData = new Uint8Array(value);
      this.frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);
    }
  }

  /**
   * Get frequency bin count (fftSize / 2)
   */
  get frequencyBinCount(): number {
    return this._fftSize / 2;
  }

  /**
   * Get sample rate
   */
  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  /**
   * Get smoothing time constant
   */
  get smoothingTimeConstant(): number {
    return this._smoothingTimeConstant;
  }

  /**
   * Set smoothing time constant
   */
  set smoothingTimeConstant(value: number) {
    this._smoothingTimeConstant = Math.max(0, Math.min(1, value));
    if (this.analyzerNode) {
      this.analyzerNode.smoothingTimeConstant = this._smoothingTimeConstant;
    }
  }

  /**
   * Check if audio context is running
   */
  get isActive(): boolean {
    return this.audioContext?.state === 'running' && this.sourceNode !== null;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.disconnect();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.log('Closed AudioContext');
    }
    this.analyzerNode = null;
    this.timeDomainData = new Uint8Array(0);
    this.frequencyData = new Uint8Array(0);
  }
}
