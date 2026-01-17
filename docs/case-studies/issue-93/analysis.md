# Case Study: Issue #93 - WAV to MP4 Conversion Fails on First Attempt

## Problem Description

When converting WAV audio files to MP4 video format, the encoding fails on the first attempt with an `EncodingError`, but succeeds on the second attempt by falling back to WebM format.

The issue is that the `testEncoderSupport()` validation passes, but the actual encoding still fails. On retry, the encoder test correctly fails and the system properly falls back to WebM.

## Error Reports

### Error Report from Log File 1 (First Attempt - Fails)

- **Audio file type**: WAV (uncompressed audio)
- **Audio file duration**: ~33 minutes (1994.7 seconds)
- **Target format**: MP4 with H.264 video (avc1) and AAC audio (mp4a.40.2)
- **Test result**: `testEncoderSupport()` PASSED (no fallback message)
- **Codec attempted**: `avc1.42E01E` (Constrained Baseline Profile, Level 3.0)
- **Error timing**: Failed immediately after `start()` call
- **Log file**: `error-logs/error-log-1768677490362.txt`

```
[AudioToVideoConverter] Testing MP4 encoder support...
[AudioToVideoConverter] Audio duration: 1994.7 seconds
[VideoRecorder] Started recording with mimeType: video/mp4;codecs=avc1.42E01E,mp4a.40.2
[VideoRecorder] Encoder error: EncodingError The given encoder configuration is not supported by the encoder.
Error: Encoding failed: The given encoder configuration is not supported by the encoder.. Try using WebM format instead for better compatibility.
```

### Error Report from Log File 2 (Second Attempt - Falls Back to WebM)

- **First attempt**: Same error as above
- **Second attempt**: `testEncoderSupport()` correctly returns `false`, falls back to WebM
- **WebM encoding**: Succeeds with `video/webm;codecs=vp9,opus`
- **Log file**: `error-logs/error-log-1768681356869.txt`

```
[AudioToVideoConverter] Testing MP4 encoder support...
[AudioToVideoConverter] MP4 encoder not available, falling back to WebM
[VideoRecorder] Started recording with mimeType: video/webm;codecs=vp9,opus
[VideoRecorder] Received chunk: 245634 bytes
... (conversion proceeds successfully)
```

## Root Cause Analysis

### Key Finding: Resolution Mismatch in Encoder Test

The `testEncoderSupport()` method tests encoding with a **64x64 pixel canvas**, but the actual conversion uses **1920x1080** (or other high resolutions). The hardware encoder may support the codec at low resolutions but fail at higher resolutions.

From the [MDN MediaRecorder documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static):
> "Recording may still fail if there are insufficient resources to support the recording and encoding process."

### Why the Test Passes but Encoding Fails

1. **Small Test Canvas**: The 64x64 test canvas is trivial for any encoder
2. **High Resolution Actual Use**: 1920x1080 may exceed hardware encoder limits
3. **Resolution-Dependent Support**: Some hardware encoders have maximum resolution limits
4. **Transient Encoder State**: After the first failure, the encoder may enter a state where subsequent tests correctly fail

### Hardware Encoder Limitations

According to research from [Chromium Bug 601636](https://bugs.chromium.org/p/chromium/issues/detail?id=601636) and [Google Chrome Community discussions](https://support.google.com/chrome/thread/208757216):

1. **NVIDIA GPUs**: Only support main and high profiles, not baseline
2. **macOS Apple Silicon**: H264/HEVC hardware encoding issues exist on macOS 15.0
3. **Android**: Many devices lack H.264 software encoder in Chrome
4. **Resolution Limits**: Some hardware encoders only support up to 720p or 1080p

### Why Second Attempt Works

On the second attempt, the encoder test correctly fails because:
1. The hardware encoder may be in a "failed" state after the first error
2. System resources may be exhausted temporarily
3. Browser may cache the failure state

This causes `testEncoderSupport()` to correctly return `false`, triggering the WebM fallback.

## Solution

### Approach: Test at Target Resolution

The fix is to test encoder support at the **same resolution** that will be used for the actual conversion, not a small 64x64 test canvas.

### Implementation

Modify `VideoRecorder.testEncoderSupport()` to accept optional resolution parameters:

```typescript
static async testEncoderSupport(
  format: RecordingFormat,
  timeoutMs = 2000,
  testWidth = 64,
  testHeight = 64
): Promise<boolean>
```

Then in `AudioToVideoConverter.convertWithFallback()`, pass the target resolution:

```typescript
const mp4Supported = await VideoRecorder.testEncoderSupport(
  'mp4',
  2000,
  videoWidth,
  videoHeight
);
```

## Research Sources

1. [MDN - MediaRecorder.isTypeSupported()](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) - Documents that isTypeSupported returning true doesn't guarantee encoding success
2. [Chromium Bug 601636 - MediaRecorder: support H264](https://bugs.chromium.org/p/chromium/issues/detail?id=601636) - Chrome H.264 encoding implementation details
3. [Google Chrome Community - H264 Hardware Acceleration Issues](https://support.google.com/chrome/thread/208757216) - User reports of H.264 encoding failures
4. [MDN - MediaRecorder mimeType](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType) - MediaRecorder mimeType documentation
5. [GitHub - enable-chromium-hevc-hardware-decoding](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding) - Hardware encoding limitations guide

## Testing

1. Test MP4 encoding at various resolutions (720p, 1080p, 1440p, 2160p)
2. Test on systems with and without hardware H.264 encoder support
3. Verify WebM fallback occurs when MP4 test fails
4. Test with long audio files (30+ minutes)
5. Verify the fix works on first attempt without needing a retry
