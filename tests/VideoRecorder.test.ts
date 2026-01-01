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
});
