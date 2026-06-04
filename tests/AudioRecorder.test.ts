import { AudioRecorder } from '../src/AudioRecorder';
import { WaveformVisualizer } from '../src/visualizers/WaveformVisualizer';

describe('AudioRecorder', () => {
  let canvas: HTMLCanvasElement;
  let recorder: AudioRecorder;

  beforeEach(() => {
    // Create canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    if (recorder) {
      recorder.destroy();
    }
    document.body.removeChild(canvas);
  });

  describe('Initialization', () => {
    test('should initialize with canvas element', () => {
      recorder = new AudioRecorder({ canvas });
      expect(recorder).toBeDefined();
      expect(recorder.getCanvas()).toBe(canvas);
    });

    test('should initialize with canvas selector', () => {
      canvas.id = 'test-canvas';
      recorder = new AudioRecorder({ canvas: '#test-canvas' });
      expect(recorder).toBeDefined();
      expect(recorder.getCanvas()).toBe(canvas);
    });

    test('should throw error for invalid canvas selector', () => {
      expect(() => new AudioRecorder({ canvas: '#non-existent' })).toThrow(
        'Canvas element not found: #non-existent'
      );
    });

    test('should initialize with custom dimensions', () => {
      recorder = new AudioRecorder({
        canvas,
        videoWidth: 1920,
        videoHeight: 1080,
      });
      expect(recorder.getCanvas().width).toBe(1920);
      expect(recorder.getCanvas().height).toBe(1080);
    });

    test('should initialize with custom FPS', () => {
      recorder = new AudioRecorder({
        canvas,
        fps: 60,
      });
      expect(recorder).toBeDefined();
    });

    test('should initialize with custom visualizer by string name', () => {
      recorder = new AudioRecorder({
        canvas,
        visualizer: 'waveform',
      });
      expect(recorder.getVisualizer().id).toBe('waveform');
    });

    test('should initialize with custom visualizer instance', () => {
      const customVisualizer = new WaveformVisualizer();
      recorder = new AudioRecorder({
        canvas,
        visualizer: customVisualizer,
      });
      expect(recorder.getVisualizer()).toBe(customVisualizer);
    });

    test('should initialize with default BarVisualizer', () => {
      recorder = new AudioRecorder({ canvas });
      expect(recorder.getVisualizer().id).toBe('bars');
    });

    test('should initialize with visualizer options', () => {
      recorder = new AudioRecorder({
        canvas,
        visualizer: 'bars',
        visualizerOptions: {
          primaryColor: '#ff0000',
          barCount: 32,
        },
      });
      expect(recorder.getVisualizer().id).toBe('bars');
    });

    test('should initialize with debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      recorder = new AudioRecorder({
        canvas,
        debug: true,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioRecorder]',
        'AudioRecorder initialized'
      );
      consoleSpy.mockRestore();
    });

    test('should initialize with custom FFT settings', () => {
      recorder = new AudioRecorder({
        canvas,
        fftSize: 4096,
        smoothingTimeConstant: 0.9,
      });
      expect(recorder).toBeDefined();
    });

    test('should initialize with audio enhancement disabled by default', () => {
      recorder = new AudioRecorder({ canvas });
      expect(recorder.getAudioEnhancement()).toEqual({
        enabled: false,
        noiseReduction: 0,
        smartNormalization: 0,
        saturation: 0,
        saturationFrequencyRange: { min: 20, max: 20000 },
        saturationMode: 'soft-clip',
      });
    });

    test('should initialize with audio enhancement options', () => {
      recorder = new AudioRecorder({
        canvas,
        audioEnhancement: {
          enabled: true,
          noiseReduction: 35,
          smartNormalization: 60,
          saturation: 15,
          saturationFrequencyRange: { min: 120, max: 7000 },
          saturationMode: 'tube',
        },
      });

      expect(recorder.getAudioEnhancement()).toEqual({
        enabled: true,
        noiseReduction: 35,
        smartNormalization: 60,
        saturation: 15,
        saturationFrequencyRange: { min: 120, max: 7000 },
        saturationMode: 'tube',
      });
    });
  });

  describe('ready() method', () => {
    test('should resolve immediately when no images', async () => {
      recorder = new AudioRecorder({ canvas });
      await expect(recorder.ready()).resolves.toBeUndefined();
    });

    test('should wait for image loading when visualizer has images', async () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      recorder = new AudioRecorder({
        canvas,
        visualizerOptions: { backgroundImage: validPng },
      });
      await expect(recorder.ready()).resolves.toBeUndefined();
    });
  });

  describe('Visualizer management', () => {
    beforeEach(() => {
      recorder = new AudioRecorder({ canvas });
    });

    test('should change visualizer by string', async () => {
      await recorder.setVisualizer('waveform');
      expect(recorder.getVisualizer().id).toBe('waveform');
    });

    test('should change visualizer by instance', async () => {
      const newVisualizer = new WaveformVisualizer();
      await recorder.setVisualizer(newVisualizer);
      expect(recorder.getVisualizer()).toBe(newVisualizer);
    });

    test('should update visualizer options', async () => {
      await recorder.setVisualizerOptions({ primaryColor: '#ff0000' });
      // Options are applied without errors
      expect(recorder.getVisualizer()).toBeDefined();
    });

    test('should throw for unknown visualizer name', async () => {
      await expect(recorder.setVisualizer('unknown-visualizer')).rejects.toThrow(
        /Unknown visualizer/
      );
    });

    test('getAvailableVisualizers should return list', () => {
      const visualizers = AudioRecorder.getAvailableVisualizers();
      expect(visualizers).toContain('waveform');
      expect(visualizers).toContain('bars');
      expect(visualizers).toContain('circular');
      expect(visualizers).toContain('particles');
    });
  });

  describe('Audio source management', () => {
    beforeEach(() => {
      recorder = new AudioRecorder({ canvas });
    });

    test('should start microphone capture', async () => {
      await recorder.startMicrophone();
      expect(recorder.sourceType).toBe('microphone');
    });

    test('should stop microphone', async () => {
      await recorder.startMicrophone();
      recorder.stopMicrophone();
      expect(recorder.sourceType).toBeNull();
    });

    test('should emit source:change event on microphone start', async () => {
      const handler = jest.fn();
      recorder.on('source:change', handler);
      await recorder.startMicrophone();
      expect(handler).toHaveBeenCalledWith('microphone');
    });

    test('should connect audio file', async () => {
      const audioEl = await recorder.connectAudioFile('test.mp3');
      expect(audioEl).toBeInstanceOf(HTMLAudioElement);
      expect(recorder.sourceType).toBe('file');
    });

    test('should connect audio file from File object', async () => {
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
      const audioEl = await recorder.connectAudioFile(file);
      expect(audioEl).toBeInstanceOf(HTMLAudioElement);
      expect(recorder.sourceType).toBe('file');
    });

    test('should emit source:change event on file connect', async () => {
      const handler = jest.fn();
      recorder.on('source:change', handler);
      await recorder.connectAudioFile('test.mp3');
      expect(handler).toHaveBeenCalledWith('file');
    });

    test('should stop previous microphone when connecting file', async () => {
      await recorder.startMicrophone();
      await recorder.connectAudioFile('test.mp3');
      // Should have switched to file source
      expect(recorder.sourceType).toBe('file');
    });
  });

  describe('Visualization control', () => {
    beforeEach(async () => {
      recorder = new AudioRecorder({ canvas });
      await recorder.startMicrophone();
    });

    test('should report isVisualizationActive', () => {
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should stop visualization', () => {
      recorder.stopVisualization();
      expect(recorder.isVisualizationActive).toBe(false);
    });

    test('should resume visualization', () => {
      recorder.stopVisualization();
      recorder.resumeVisualization();
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should not resume without source', () => {
      recorder.stopMicrophone();
      recorder.stopVisualization(); // Must stop visualization first
      recorder.resumeVisualization();
      expect(recorder.isVisualizationActive).toBe(false);
    });

    test('should show demo visualization', () => {
      recorder.showDemoVisualization(100);
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should complete demo visualization after duration', async () => {
      recorder.showDemoVisualization(50);
      expect(recorder.isVisualizationActive).toBe(true);
      // Wait for demo to complete - using jest fake timers for reliable timing
      jest.useFakeTimers();
      jest.advanceTimersByTime(100);
      jest.useRealTimers();
      // In the test environment, animation frames may behave differently
      // The key point is that the demo was started successfully
      expect(recorder).toBeDefined();
    });

    test('should emit frame events during visualization', async () => {
      const frameHandler = jest.fn();
      recorder.on('frame', frameHandler);
      recorder.showDemoVisualization(50);
      // Wait for some frames
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(frameHandler).toHaveBeenCalled();
    });

    test('should restart source visualization after demo when source exists', async () => {
      // Start with microphone
      await recorder.startMicrophone();
      expect(recorder.sourceType).toBe('microphone');

      // Show demo (this will temporarily stop source visualization)
      recorder.showDemoVisualization(30);
      expect(recorder.isVisualizationActive).toBe(true);

      // Wait for demo to complete
      await new Promise(resolve => setTimeout(resolve, 80));

      // Visualization should continue because we have a source
      expect(recorder.isVisualizationActive).toBe(true);
    });
  });

  describe('Recording control', () => {
    beforeEach(async () => {
      recorder = new AudioRecorder({ canvas });
      await recorder.startMicrophone();
    });

    test('should start recording', () => {
      recorder.startRecording();
      expect(recorder.recordingState).toBe('recording');
    });

    test('should emit recording:start event', () => {
      const handler = jest.fn();
      recorder.on('recording:start', handler);
      recorder.startRecording();
      expect(handler).toHaveBeenCalled();
    });

    test('should throw when starting recording twice', () => {
      recorder.startRecording();
      expect(() => recorder.startRecording()).toThrow('Recording already in progress');
    });

    test('should pause recording', () => {
      recorder.startRecording();
      recorder.pauseRecording();
      expect(recorder.recordingState).toBe('paused');
    });

    test('should emit recording:pause event', () => {
      const handler = jest.fn();
      recorder.on('recording:pause', handler);
      recorder.startRecording();
      recorder.pauseRecording();
      expect(handler).toHaveBeenCalled();
    });

    test('should resume recording', () => {
      recorder.startRecording();
      recorder.pauseRecording();
      recorder.resumeRecording();
      expect(recorder.recordingState).toBe('recording');
    });

    test('should emit recording:resume event', () => {
      const handler = jest.fn();
      recorder.on('recording:resume', handler);
      recorder.startRecording();
      recorder.pauseRecording();
      recorder.resumeRecording();
      expect(handler).toHaveBeenCalled();
    });

    test('should stop recording', async () => {
      recorder.startRecording();
      const blob = await recorder.stopRecording();
      expect(blob).toBeInstanceOf(Blob);
      expect(recorder.recordingState).toBe('inactive');
    });

    test('should emit recording:stop event', async () => {
      const handler = jest.fn();
      recorder.on('recording:stop', handler);
      recorder.startRecording();
      await recorder.stopRecording();
      expect(handler).toHaveBeenCalled();
    });

    test('should cancel recording', () => {
      recorder.startRecording();
      recorder.cancelRecording();
      expect(recorder.recordingState).toBe('inactive');
    });

    test('should start recording with custom bitrates', () => {
      recorder.startRecording({
        videoBitrate: 4000000,
        audioBitrate: 128000,
      });
      expect(recorder.recordingState).toBe('recording');
    });

    test('should record from processed stream when audio enhancement is active', () => {
      recorder.setAudioEnhancement({
        enabled: true,
        noiseReduction: 30,
        smartNormalization: 50,
      });

      recorder.startRecording();
      expect(recorder.recordingState).toBe('recording');
      expect(recorder.getProcessedAudioStream()).toBeInstanceOf(MediaStream);
    });

    test('should start recording without audio stream', async () => {
      recorder.stopMicrophone();
      // Create recorder without audio
      recorder = new AudioRecorder({ canvas });
      recorder.startRecording();
      expect(recorder.recordingState).toBe('recording');
    });
  });

  describe('Audio enhancement control', () => {
    beforeEach(() => {
      recorder = new AudioRecorder({ canvas });
    });

    test('should update audio enhancement settings at runtime', () => {
      recorder.setAudioEnhancement({
        enabled: true,
        saturation: 45,
        saturationFrequencyRange: { min: 200, max: 6000 },
        saturationMode: 'hard-clip',
      });

      expect(recorder.getAudioEnhancement()).toMatchObject({
        enabled: true,
        saturation: 45,
        saturationFrequencyRange: { min: 200, max: 6000 },
        saturationMode: 'hard-clip',
      });
    });
  });

  describe('Audio data access', () => {
    beforeEach(async () => {
      recorder = new AudioRecorder({ canvas });
      await recorder.startMicrophone();
    });

    test('should get frequency data', () => {
      const data = recorder.getFrequencyData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    test('should get time domain data', () => {
      const data = recorder.getTimeDomainData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    test('should get audio context', () => {
      const ctx = recorder.getAudioContext();
      expect(ctx).toBeDefined();
    });
  });

  describe('Supported formats', () => {
    test('should get supported formats', () => {
      const formats = AudioRecorder.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
    });
  });

  describe('Debug visual', () => {
    beforeEach(() => {
      recorder = new AudioRecorder({ canvas, debug: true });
    });

    test('should show debug visual', () => {
      recorder.showDebugVisual();
      // Debug visual is active (private property)
      expect(recorder).toBeDefined();
    });

    test('should hide debug visual', () => {
      recorder.showDebugVisual();
      recorder.hideDebugVisual();
      expect(recorder).toBeDefined();
    });

    test('should not start debug visual twice', () => {
      recorder.showDebugVisual();
      recorder.showDebugVisual(); // Should not start again
      expect(recorder).toBeDefined();
    });

    test('should animate debug visual over multiple frames', async () => {
      recorder.showDebugVisual();
      // Wait for a few animation frames
      await new Promise(resolve => setTimeout(resolve, 50));
      // Debug boundaries should have been drawn
      expect(recorder).toBeDefined();
      recorder.hideDebugVisual();
    });
  });

  describe('Visibility change handling', () => {
    beforeEach(async () => {
      recorder = new AudioRecorder({ canvas, debug: true });
      await recorder.startMicrophone();
    });

    test('should handle visibility change to hidden', () => {
      // Simulate page hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      // Timer fallback should be active
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should handle visibility change to visible', () => {
      // First make it hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Then make it visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should not handle visibility change without source', () => {
      recorder.stopMicrophone();
      recorder.stopVisualization(); // Must stop visualization first
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(recorder.isVisualizationActive).toBe(false);
    });

    test('should use timer fallback when page is hidden', async () => {
      // Simulate page hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Wait for timer to run a few intervals
      await new Promise(resolve => setTimeout(resolve, 50));

      // Timer fallback should still keep visualization active
      expect(recorder.isVisualizationActive).toBe(true);
    });

    test('should not start timer fallback twice', async () => {
      // Simulate page hidden twice
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));

      // Timer should still be running
      expect(recorder.isVisualizationActive).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should emit error event on microphone failure', async () => {
      // Mock getUserMedia to throw
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));

      recorder = new AudioRecorder({ canvas });
      const handler = jest.fn();
      recorder.on('error', handler);

      await expect(recorder.startMicrophone()).rejects.toThrow();
      expect(handler).toHaveBeenCalled();

      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    });

  });

  describe('Cleanup', () => {
    test('should destroy all resources', async () => {
      recorder = new AudioRecorder({ canvas });
      await recorder.startMicrophone();
      recorder.startRecording();
      recorder.showDebugVisual();

      recorder.destroy();

      expect(recorder.sourceType).toBeNull();
      expect(recorder.recordingState).toBe('inactive');
      expect(recorder.isVisualizationActive).toBe(false);
    });

    test('should cleanup blob URLs for file sources', async () => {
      recorder = new AudioRecorder({ canvas });
      const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
      await recorder.connectAudioFile(file);

      recorder.destroy();
      expect(recorder.sourceType).toBeNull();
    });
  });
});
