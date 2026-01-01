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
});
