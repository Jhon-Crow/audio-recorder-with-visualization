import {
  AudioEnhancementOptions,
  AudioNoiseProfile,
  AudioNoiseProfileBand,
  AudioNoiseProfileOptions,
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

  private static isValidAnalysisFftSize(size: number): boolean {
    return size >= 512 && size <= 32768 && (size & (size - 1)) === 0;
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

  private normalizeNoiseProfile(
    profile: AudioNoiseProfile | null | undefined
  ): AudioNoiseProfile | null {
    if (!profile || !Array.isArray(profile.bands)) {
      return null;
    }

    const sampleRate = Number.isFinite(profile.sampleRate) && profile.sampleRate > 0
      ? profile.sampleRate
      : 44100;
    const fftSize = this.isValidFftSize(profile.fftSize) ? profile.fftSize : 2048;
    const minFrequency = Number.isFinite(profile.minFrequency)
      ? Math.max(20, profile.minFrequency)
      : 80;
    const maxFrequency = Number.isFinite(profile.maxFrequency)
      ? Math.max(minFrequency + 10, profile.maxFrequency)
      : Math.min(16000, sampleRate / 2);

    const bands: AudioNoiseProfileBand[] = profile.bands
      .map((band) => {
        const lowerFrequency = Number.isFinite(band.lowerFrequency)
          ? Math.max(20, band.lowerFrequency)
          : minFrequency;
        const upperFrequency = Number.isFinite(band.upperFrequency)
          ? Math.max(lowerFrequency + 1, band.upperFrequency)
          : Math.max(lowerFrequency + 1, maxFrequency);
        const centerFrequency = Number.isFinite(band.centerFrequency)
          ? Math.max(lowerFrequency, Math.min(upperFrequency, band.centerFrequency))
          : Math.sqrt(lowerFrequency * upperFrequency);
        const q = Number.isFinite(band.q)
          ? Math.max(0.2, Math.min(24, band.q))
          : Math.max(0.2, centerFrequency / Math.max(1, upperFrequency - lowerFrequency));
        const levelDb = Number.isFinite(band.levelDb) ? band.levelDb : -120;
        const reductionDb = Number.isFinite(band.reductionDb)
          ? Math.max(0, Math.min(36, band.reductionDb))
          : 0;

        return {
          lowerFrequency,
          centerFrequency,
          upperFrequency,
          q,
          levelDb,
          reductionDb,
        };
      })
      .filter((band) => band.centerFrequency > 0);

    if (bands.length === 0) {
      return null;
    }

    return {
      version: 1,
      sampleRate,
      fftSize,
      bandCount: bands.length,
      minFrequency,
      maxFrequency,
      durationSeconds: Number.isFinite(profile.durationSeconds)
        ? Math.max(0, profile.durationSeconds)
        : 0,
      averageLevelDb: Number.isFinite(profile.averageLevelDb)
        ? profile.averageLevelDb
        : -120,
      bands,
    };
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
    const noiseProfile = this.normalizeNoiseProfile(options.noiseProfile);
    const defaultProfileReduction = noiseProfile ? 60 : 0;

    return {
      enabled: options.enabled ?? false,
      noiseReduction: this.clampPercent(options.noiseReduction),
      noiseProfile,
      noiseProfileReduction: this.clampPercent(
        options.noiseProfileReduction ?? defaultProfileReduction
      ),
      smartNormalization: this.clampPercent(options.smartNormalization),
      saturation: this.clampPercent(options.saturation),
      saturationFrequencyRange: { min, max },
      saturationMode: this.isSaturationMode(options.saturationMode)
        ? options.saturationMode
        : 'soft-clip',
    };
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private static toDb(value: number): number {
    return 20 * Math.log10(Math.max(value, 1e-12));
  }

  private static runFft(real: Float64Array, imag: Float64Array): void {
    const n = real.length;
    let j = 0;

    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;

      if (i < j) {
        const realTemp = real[i];
        real[i] = real[j];
        real[j] = realTemp;

        const imagTemp = imag[i];
        imag[i] = imag[j];
        imag[j] = imagTemp;
      }
    }

    for (let length = 2; length <= n; length <<= 1) {
      const angle = -2 * Math.PI / length;
      const wLengthReal = Math.cos(angle);
      const wLengthImag = Math.sin(angle);

      for (let i = 0; i < n; i += length) {
        let wReal = 1;
        let wImag = 0;
        const halfLength = length >> 1;

        for (let k = 0; k < halfLength; k++) {
          const evenIndex = i + k;
          const oddIndex = evenIndex + halfLength;
          const oddReal = real[oddIndex] * wReal - imag[oddIndex] * wImag;
          const oddImag = real[oddIndex] * wImag + imag[oddIndex] * wReal;

          real[oddIndex] = real[evenIndex] - oddReal;
          imag[oddIndex] = imag[evenIndex] - oddImag;
          real[evenIndex] += oddReal;
          imag[evenIndex] += oddImag;

          const nextWReal = wReal * wLengthReal - wImag * wLengthImag;
          wImag = wReal * wLengthImag + wImag * wLengthReal;
          wReal = nextWReal;
        }
      }
    }
  }

  /**
   * Analyze a decoded AudioBuffer containing only microphone/background noise.
   */
  static createNoiseProfileFromAudioBuffer(
    audioBuffer: AudioBuffer,
    options: AudioNoiseProfileOptions = {}
  ): AudioNoiseProfile {
    if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
      throw new Error('Noise profile audio buffer must contain audio samples');
    }

    const sampleCount = audioBuffer.length;
    const monoSamples = new Float32Array(sampleCount);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < sampleCount; i++) {
        monoSamples[i] += channelData[i] / audioBuffer.numberOfChannels;
      }
    }

    return AudioAnalyzer.createNoiseProfileFromSamples(
      monoSamples,
      audioBuffer.sampleRate,
      options
    );
  }

  /**
   * Analyze noise-only PCM samples and produce a reusable frequency profile.
   */
  static createNoiseProfileFromSamples(
    samples: ArrayLike<number>,
    sampleRate: number,
    options: AudioNoiseProfileOptions = {}
  ): AudioNoiseProfile {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error('Noise profile sample rate must be a positive number');
    }

    const fftSize = AudioAnalyzer.isValidAnalysisFftSize(options.fftSize ?? 2048)
      ? options.fftSize ?? 2048
      : 2048;

    if (!samples || samples.length < fftSize) {
      throw new Error(`Noise profile requires at least ${fftSize} samples`);
    }

    const nyquist = sampleRate / 2;
    const bandCount = Math.round(AudioAnalyzer.clamp(options.bandCount ?? 12, 4, 32));
    const requestedMin = Number.isFinite(options.minFrequency)
      ? options.minFrequency ?? 80
      : 80;
    const requestedMax = Number.isFinite(options.maxFrequency)
      ? options.maxFrequency ?? Math.min(16000, nyquist * 0.95)
      : Math.min(16000, nyquist * 0.95);
    const minFrequency = AudioAnalyzer.clamp(
      Math.min(requestedMin, requestedMax),
      20,
      Math.max(20, nyquist - 20)
    );
    const maxFrequency = AudioAnalyzer.clamp(
      Math.max(requestedMin, requestedMax),
      minFrequency + 10,
      Math.max(minFrequency + 10, nyquist - 10)
    );
    const maxDurationSeconds = Number.isFinite(options.maxDurationSeconds)
      ? Math.max(0.1, options.maxDurationSeconds ?? 30)
      : 30;
    const sampleCount = Math.min(
      samples.length,
      Math.max(fftSize, Math.floor(maxDurationSeconds * sampleRate))
    );
    const hopSize = fftSize / 2;
    const frameCount = Math.max(1, Math.floor((sampleCount - fftSize) / hopSize) + 1);
    const minReductionDb = AudioAnalyzer.clamp(options.minReductionDb ?? 1.5, 0, 24);
    const maxReductionDb = AudioAnalyzer.clamp(
      options.maxReductionDb ?? 18,
      minReductionDb,
      36
    );

    const logMin = Math.log(minFrequency);
    const logMax = Math.log(maxFrequency);
    const bandEdges: number[] = [];
    const bands: AudioNoiseProfileBand[] = [];

    for (let i = 0; i <= bandCount; i++) {
      bandEdges.push(Math.exp(logMin + (i / bandCount) * (logMax - logMin)));
    }

    for (let i = 0; i < bandCount; i++) {
      const lowerFrequency = bandEdges[i];
      const upperFrequency = bandEdges[i + 1];
      const centerFrequency = Math.sqrt(lowerFrequency * upperFrequency);

      bands.push({
        lowerFrequency,
        centerFrequency,
        upperFrequency,
        q: Math.max(0.2, centerFrequency / Math.max(1, upperFrequency - lowerFrequency)),
        levelDb: -120,
        reductionDb: 0,
      });
    }

    const binToBand = new Int16Array(fftSize / 2 + 1);
    binToBand.fill(-1);
    for (let bin = 1; bin < binToBand.length; bin++) {
      const frequency = bin * sampleRate / fftSize;
      for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
        const band = bands[bandIndex];
        if (frequency >= band.lowerFrequency && frequency < band.upperFrequency) {
          binToBand[bin] = bandIndex;
          break;
        }
      }
    }

    const window = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
    }

    const bandPower = new Float64Array(bandCount);
    const bandHits = new Uint32Array(bandCount);
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);
    let rmsSum = 0;

    for (let i = 0; i < sampleCount; i++) {
      const sample = Number.isFinite(samples[i]) ? samples[i] : 0;
      rmsSum += sample * sample;
    }

    for (let frame = 0; frame < frameCount; frame++) {
      const offset = frame * hopSize;

      for (let i = 0; i < fftSize; i++) {
        const sample = Number.isFinite(samples[offset + i]) ? samples[offset + i] : 0;
        real[i] = sample * window[i];
        imag[i] = 0;
      }

      AudioAnalyzer.runFft(real, imag);

      for (let bin = 1; bin < binToBand.length; bin++) {
        const bandIndex = binToBand[bin];
        if (bandIndex < 0) {
          continue;
        }

        const power = real[bin] * real[bin] + imag[bin] * imag[bin];
        bandPower[bandIndex] += power;
        bandHits[bandIndex]++;
      }
    }

    const bandMagnitudes = Array.from(bandPower, (power, index) => {
      const hits = bandHits[index] || 1;
      return Math.sqrt(power / hits) / fftSize;
    });
    const maxMagnitude = Math.max(...bandMagnitudes, 1e-12);

    for (let i = 0; i < bands.length; i++) {
      const magnitude = bandMagnitudes[i];
      const relative = magnitude / maxMagnitude;
      const profileWeight = relative <= 0.03 ? 0 : Math.pow(relative, 0.65);

      bands[i] = {
        ...bands[i],
        levelDb: AudioAnalyzer.toDb(magnitude),
        reductionDb: profileWeight === 0
          ? 0
          : minReductionDb + (maxReductionDb - minReductionDb) * profileWeight,
      };
    }

    return {
      version: 1,
      sampleRate,
      fftSize,
      bandCount,
      minFrequency,
      maxFrequency,
      durationSeconds: sampleCount / sampleRate,
      averageLevelDb: AudioAnalyzer.toDb(Math.sqrt(rmsSum / sampleCount)),
      bands,
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

  private applyNoiseProfileReduction(ctx: AudioContext, input: AudioNode): AudioNode {
    const profile = this.audioEnhancement.noiseProfile;
    const amount = this.audioEnhancement.noiseProfileReduction;

    if (!profile || amount <= 0) {
      return input;
    }

    const strength = amount / 100;
    const nyquist = ctx.sampleRate / 2;
    let current = input;

    for (const band of profile.bands) {
      const centerFrequency = Math.max(20, Math.min(band.centerFrequency, nyquist - 10));
      const reductionDb = Math.min(24, Math.max(0, band.reductionDb)) * strength;

      if (reductionDb < 0.25 || centerFrequency >= nyquist) {
        continue;
      }

      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = centerFrequency;
      filter.Q.value = Math.max(0.2, Math.min(12, band.q));
      filter.gain.value = -reductionDb;

      current.connect(filter);
      current = filter;
      this.graphNodes.push(filter);
    }

    return current;
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
    current = this.applyNoiseProfileReduction(ctx, current);
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
      noiseProfile: this.audioEnhancement.noiseProfile
        ? {
            ...this.audioEnhancement.noiseProfile,
            bands: this.audioEnhancement.noiseProfile.bands.map((band) => ({ ...band })),
          }
        : null,
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
        || (
          this.audioEnhancement.noiseProfile !== null
          && this.audioEnhancement.noiseProfileReduction > 0
        )
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
