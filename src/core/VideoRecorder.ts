import { RecordingFormat, RecordingState, SUPPORTED_MIME_TYPES } from '../types';

/**
 * Video recorder that combines canvas and audio into video file
 */
export class VideoRecorder {
  private static readonly STOP_TIMEOUT_MS = 10000;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private _state: RecordingState = 'inactive';
  private debug: boolean;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private pendingStopReject: ((error: Error) => void) | null = null;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * Set error callback for encoder errors
   * @param callback - Function to call when an encoder error occurs
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
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
   * Test if the encoder actually works for a given format.
   * This performs a real encoding test because isTypeSupported() can return true
   * even when the encoder will fail at runtime (e.g., missing hardware encoder).
   *
   * IMPORTANT: The test should be performed at the target resolution because
   * some hardware encoders support encoding at low resolutions but fail at
   * higher resolutions (e.g., 1080p or 4K).
   *
   * @param format - The recording format to test
   * @param timeoutMs - Timeout in milliseconds (default: 2000)
   * @param testWidth - Width of test canvas (default: 64, but should match target resolution)
   * @param testHeight - Height of test canvas (default: 64, but should match target resolution)
   * @returns Promise resolving to true if encoder works, false otherwise
   */
  static async testEncoderSupport(
    format: RecordingFormat,
    timeoutMs = 2000,
    testWidth = 64,
    testHeight = 64
  ): Promise<boolean> {
    const mimeType = VideoRecorder.getSupportedMimeType(format);
    if (!mimeType) {
      return false;
    }

    // Create a test canvas at the specified resolution
    // Testing at target resolution is important because hardware encoders
    // may support low resolutions but fail at higher ones
    const canvas = document.createElement('canvas');
    canvas.width = testWidth;
    canvas.height = testHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return false;
    }

    // Draw something to the canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, testWidth, testHeight);

    const stream = canvas.captureStream(1);

    return new Promise((resolve) => {
      let resolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const cleanup = (): void => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        stream.getTracks().forEach(track => track.stop());
      };

      try {
        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.onerror = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(false);
          }
        };

        recorder.ondataavailable = (event) => {
          if (!resolved && event.data.size > 0) {
            resolved = true;
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            cleanup();
            resolve(true);
          }
        };

        recorder.onstop = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            // If we got here without data and without error, consider it failed
            resolve(false);
          }
        };

        // Start recording with a short timeslice
        recorder.start(100);

        // Timeout fallback
        timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            cleanup();
            resolve(false);
          }
        }, timeoutMs);

      } catch {
        cleanup();
        resolve(false);
      }
    });
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

    // Get canvas stream with higher quality settings
    const fps = options.fps ?? 30;

    // Ensure canvas is using proper color settings for export
    // This helps prevent color shifts in the exported video
    const canvasStream = canvas.captureStream(fps);
    this.log('Got canvas stream at', fps, 'fps');

    // Combine canvas and audio streams
    const tracks = [...canvasStream.getTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
      this.log('Added', audioStream.getAudioTracks().length, 'audio tracks');
    }
    this.stream = new MediaStream(tracks);

    // Create MediaRecorder with higher quality settings
    // Increased default bitrate from 2.5Mbps to 8Mbps for better quality
    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: options.videoBitrate ?? 8000000,
    };
    if (audioStream && options.audioBitrate) {
      recorderOptions.audioBitsPerSecond = options.audioBitrate;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.log('Received chunk:', event.data.size, 'bytes');
      }
    };

      this.mediaRecorder.onerror = (event) => {
      // MediaRecorder error event contains an error property with DOMException
      const errorEvent = event as Event & { error?: DOMException };
      const error = errorEvent.error || new Error('Unknown MediaRecorder error');
      console.error('[VideoRecorder] Encoder error:', error.name, error.message);
      this.log('Encoder error details:', {
        name: error.name,
        message: error.message,
        mimeType: this.mediaRecorder?.mimeType,
        state: this.mediaRecorder?.state,
      });
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      if (this.pendingStopReject) {
        this.pendingStopReject(error);
      }
    };

    // Request data every second for better memory management
      this.mediaRecorder.start(1000);
      this._state = 'recording';
      this.log('Started recording with mimeType:', mimeType);
    } catch (error) {
      this.stream?.getTracks().forEach(track => track.stop());
      this.cleanup();
      throw error;
    }
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

      let settled = false;
      const settleReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.cleanup();
        reject(error);
      };
      this.pendingStopReject = settleReject;
      const timeoutId = setTimeout(() => {
        settleReject(new Error('Timed out waiting for MediaRecorder to stop'));
      }, VideoRecorder.STOP_TIMEOUT_MS);

      this.mediaRecorder.onstop = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const mimeType = this.mediaRecorder?.mimeType ?? 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.log('Recording stopped, total size:', blob.size, 'bytes');

        // Clean up
        this.cleanup();

        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (error) {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.stream) {
      // Only stop video tracks (canvas stream), NOT audio tracks
      // Audio tracks belong to the original microphone stream and should remain active
      // for subsequent recordings
      this.stream.getVideoTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.pendingStopReject = null;
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
