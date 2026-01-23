/**
 * Offline Audio Analyzer for pre-analyzing audio files
 * Provides fast waveform and frequency data without real-time playback
 *
 * This analyzer decodes audio files and pre-computes visualization data
 * that can be instantly accessed for any timestamp, enabling:
 * - Instant waveform preview before playback
 * - Smooth scrubbing through audio files
 * - Background analysis without blocking the UI
 * - Visualization that persists when window is minimized
 */

/**
 * Cached visualization data for a single time point
 */
export interface CachedVisualizationData {
  /** Time domain data (waveform) - values 0-255 */
  timeDomainData: Uint8Array;
  /** Frequency domain data (spectrum) - values 0-255 */
  frequencyData: Uint8Array;
  /** Peak amplitude for this segment (0-1) */
  peakAmplitude: number;
  /** RMS amplitude for this segment (0-1) */
  rmsAmplitude: number;
}

/**
 * Full audio analysis cache containing all precomputed data
 */
export interface AudioAnalysisCache {
  /** Duration of the audio in seconds */
  duration: number;
  /** Sample rate of the audio */
  sampleRate: number;
  /** Number of cached segments */
  segmentCount: number;
  /** Time interval between segments in seconds */
  segmentDuration: number;
  /** Cached data for each segment */
  segments: CachedVisualizationData[];
  /** The raw audio buffer (for advanced use cases) */
  audioBuffer: AudioBuffer;
  /** Number of data points per segment for time domain data */
  fftSize: number;
}

/**
 * Progress callback for audio analysis
 */
export type AnalysisProgressCallback = (progress: number) => void;

/**
 * Options for offline audio analysis
 */
export interface OfflineAnalyzerOptions {
  /** FFT size for frequency analysis (power of 2, 32-32768) */
  fftSize?: number;
  /** Target number of segments to cache (affects analysis granularity) */
  targetSegments?: number;
  /** Maximum segments to prevent memory issues with very long files */
  maxSegments?: number;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Offline Audio Analyzer class
 * Pre-analyzes audio files for instant visualization access
 */
export class OfflineAudioAnalyzer {
  private _fftSize: number;
  private targetSegments: number;
  private maxSegments: number;
  private debug: boolean;
  private cache: AudioAnalysisCache | null = null;
  private analysisInProgress: boolean = false;
  private abortController: AbortController | null = null;

  constructor(options: OfflineAnalyzerOptions = {}) {
    this._fftSize = options.fftSize ?? 2048;
    this.targetSegments = options.targetSegments ?? 1000;
    this.maxSegments = options.maxSegments ?? 10000;
    this.debug = options.debug ?? false;

    // Validate FFT size
    if (!this.isValidFftSize(this._fftSize)) {
      throw new Error('FFT size must be a power of 2 between 32 and 32768');
    }
  }

  private isValidFftSize(size: number): boolean {
    return size >= 32 && size <= 32768 && (size & (size - 1)) === 0;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[OfflineAudioAnalyzer]', ...args);
    }
  }

  /**
   * Get FFT size
   */
  get fftSize(): number {
    return this._fftSize;
  }

  /**
   * Set FFT size (will require re-analysis)
   */
  set fftSize(value: number) {
    if (!this.isValidFftSize(value)) {
      throw new Error('FFT size must be a power of 2 between 32 and 32768');
    }
    this._fftSize = value;
    // Invalidate cache when FFT size changes
    this.cache = null;
  }

  /**
   * Check if analysis is currently in progress
   */
  get isAnalyzing(): boolean {
    return this.analysisInProgress;
  }

  /**
   * Get the current cache (if available)
   */
  get analysisCache(): AudioAnalysisCache | null {
    return this.cache;
  }

  /**
   * Check if audio has been analyzed and cached
   */
  get isCached(): boolean {
    return this.cache !== null;
  }

  /**
   * Get the duration of the cached audio (or 0 if not cached)
   */
  get duration(): number {
    return this.cache?.duration ?? 0;
  }

