import { RecordingFormat, RecordingState, SUPPORTED_MIME_TYPES } from '../types';

/**
 * Video recorder that combines canvas and audio into video file
 */
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private _state: RecordingState = 'inactive';
  private debug: boolean;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[VideoRecorder]', ...args);
    }
  }

  /**
   * Get the best supported MIME type for the given format
   */
  static getSupportedMimeType(format: RecordingFormat): string | null {
    const mimeTypes = SUPPORTED_MIME_TYPES[format];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return null;
  }

  /**
   * Check if a format is supported
   */
  static isFormatSupported(format: RecordingFormat): boolean {
    return VideoRecorder.getSupportedMimeType(format) !== null;
  }

  /**
   * Get all supported formats
   */
  static getSupportedFormats(): RecordingFormat[] {
    const formats: RecordingFormat[] = [];
    if (VideoRecorder.isFormatSupported('mp4')) {
      formats.push('mp4');
    }
    if (VideoRecorder.isFormatSupported('webm')) {
      formats.push('webm');
    }
    return formats;
  }

  /**
   * Start recording
   * @param canvas - Canvas element to record
   * @param audioStream - Optional audio stream to include
   * @param options - Recording options
   */
  start(
    canvas: HTMLCanvasElement,
    audioStream?: MediaStream,
    options: {
      format?: RecordingFormat;
      videoBitrate?: number;
      audioBitrate?: number;
      fps?: number;
    } = {}
  ): void {
    if (this._state !== 'inactive') {
      throw new Error('Recording already in progress');
    }

    const format = options.format ?? 'webm';
    const mimeType = VideoRecorder.getSupportedMimeType(format);

    if (!mimeType) {
      throw new Error(`Format "${format}" is not supported in this browser`);
    }

    // Get canvas stream
    const fps = options.fps ?? 30;
    const canvasStream = canvas.captureStream(fps);
    this.log('Got canvas stream at', fps, 'fps');

    // Combine canvas and audio streams
    const tracks = [...canvasStream.getTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
      this.log('Added', audioStream.getAudioTracks().length, 'audio tracks');
    }
    this.stream = new MediaStream(tracks);

    // Create MediaRecorder
    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: options.videoBitrate ?? 2500000,
    };
    if (audioStream && options.audioBitrate) {
      recorderOptions.audioBitsPerSecond = options.audioBitrate;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.log('Received chunk:', event.data.size, 'bytes');
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('[VideoRecorder] Error:', event);
    };

    // Request data every second for better memory management
    this.mediaRecorder.start(1000);
    this._state = 'recording';
    this.log('Started recording with mimeType:', mimeType);
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this._state !== 'recording' || !this.mediaRecorder) {
      throw new Error('Cannot pause: not recording');
    }
    this.mediaRecorder.pause();
    this._state = 'paused';
    this.log('Paused recording');
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this._state !== 'paused' || !this.mediaRecorder) {
      throw new Error('Cannot resume: not paused');
    }
    this.mediaRecorder.resume();
    this._state = 'recording';
    this.log('Resumed recording');
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stop(): Promise<Blob> {
    if (this._state === 'inactive' || !this.mediaRecorder) {
      throw new Error('Cannot stop: not recording');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType ?? 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.log('Recording stopped, total size:', blob.size, 'bytes');

        // Clean up
        this.cleanup();

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this._state = 'inactive';
  }

  /**
   * Cancel recording and discard data
   */
  cancel(): void {
    if (this._state === 'inactive') {
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    this.log('Recording cancelled');
  }

  /**
   * Get current recording state
   */
  get state(): RecordingState {
    return this._state;
  }

  /**
   * Get current recording duration in milliseconds
   */
  get recordedSize(): number {
    return this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
  }
}
