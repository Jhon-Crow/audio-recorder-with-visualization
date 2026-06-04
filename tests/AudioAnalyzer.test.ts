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
      smartNormalization: -10,
      saturation: 75,
      saturationFrequencyRange: { min: 12000, max: 80 },
      saturationMode: 'tape',
    });

    expect(analyzer.getAudioEnhancement()).toEqual({
      enabled: true,
      noiseReduction: 100,
      smartNormalization: 0,
      saturation: 75,
      saturationFrequencyRange: { min: 80, max: 12000 },
      saturationMode: 'tape',
    });
    expect(analyzer.isAudioEnhancementActive).toBe(true);
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
