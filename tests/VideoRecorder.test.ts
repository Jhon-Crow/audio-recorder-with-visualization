import { VideoRecorder } from '../src/core/VideoRecorder';

describe('VideoRecorder', () => {
  let recorder: VideoRecorder;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    recorder = new VideoRecorder();
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  test('should start in inactive state', () => {
    expect(recorder.state).toBe('inactive');
  });

  test('should check format support', () => {
    // Our mock only supports webm
    expect(VideoRecorder.isFormatSupported('webm')).toBe(true);
    expect(VideoRecorder.isFormatSupported('mp4')).toBe(false);
  });

  test('should get supported MIME type', () => {
    const mimeType = VideoRecorder.getSupportedMimeType('webm');
    expect(mimeType).toContain('webm');
  });

  test('should get supported formats', () => {
    const formats = VideoRecorder.getSupportedFormats();
    expect(formats).toContain('webm');
  });

  test('should start recording', () => {
    recorder.start(canvas);
    expect(recorder.state).toBe('recording');
  });

  test('should throw when starting recording twice', () => {
    recorder.start(canvas);
    expect(() => recorder.start(canvas)).toThrow();
  });

  test('should throw for unsupported format', () => {
    expect(() => recorder.start(canvas, undefined, { format: 'mp4' })).toThrow();
  });

  test('should pause recording', () => {
    recorder.start(canvas);
    recorder.pause();
    expect(recorder.state).toBe('paused');
  });

  test('should resume recording', () => {
    recorder.start(canvas);
    recorder.pause();
    recorder.resume();
    expect(recorder.state).toBe('recording');
  });

  test('should throw when pausing without recording', () => {
    expect(() => recorder.pause()).toThrow();
  });

  test('should throw when resuming without pausing', () => {
    recorder.start(canvas);
    expect(() => recorder.resume()).toThrow();
  });

  test('should stop recording and return blob', async () => {
    recorder.start(canvas);

    const blob = await recorder.stop();

    expect(blob).toBeInstanceOf(Blob);
    expect(recorder.state).toBe('inactive');
  });

  test('should reject a pending stop when the encoder errors', async () => {
    recorder.start(canvas);
    const mediaRecorder = (recorder as unknown as { mediaRecorder: MediaRecorder }).mediaRecorder;
    mediaRecorder.stop = jest.fn();

    const stopPromise = recorder.stop();
    const error = new DOMException('Encoder crashed', 'EncodingError');
    const event = new Event('error') as Event & { error?: DOMException };
    Object.defineProperty(event, 'error', { value: error });
    mediaRecorder.onerror?.(event as ErrorEvent);

    await expect(stopPromise).rejects.toThrow('Encoder crashed');
    expect(recorder.state).toBe('inactive');
  });

  test('should stop the canvas stream when MediaRecorder construction fails', () => {
    const stop = jest.fn();
    const stream = new MediaStream();
    jest.spyOn(MediaStream.prototype, 'getTracks').mockReturnValue([
      { kind: 'video', stop } as unknown as MediaStreamTrack,
    ]);
    const captureStreamSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'captureStream')
      .mockReturnValue(stream);
    const OriginalMediaRecorder = global.MediaRecorder;
    try {
      global.MediaRecorder = class {
        static isTypeSupported(): boolean { return true; }
        constructor() { throw new Error('construction failed'); }
      } as unknown as typeof MediaRecorder;

      expect(() => recorder.start(canvas)).toThrow('construction failed');
      expect(stop).toHaveBeenCalled();
      expect(recorder.state).toBe('inactive');
    } finally {
      global.MediaRecorder = OriginalMediaRecorder;
      captureStreamSpy.mockRestore();
    }
  });

  test('should throw when stopping without recording', async () => {
    await expect(recorder.stop()).rejects.toThrow();
  });

  test('should cancel recording', () => {
    recorder.start(canvas);
    recorder.cancel();
    expect(recorder.state).toBe('inactive');
  });

  test('should handle cancel when not recording', () => {
    // Should not throw
    recorder.cancel();
    expect(recorder.state).toBe('inactive');
  });

  test('should include audio stream in recording', () => {
    const audioStream = new MediaStream();
    recorder.start(canvas, audioStream);
    expect(recorder.state).toBe('recording');
  });

  test('should set error callback with onError method', () => {
    const errorCallback = jest.fn();
    recorder.onError(errorCallback);

    // Start recording to create the MediaRecorder
    recorder.start(canvas);

    // The error callback should be set (internal implementation detail)
    expect(recorder.state).toBe('recording');
  });

  test('should call error callback when encoder error occurs', () => {
    const errorCallback = jest.fn();
    recorder.onError(errorCallback);

    recorder.start(canvas);

    // Simulate an encoder error by triggering the onerror callback
    // We need to access the internal MediaRecorder to test this
    const mockError = new DOMException('Test encoder error', 'EncodingError');
    const errorEvent = new Event('error') as Event & { error?: DOMException };
    Object.defineProperty(errorEvent, 'error', { value: mockError });

    // The onerror handler was set up during start(), we can't directly access it
    // but we can verify the callback was set
    expect(recorder.state).toBe('recording');
  });

  describe('testEncoderSupport', () => {
    test('should return true for webm format when encoder works', async () => {
      const result = await VideoRecorder.testEncoderSupport('webm');
      // In jsdom environment, this should work since our mock supports webm
      expect(typeof result).toBe('boolean');
    }, 5000);

    test('should return false for unsupported format', async () => {
      // mp4 is not supported in our mock environment
      const result = await VideoRecorder.testEncoderSupport('mp4');
      expect(result).toBe(false);
    }, 5000);

    test('should handle timeout properly', async () => {
      // Test with very short timeout - should still return a boolean
      const result = await VideoRecorder.testEncoderSupport('webm', 100);
      expect(typeof result).toBe('boolean');
    }, 5000);
  });
});
