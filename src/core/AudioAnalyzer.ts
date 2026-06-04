import {
  AudioEnhancementOptions,
  ResolvedAudioEnhancementOptions,
  SaturationMode,
} from '../types';

/**
 * Audio analyzer using Web Audio API
 * Provides FFT data for visualization
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private graphNodes: AudioNode[] = [];
  private processedDestination: MediaStreamAudioDestinationNode | null = null;
  private outputToSpeakers = false;
  private timeDomainData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private _fftSize: number;
  private _smoothingTimeConstant: number;
  private debug: boolean;
  private audioEnhancement: ResolvedAudioEnhancementOptions;

  constructor(options: {
    fftSize?: number;
    smoothingTimeConstant?: number;
    audioEnhancement?: AudioEnhancementOptions;
    debug?: boolean;
  } = {}) {
    this._fftSize = options.fftSize ?? 2048;
    this._smoothingTimeConstant = options.smoothingTimeConstant ?? 0.8;
    this.debug = options.debug ?? false;
    this.audioEnhancement = this.resolveAudioEnhancement(options.audioEnhancement);

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

  private clampPercent(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, value ?? 0));
  }

  private isSaturationMode(value: unknown): value is SaturationMode {
    return value === 'soft-clip'
      || value === 'hard-clip'
      || value === 'tape'
      || value === 'tube';
  }

  private resolveAudioEnhancement(
    options: AudioEnhancementOptions = {}
  ): ResolvedAudioEnhancementOptions {
    const requestedRange = options.saturationFrequencyRange ?? { min: 20, max: 20000 };
    const rawMin = Number.isFinite(requestedRange.min) ? requestedRange.min : 20;
    const rawMax = Number.isFinite(requestedRange.max) ? requestedRange.max : 20000;
    const boundedMin = Math.max(20, Math.min(20000, rawMin));
    const boundedMax = Math.max(20, Math.min(20000, rawMax));
    const min = Math.min(boundedMin, boundedMax);
    const max = Math.max(boundedMin, boundedMax);

    return {
      enabled: options.enabled ?? false,
      noiseReduction: this.clampPercent(options.noiseReduction),
      smartNormalization: this.clampPercent(options.smartNormalization),
      saturation: this.clampPercent(options.saturation),
      saturationFrequencyRange: { min, max },
      saturationMode: this.isSaturationMode(options.saturationMode)
        ? options.saturationMode
        : 'soft-clip',
    };
  }

  private createNoiseReductionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 2048;
    const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
    const strength = amount / 100;
    const threshold = 0.004 + strength * 0.055;
    const floorGain = 1 - strength * 0.88;

    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1;
      const magnitude = Math.abs(x);

      if (magnitude < threshold) {
        const fade = magnitude / threshold;
        curve[i] = x * floorGain * fade;
      } else if (magnitude < threshold * 2) {
        const fade = (magnitude - threshold) / threshold;
        const gain = floorGain + (1 - floorGain) * fade;
        curve[i] = x * gain;
      } else {
        curve[i] = x;
      }
    }

    return curve;
  }

  private createSaturationCurve(amount: number, mode: SaturationMode): Float32Array<ArrayBuffer> {
    const samples = 4096;
    const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
    const strength = amount / 100;
    const drive = 1 + strength * 9;
    const normalizer = Math.tanh(drive);

    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1;
      let y: number;

      switch (mode) {
        case 'hard-clip': {
          const limit = 1 - strength * 0.45;
          y = Math.max(-limit, Math.min(limit, x * drive)) / limit;
          break;
        }
        case 'tape':
          y = ((1 + drive) * x) / (1 + drive * Math.abs(x));
          break;
        case 'tube': {
          const biased = x + strength * 0.22 * (x * x - 0.5);
          y = Math.tanh(drive * biased) / normalizer;
          break;
        }
        case 'soft-clip':
        default:
          y = Math.tanh(drive * x) / normalizer;
          break;
      }

      curve[i] = Math.max(-1, Math.min(1, y));
    }

    return curve;
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

  private disconnectAudioGraph(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    for (const node of this.graphNodes) {
      node.disconnect();
    }
    this.graphNodes = [];

    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
    }

    if (this.processedDestination) {
      this.processedDestination = null;
    }
  }

  private applyNoiseReduction(ctx: AudioContext, input: AudioNode): AudioNode {
    const amount = this.audioEnhancement.noiseReduction;
    if (amount <= 0) {
      return input;
    }

    const strength = amount / 100;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 25 + strength * 95;
    highpass.Q.value = 0.707;

    const attenuator = ctx.createWaveShaper();
    attenuator.curve = this.createNoiseReductionCurve(amount);
    attenuator.oversample = 'none';

    input.connect(highpass);
    highpass.connect(attenuator);
    this.graphNodes.push(highpass, attenuator);

    return attenuator;
  }

  private applySmartNormalization(ctx: AudioContext, input: AudioNode): AudioNode {
    const amount = this.audioEnhancement.smartNormalization;
    if (amount <= 0) {
      return input;
    }

    const strength = amount / 100;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18 - strength * 24;
    compressor.knee.value = 18 + strength * 18;
    compressor.ratio.value = 1 + strength * 9;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12 + strength * 0.28;

    const makeupGain = ctx.createGain();
    makeupGain.gain.value = 1 + strength * 0.9;

    input.connect(compressor);
    compressor.connect(makeupGain);
    this.graphNodes.push(compressor, makeupGain);

    return makeupGain;
  }

  private applySaturation(ctx: AudioContext, input: AudioNode): AudioNode {
    const amount = this.audioEnhancement.saturation;
    if (amount <= 0) {
      return input;
    }

    const strength = amount / 100;
    const output = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    let wetInput = input;

    dryGain.gain.value = Math.max(0.55, 1 - strength * 0.25);
    wetGain.gain.value = strength * 0.85;
    shaper.curve = this.createSaturationCurve(amount, this.audioEnhancement.saturationMode);
    shaper.oversample = amount > 50 ? '4x' : '2x';

    const nyquist = ctx.sampleRate / 2;
    const range = this.audioEnhancement.saturationFrequencyRange;
    const minFrequency = Math.max(20, Math.min(range.min, nyquist - 10));
    const maxFrequency = Math.max(minFrequency + 10, Math.min(range.max, nyquist - 10));

    input.connect(dryGain);
    dryGain.connect(output);

    if (minFrequency > 20) {
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = minFrequency;
      highpass.Q.value = 0.707;
      wetInput.connect(highpass);
      wetInput = highpass;
      this.graphNodes.push(highpass);
    }

    if (maxFrequency < nyquist - 100) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = maxFrequency;
      lowpass.Q.value = 0.707;
      wetInput.connect(lowpass);
      wetInput = lowpass;
      this.graphNodes.push(lowpass);
    }

    wetInput.connect(shaper);
    shaper.connect(wetGain);
    wetGain.connect(output);
    this.graphNodes.push(output, dryGain, wetGain, shaper);

    return output;
  }

  private applyAudioEnhancement(ctx: AudioContext, input: AudioNode): AudioNode {
    let current = input;
    current = this.applyNoiseReduction(ctx, current);
    current = this.applySmartNormalization(ctx, current);
    current = this.applySaturation(ctx, current);
    return current;
  }

  private connectAudioGraph(outputToSpeakers: boolean): void {
    if (!this.sourceNode) {
      return;
    }

    const ctx = this.getAudioContext();
    const analyzer = this.getAnalyzerNode();
    this.outputToSpeakers = outputToSpeakers;
    this.disconnectAudioGraph();

    let current: AudioNode = this.sourceNode;
    if (this.isAudioEnhancementActive) {
      current = this.applyAudioEnhancement(ctx, current);
    }

    current.connect(analyzer);

    if (this.isAudioEnhancementActive) {
      this.processedDestination = ctx.createMediaStreamDestination();
      current.connect(this.processedDestination);
    }

    if (outputToSpeakers) {
      current.connect(ctx.destination);
    }

    this.log(
      'Connected audio graph',
      this.isAudioEnhancementActive ? 'with enhancement' : 'without enhancement'
    );
  }

  /**
   * Connect a media stream (from microphone) to the analyzer
   */
  async connectStream(stream: MediaStream): Promise<void> {
    this.disconnect();

    const ctx = this.getAudioContext();

    // Resume audio context if suspended (required for autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
      this.log('Resumed AudioContext');
    }

    this.sourceNode = ctx.createMediaStreamSource(stream);
    this.connectAudioGraph(false);

    this.log('Connected MediaStream source');
  }

  /**
   * Connect an audio element to the analyzer
   */
  async connectAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    this.disconnect();

    const ctx = this.getAudioContext();

    // Resume audio context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
      this.log('Resumed AudioContext');
    }

    this.sourceNode = ctx.createMediaElementSource(audioElement);
    this.connectAudioGraph(true);

    this.log('Connected AudioElement source');
  }

  /**
   * Disconnect current source
   */
  disconnect(): void {
    if (this.sourceNode || this.graphNodes.length > 0 || this.processedDestination) {
      this.disconnectAudioGraph();
    }
    this.sourceNode = null;
    this.outputToSpeakers = false;
    this.log('Disconnected source');
    // Clear the audio data buffers to show silence when disconnected
    this.clearAudioData();
  }

  /**
   * Update audio enhancement settings and rebuild the active graph if needed
   */
  setAudioEnhancement(options: AudioEnhancementOptions): void {
    this.audioEnhancement = this.resolveAudioEnhancement({
      ...this.audioEnhancement,
      ...options,
      saturationFrequencyRange: options.saturationFrequencyRange
        ?? this.audioEnhancement.saturationFrequencyRange,
    });

    if (this.sourceNode) {
      this.connectAudioGraph(this.outputToSpeakers);
    }
  }

  /**
   * Get resolved audio enhancement settings
   */
  getAudioEnhancement(): ResolvedAudioEnhancementOptions {
    return {
      ...this.audioEnhancement,
      saturationFrequencyRange: { ...this.audioEnhancement.saturationFrequencyRange },
    };
  }

  /**
   * Get processed audio stream from the current graph
   */
  getProcessedStream(): MediaStream | null {
    return this.processedDestination?.stream ?? null;
  }

  /**
   * Clear audio data buffers (fill with silence)
   */
  private clearAudioData(): void {
    // Fill with 128 for time domain (represents silence in Uint8Array)
    this.timeDomainData.fill(128);
    // Fill with 0 for frequency domain (no frequencies)
    this.frequencyData.fill(0);
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
   * Generate demo/test frequency data for visualization preview
   * Creates a standard pattern that simulates music frequencies
   */
  generateDemoFrequencyData(): Uint8Array {
    const demoData = new Uint8Array(this.frequencyBinCount);
    const time = Date.now() / 1000;

    // Generate a musical pattern with bass, mids, and highs
    for (let i = 0; i < this.frequencyBinCount; i++) {
      const frequency = i / this.frequencyBinCount;

      // Bass frequencies (lower indices) - stronger
      const bass = Math.exp(-frequency * 3) * 200;

      // Mid frequencies - moderate
      const mid = Math.exp(-Math.pow(frequency - 0.3, 2) * 10) * 150;

      // High frequencies - softer
      const high = Math.exp(-Math.pow(frequency - 0.7, 2) * 15) * 100;

      // Add some animation with sine waves
      const animation = Math.sin(time * 2 + i * 0.1) * 30 + 30;

      // Combine all components
      const value = bass + mid + high + animation;

      demoData[i] = Math.min(255, Math.max(0, value));
    }

    return demoData;
  }

  /**
   * Generate demo/test time domain data for visualization preview
   * Creates a standard waveform pattern
   */
  generateDemoTimeDomainData(): Uint8Array {
    const demoData = new Uint8Array(this.fftSize);
    const time = Date.now() / 1000;

    // Generate a simple waveform combining multiple frequencies
    for (let i = 0; i < this.fftSize; i++) {
      const t = i / this.fftSize;

      // Combine multiple sine waves to create a more interesting waveform
      const wave1 = Math.sin(t * Math.PI * 4 + time * 2) * 40;
      const wave2 = Math.sin(t * Math.PI * 8 + time * 3) * 20;
      const wave3 = Math.sin(t * Math.PI * 16 + time * 5) * 10;

      // Center at 128 (silence) and add the waves
      const value = 128 + wave1 + wave2 + wave3;

      demoData[i] = Math.min(255, Math.max(0, value));
    }

    return demoData;
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
   * Check if audio enhancement is enabled and doing work
   */
  get isAudioEnhancementActive(): boolean {
    return this.audioEnhancement.enabled
      && (
        this.audioEnhancement.noiseReduction > 0
        || this.audioEnhancement.smartNormalization > 0
        || this.audioEnhancement.saturation > 0
      );
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