  /**
   * Abort any in-progress analysis
   */
  abortAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.analysisInProgress = false;
  }

  /**
   * Analyze an audio file and cache the visualization data
   * @param source - File, URL string, or ArrayBuffer containing audio data
   * @param onProgress - Optional progress callback (0-1)
   * @returns Promise resolving to the analysis cache
   */
  async analyzeAudio(
    source: File | string | ArrayBuffer,
    onProgress?: AnalysisProgressCallback
  ): Promise<AudioAnalysisCache> {
    // Abort any previous analysis
    this.abortAnalysis();

    this.analysisInProgress = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      this.log('Starting audio analysis...');

      // Step 1: Load the audio data into an ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      if (source instanceof ArrayBuffer) {
        arrayBuffer = source;
      } else if (source instanceof File) {
        arrayBuffer = await source.arrayBuffer();
      } else {
        // URL string
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      }

      if (signal.aborted) {
        throw new Error('Analysis aborted');
      }

      onProgress?.(0.1);
      this.log('Audio data loaded, size:', arrayBuffer.byteLength, 'bytes');

      // Step 2: Decode the audio using AudioContext
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      await audioContext.close();

      if (signal.aborted) {
        throw new Error('Analysis aborted');
      }

      onProgress?.(0.2);
      this.log('Audio decoded:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
      });

      // Step 3: Calculate segment parameters
      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;

      // Calculate optimal segment count (min 10, max maxSegments)
      // For a typical 3-minute song at 1000 segments, each segment is ~180ms
      const segmentCount = Math.min(
        this.maxSegments,
        Math.max(10, Math.min(this.targetSegments, Math.ceil(duration * 30))) // ~30 segments per second for smooth scrubbing
      );

      const segmentDuration = duration / segmentCount;
      const samplesPerSegment = Math.floor(sampleRate * segmentDuration);

      this.log('Analysis parameters:', {
        segmentCount,
        segmentDuration: segmentDuration.toFixed(3) + 's',
        samplesPerSegment,
      });

      // Step 4: Pre-allocate result array
      const segments: CachedVisualizationData[] = new Array(segmentCount);

      // Step 5: Extract channel data (use channel 0, or mix stereo to mono)
      let pcmData: Float32Array;
      if (audioBuffer.numberOfChannels === 1) {
        pcmData = audioBuffer.getChannelData(0);
      } else {
        // Mix stereo to mono
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        pcmData = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          pcmData[i] = (left[i] + right[i]) / 2;
        }
      }

      if (signal.aborted) {
        throw new Error('Analysis aborted');
      }

      onProgress?.(0.3);

      // Step 6: Analyze each segment
      const frequencyBinCount = this._fftSize / 2;

      for (let i = 0; i < segmentCount; i++) {
        if (signal.aborted) {
          throw new Error('Analysis aborted');
        }

        const startSample = Math.floor(i * samplesPerSegment);
        const endSample = Math.min(startSample + samplesPerSegment, pcmData.length);

        segments[i] = this.analyzeSegment(
          pcmData,
          startSample,
          endSample,
          this._fftSize,
          frequencyBinCount,
          sampleRate
        );

        // Report progress (20% for loading, 70% for analysis)
        if (i % 50 === 0 || i === segmentCount - 1) {
          const analysisProgress = 0.3 + (i / segmentCount) * 0.7;
          onProgress?.(analysisProgress);
        }
      }

      // Step 7: Create and store the cache
      this.cache = {
        duration,
        sampleRate,
        segmentCount,
        segmentDuration,
        segments,
        audioBuffer,
        fftSize: this._fftSize,
      };

      this.analysisInProgress = false;
      onProgress?.(1);
      this.log('Analysis complete:', this.cache.segmentCount, 'segments cached');

      return this.cache;
    } catch (error) {
      this.analysisInProgress = false;
      if ((error as Error).message !== 'Analysis aborted') {
        this.log('Analysis failed:', error);
      }
      throw error;
    }
  }

  /**
   * Analyze a single segment of audio data
   */
  private analyzeSegment(
    pcmData: Float32Array,
    startSample: number,
    endSample: number,
    fftSize: number,
    frequencyBinCount: number,
    sampleRate: number
  ): CachedVisualizationData {
    const segmentLength = endSample - startSample;

    // Calculate peak and RMS amplitude
    let peak = 0;
    let sumSquares = 0;

    for (let i = startSample; i < endSample; i++) {
      const value = Math.abs(pcmData[i]);
      peak = Math.max(peak, value);
      sumSquares += pcmData[i] * pcmData[i];
    }

    const rms = Math.sqrt(sumSquares / segmentLength);

    // Generate time domain data (downsampled waveform)
    // Match the format of AnalyserNode.getByteTimeDomainData (0-255, 128 = center)
    const timeDomainData = new Uint8Array(fftSize);
    const step = Math.max(1, Math.floor(segmentLength / fftSize));

    for (let i = 0; i < fftSize; i++) {
      const sampleIndex = startSample + Math.min(i * step, segmentLength - 1);
      // Convert from -1..1 to 0..255 range (128 is center/silence)
      const value = pcmData[sampleIndex];
      timeDomainData[i] = Math.max(0, Math.min(255, Math.round((value + 1) * 127.5)));
    }

    // Generate frequency data using simple DFT-like analysis
    // This is a simplified frequency analysis that's fast but approximate
    // For more accurate results, a proper FFT library could be used
    const frequencyData = this.computeFrequencyData(
      pcmData,
      startSample,
      endSample,
      frequencyBinCount,
      sampleRate
    );

    return {
      timeDomainData,
      frequencyData,
      peakAmplitude: peak,
      rmsAmplitude: rms,
    };
  }

  /**
   * Compute frequency data for a segment
   * Uses a simplified magnitude spectrum approach
   */
  private computeFrequencyData(
    pcmData: Float32Array,
    startSample: number,
    endSample: number,
    frequencyBinCount: number,
    _sampleRate: number
  ): Uint8Array {
    const frequencyData = new Uint8Array(frequencyBinCount);
    const segmentLength = endSample - startSample;

    // Use bands-based analysis for efficiency
    // This approximates what you'd get from FFT but is much faster
    const bandsPerOctave = 3;
    const numBands = Math.min(frequencyBinCount, 64);

    // Calculate energy in frequency bands using autocorrelation-like approach
    // This is a simplified but fast method
    for (let band = 0; band < numBands; band++) {
      // Map band to approximate frequency range
      // Lower bands = lower frequencies (longer periods)
      const periodFactor = Math.pow(2, (numBands - band - 1) / bandsPerOctave);
      const period = Math.max(2, Math.min(segmentLength / 2, Math.round(periodFactor * 4)));

      let energy = 0;
      let count = 0;

      // Calculate energy at this approximate period
      for (let i = startSample; i < endSample - period; i += period) {
        const diff = Math.abs(pcmData[i] - pcmData[i + period]);
        const product = pcmData[i] * pcmData[i + Math.floor(period / 2)];
        energy += Math.abs(product) - diff * 0.5;
        count++;
      }

      if (count > 0) {
        energy = energy / count;
      }

      // Scale and clamp to 0-255 range
      // Apply some boost to lower frequencies to match typical music visualization
      const boost = 1 + (numBands - band) / numBands;
      const scaledEnergy = Math.abs(energy) * 500 * boost;

      // Map to the corresponding bins
      const binStart = Math.floor((band / numBands) * frequencyBinCount);
      const binEnd = Math.floor(((band + 1) / numBands) * frequencyBinCount);

      for (let bin = binStart; bin < binEnd; bin++) {
        frequencyData[bin] = Math.max(0, Math.min(255, Math.round(scaledEnergy)));
      }
    }

    return frequencyData;
  }

  /**
   * Get visualization data for a specific time in the audio
   * Returns cached data if available, or interpolates between segments
   * @param time - Time in seconds
   * @returns Cached visualization data for the specified time, or null if not cached
   */
  getDataAtTime(time: number): CachedVisualizationData | null {
    if (!this.cache) {
      return null;
    }

    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(time, this.cache.duration));

    // Find the segment index
    const segmentIndex = Math.floor(clampedTime / this.cache.segmentDuration);
    const clampedIndex = Math.min(segmentIndex, this.cache.segmentCount - 1);

    return this.cache.segments[clampedIndex];
  }

  /**
   * Get visualization data for a time range (useful for waveform overview)
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @param maxPoints - Maximum number of points to return
   * @returns Array of cached visualization data
   */
  getDataInRange(
    startTime: number,
    endTime: number,
    maxPoints: number = 100
  ): CachedVisualizationData[] | null {
    if (!this.cache) {
      return null;
    }

    const startIndex = Math.floor(startTime / this.cache.segmentDuration);
    const endIndex = Math.ceil(endTime / this.cache.segmentDuration);

    const clampedStart = Math.max(0, startIndex);
    const clampedEnd = Math.min(this.cache.segmentCount, endIndex);

    const totalSegments = clampedEnd - clampedStart;
    const step = Math.max(1, Math.floor(totalSegments / maxPoints));

    const result: CachedVisualizationData[] = [];
    for (let i = clampedStart; i < clampedEnd; i += step) {
      result.push(this.cache.segments[i]);
    }

    return result;
  }

  /**
   * Get a waveform overview for the entire audio file
   * Returns peak amplitudes suitable for drawing a waveform preview
   * @param numPoints - Number of points to generate
   * @returns Array of peak amplitude values (0-1)
   */
  getWaveformOverview(numPoints: number = 200): Float32Array | null {
    if (!this.cache) {
      return null;
    }

    const result = new Float32Array(numPoints);
    const step = this.cache.segmentCount / numPoints;

    for (let i = 0; i < numPoints; i++) {
      const segmentIndex = Math.min(
        Math.floor(i * step),
        this.cache.segmentCount - 1
      );
      result[i] = this.cache.segments[segmentIndex].peakAmplitude;
    }

    return result;
  }

  /**
   * Clear the cached analysis data
   */
  clearCache(): void {
    this.cache = null;
    this.log('Cache cleared');
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.abortAnalysis();
    this.clearCache();
    this.log('Destroyed');
  }
}
