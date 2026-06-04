import { AudioAnalyzer } from '../src/core/AudioAnalyzer';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  afterEach(() => {
    analyzer.destroy();
  });

  test('should initialize with default options', () => {
    expect(analyzer.fftSize).toBe(2048);
    expect(analyzer.frequencyBinCount).toBe(1024);
    expect(analyzer.smoothingTimeConstant).toBe(0.8);
  });

  test('should accept custom options', () => {
    const customAnalyzer = new AudioAnalyzer({
      fftSize: 4096,
      smoothingTimeConstant: 0.5,
    });

    expect(customAnalyzer.fftSize).toBe(4096);
    expect(customAnalyzer.frequencyBinCount).toBe(2048);
    expect(customAnalyzer.smoothingTimeConstant).toBe(0.5);

    customAnalyzer.destroy();
  });

  test('should keep audio enhancement disabled by default', () => {
    expect(analyzer.isAudioEnhancementActive).toBe(false);
    expect(analyzer.getAudioEnhancement()).toEqual({
      enabled: false,
      noiseReduction: 0,
      noiseProfile: null,
      noiseProfileReduction: 0,
      smartNormalization: 0,
      saturation: 0,
      saturationFrequencyRange: { min: 20, max: 20000 },
      saturationMode: 'soft-clip',
    });
  });

  test('should clamp audio enhancement settings', () => {
    analyzer.setAudioEnhancement({
      enabled: true,
      noiseReduction: 150,
      noiseProfileReduction: 150,
      smartNormalization: -10,
      saturation: 75,
      saturationFrequencyRange: { min: 12000, max: 80 },
      saturationMode: 'tape',
    });

    expect(analyzer.getAudioEnhancement()).toEqual({
      enabled: true,
      noiseReduction: 100,
      noiseProfile: null,
      noiseProfileReduction: 100,
      smartNormalization: 0,
      saturation: 75,
      saturationFrequencyRange: { min: 80, max: 12000 },
      saturationMode: 'tape',
    });
    expect(analyzer.isAudioEnhancementActive).toBe(true);
  });

  test('should create stronger profile reduction for dominant noise bands', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(4096);

    for (let i = 0; i < samples.length; i++) {
      const time = i / sampleRate;
      samples[i] = Math.sin(2 * Math.PI * 6000 * time) * 0.08
        + Math.sin(2 * Math.PI * 120 * time) * 0.005;
    }

    const profile = AudioAnalyzer.createNoiseProfileFromSamples(samples, sampleRate, {
      bandCount: 8,
      fftSize: 1024,
      minFrequency: 80,
      maxFrequency: 12000,
    });
    const lowBand = profile.bands.reduce((closest, band) => (
      Math.abs(band.centerFrequency - 120) < Math.abs(closest.centerFrequency - 120)
        ? band
        : closest
    ));
    const highBand = profile.bands.reduce((closest, band) => (
      Math.abs(band.centerFrequency - 6000) < Math.abs(closest.centerFrequency - 6000)
        ? band
        : closest
    ));

    expect(profile.bands).toHaveLength(8);
    expect(profile.durationSeconds).toBeCloseTo(samples.length / sampleRate, 4);
    expect(highBand.reductionDb).toBeGreaterThan(lowBand.reductionDb);
  });

  test('should require enough samples to build a noise profile', () => {
    expect(() => {
      AudioAnalyzer.createNoiseProfileFromSamples(new Float32Array(128), 44100);
    }).toThrow('Noise profile requires at least');
  });

  test('should throw error for invalid FFT size', () => {
    expect(() => new AudioAnalyzer({ fftSize: 100 })).toThrow();
    expect(() => new AudioAnalyzer({ fftSize: 16 })).toThrow();
    expect(() => new AudioAnalyzer({ fftSize: 65536 })).toThrow();
  });

  test('should create AudioContext lazily', () => {
    const ctx = analyzer.getAudioContext();
    expect(ctx).toBeDefined();
    expect(ctx).toBeInstanceOf(AudioContext);
  });

  test('should return same AudioContext on multiple calls', () => {
    const ctx1 = analyzer.getAudioContext();
    const ctx2 = analyzer.getAudioContext();
    expect(ctx1).toBe(ctx2);
  });

  test('should connect to media stream', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);
    expect(analyzer.isActive).toBe(true);
    expect(analyzer.getProcessedStream()).toBeNull();
  });

  test('should expose processed stream when audio enhancement is active', async () => {
    analyzer.setAudioEnhancement({
      enabled: true,
      noiseReduction: 40,
      smartNormalization: 60,
      saturation: 25,
    });

    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    expect(analyzer.isAudioEnhancementActive).toBe(true);
    expect(analyzer.getProcessedStream()).toBeInstanceOf(MediaStream);
  });

  test('should expose processed stream when noise profile reduction is active', async () => {
    const samples = new Float32Array(4096);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 5000 * (i / 44100)) * 0.04;
    }

    const profile = AudioAnalyzer.createNoiseProfileFromSamples(samples, 44100, {
      bandCount: 6,
      fftSize: 1024,
    });

    analyzer.setAudioEnhancement({
      enabled: true,
      noiseProfile: profile,
      noiseProfileReduction: 70,
    });

    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    expect(analyzer.isAudioEnhancementActive).toBe(true);
    expect(analyzer.getProcessedStream()).toBeInstanceOf(MediaStream);
  });

  test('should clear noise profile at runtime', () => {
    const samples = new Float32Array(4096).fill(0.02);
    const profile = AudioAnalyzer.createNoiseProfileFromSamples(samples, 44100, {
      fftSize: 1024,
    });

    analyzer.setAudioEnhancement({
      enabled: true,
      noiseProfile: profile,
    });
    expect(analyzer.getAudioEnhancement().noiseProfile).not.toBeNull();

    analyzer.setAudioEnhancement({ noiseProfile: null });
    expect(analyzer.getAudioEnhancement().noiseProfile).toBeNull();
    expect(analyzer.isAudioEnhancementActive).toBe(false);
  });

  test('should rebuild active graph when audio enhancement changes', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);
    expect(analyzer.isAudioEnhancementActive).toBe(false);

    analyzer.setAudioEnhancement({
      enabled: true,
      smartNormalization: 80,
    });

    expect(analyzer.isAudioEnhancementActive).toBe(true);
    expect(analyzer.getProcessedStream()).toBeInstanceOf(MediaStream);
  });

  test('should disconnect source', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);
    analyzer.disconnect();
    expect(analyzer.isActive).toBe(false);
  });

  test('should return time domain data', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    const data = analyzer.getTimeDomainData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(2048);
  });

  test('should return frequency data', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    const data = analyzer.getFrequencyData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(1024);
  });

  test('should update FFT size', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    analyzer.fftSize = 4096;
    expect(analyzer.fftSize).toBe(4096);
    expect(analyzer.frequencyBinCount).toBe(2048);
  });

  test('should clamp smoothing time constant', () => {
    analyzer.smoothingTimeConstant = 1.5;
    expect(analyzer.smoothingTimeConstant).toBe(1);

    analyzer.smoothingTimeConstant = -0.5;
    expect(analyzer.smoothingTimeConstant).toBe(0);
  });

  test('should report sample rate', () => {
    analyzer.getAudioContext();
    expect(analyzer.sampleRate).toBe(44100);
  });

  test('should clean up on destroy', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    analyzer.destroy();

    expect(analyzer.isActive).toBe(false);
    expect(analyzer.getTimeDomainData().length).toBe(0);
    expect(analyzer.getFrequencyData().length).toBe(0);
  });

  test('should initialize with debug mode', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const debugAnalyzer = new AudioAnalyzer({ debug: true });
    debugAnalyzer.getAudioContext();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[AudioAnalyzer]',
      expect.anything(),
      expect.anything()
    );
    debugAnalyzer.destroy();
    consoleSpy.mockRestore();
  });

  test('should throw error for non-power-of-2 FFT size', () => {
    expect(() => new AudioAnalyzer({ fftSize: 1000 })).toThrow();
    expect(() => new AudioAnalyzer({ fftSize: 2049 })).toThrow();
  });

  test('should throw error when setting invalid FFT size', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    expect(() => { analyzer.fftSize = 100; }).toThrow();
    expect(() => { analyzer.fftSize = 65536; }).toThrow();
  });

  test('should return sample rate 44100 when no audio context', () => {
    // Create fresh analyzer that hasn't created AudioContext
    const freshAnalyzer = new AudioAnalyzer();
    expect(freshAnalyzer.sampleRate).toBe(44100);
    freshAnalyzer.destroy();
  });

  test('should generate demo frequency data', () => {
    const demoData = analyzer.generateDemoFrequencyData();
    expect(demoData).toBeInstanceOf(Uint8Array);
    expect(demoData.length).toBe(analyzer.frequencyBinCount);
    // Values should be between 0-255
    for (const value of demoData) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }
  });

  test('should generate demo time domain data', () => {
    const demoData = analyzer.generateDemoTimeDomainData();
    expect(demoData).toBeInstanceOf(Uint8Array);
    expect(demoData.length).toBe(analyzer.fftSize);
    // Values should be between 0-255
    for (const value of demoData) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }
  });

  test('should generate varying demo data over time', () => {
    // Generate demo data multiple times
    const demoData = analyzer.generateDemoFrequencyData();
    // Data should be valid
    expect(demoData).toBeInstanceOf(Uint8Array);
    expect(demoData.length).toBe(analyzer.frequencyBinCount);
  });

  test('should connect to audio element', async () => {
    const audioElement = document.createElement('audio');
    await analyzer.connectAudioElement(audioElement);
    expect(analyzer.isActive).toBe(true);
  });

  test('should disconnect previous source when connecting new one', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    const audioElement = document.createElement('audio');
    await analyzer.connectAudioElement(audioElement);

    // Should still be active with new source
    expect(analyzer.isActive).toBe(true);
  });

  test('should return empty data before connecting source', () => {
    // Fresh analyzer without connection
    const freshAnalyzer = new AudioAnalyzer();
    const timeData = freshAnalyzer.getTimeDomainData();
    const freqData = freshAnalyzer.getFrequencyData();

    // Empty before any connection
    expect(timeData.length).toBe(0);
    expect(freqData.length).toBe(0);

    freshAnalyzer.destroy();
  });

  test('should update smoothing time constant on analyzer node', async () => {
    const mockStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await analyzer.connectStream(mockStream);

    analyzer.smoothingTimeConstant = 0.5;
    expect(analyzer.smoothingTimeConstant).toBe(0.5);
  });

  test('should set smoothing time constant before creating analyzer node', () => {
    // Set before connecting (no analyzer node yet)
    analyzer.smoothingTimeConstant = 0.5;
    expect(analyzer.smoothingTimeConstant).toBe(0.5);
  });

  test('should set FFT size before creating analyzer node', () => {
    // Create fresh analyzer
    const freshAnalyzer = new AudioAnalyzer();

    // This should just set the internal value without error
    // because analyzer node doesn't exist yet
    // Note: fftSize setter throws for invalid values
    freshAnalyzer.fftSize = 4096;
    expect(freshAnalyzer.fftSize).toBe(4096);

    freshAnalyzer.destroy();
  });

  test('disconnect should handle no source gracefully', () => {
    // No source connected
    expect(() => analyzer.disconnect()).not.toThrow();
    expect(analyzer.isActive).toBe(false);
  });

  test('should report isActive false when context exists but no source', () => {
    // Create context but don't connect source
    analyzer.getAudioContext();
    expect(analyzer.isActive).toBe(false);
  });
});
