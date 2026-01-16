# Case Study: Issue #91 - Audio to Video Conversion Failure

## Problem Description

The audio-to-video conversion process fails with an `EncodingError` when converting long audio files to video format. The error message states: "The given encoder configuration is not supported by the encoder."

## Environment

- Audio file duration: ~33 minutes (1994.7 seconds)
- Target format: MP4 with H.264 video (avc1) and AAC audio (mp4a.40.2)
- Frames processed before failure: 47,323 frames (~26 minutes at 30 fps)
- Resolution: 1920x1080

## Error Analysis

### Log Evidence

```
[VideoRecorder] Started recording with mimeType: video/mp4;codecs=avc1.424028,mp4a.40.2
...
error: EncodingError: The given encoder configuration is not supported by the encoder.
  MediaRecorder {mimeType: 'video/mp4;codecs=avc1.420028,mp4a.40.2', ...}
```

### Key Observation: Codec Profile Mismatch

The log shows a **codec profile change** between what was requested and what the error reports:
- **Requested**: `avc1.424028` (Baseline profile, Level 4.0, constraint_set1_flag set)
- **Error shows**: `avc1.420028` (Baseline profile, Level 4.0, constraint_set0_flag set)

This indicates that the browser/encoder internally modified the codec profile during the recording process.

## Root Cause Analysis

### 1. H.264 Codec String Format

The AVC codec string `avc1.XXYYZZ` encodes:
- **XX** (profile_idc): Profile identifier (42 = Baseline, 66 decimal)
- **YY** (profile-iop): Constraint flags
- **ZZ** (level_idc): Level (28 = Level 4.0, 40 decimal)

### 2. Typo in SUPPORTED_MIME_TYPES

There is a **typo** in `src/types.ts` line 276:
```typescript
'video/mp4;codecs=avc1.424028,mp4a.40.2',
```

Should be:
```typescript
'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
```

The codec string `avc1.424028` is **not standard**:
- `avc1.42E01E` = Constrained Baseline Profile, Level 3.0 (widely supported)
- `avc1.424028` = Baseline Profile with unusual constraint flags and Level 4.0

### 3. Hardware Encoder Limitations

The Chrome MediaRecorder API uses hardware-accelerated H.264 encoding when available. Known issues include:
- Hardware encoders may have resolution limits (some Intel GPUs only support 1080p)
- Profile compatibility issues between hardware and software encoders
- When hardware encoder fails, fallback to software encoder may not support the same profile
- Long recordings can exhaust encoder resources

### 4. Platform-Specific Behavior

According to Chromium documentation:
- Hardware encoder selection happens automatically
- `isTypeSupported()` returning `true` doesn't guarantee encoding will succeed
- Different platforms have different encoder capabilities

## Research Sources

1. [MDN - MediaRecorder mimeType](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType)
2. [Chrome Status - MP4 container support for MediaRecorder](https://chromestatus.com/feature/5163469011943424)
3. [Chromium Bug 601636 - MediaRecorder: support H264](https://bugs.chromium.org/p/chromium/issues/detail?id=601636)
4. [MDN - isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
5. [Chromium Issue 348923066 - MP4 video recorded in Chrome cannot be played](https://issues.chromium.org/issues/348923066)
6. [Media MIME Support](https://cconcolato.github.io/media-mime-support/)
7. [media-codecs library](https://github.com/dmnsgn/media-codecs)

## Proposed Solutions

### Solution 1: Fix Codec Strings (Primary)

Update `SUPPORTED_MIME_TYPES` in `src/types.ts` to use widely-supported codec profiles:

```typescript
mp4: [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Constrained Baseline, Level 3.0
  'video/mp4;codecs=avc1.4D401F,mp4a.40.2', // Main Profile, Level 3.1
  'video/mp4;codecs=avc1.64001F,mp4a.40.2', // High Profile, Level 3.1
  'video/mp4',
],
```

### Solution 2: Add Error Recovery in VideoRecorder

Implement encoder error recovery with fallback to WebM format:

```typescript
this.mediaRecorder.onerror = (event) => {
  console.error('[VideoRecorder] Error:', event);
  // Emit error event for caller to handle or retry with different format
};
```

### Solution 3: Default to WebM for Long Recordings

WebM (VP8/VP9) has better cross-platform support and doesn't rely on hardware H.264 encoders:

```typescript
// Recommend WebM for recordings > 10 minutes
const recommendedFormat = duration > 600 ? 'webm' : format;
```

## Recommended Implementation

1. **Fix the codec strings** to use standard, widely-supported profiles
2. **Add better error handling** in VideoRecorder with format fallback capability
3. **Document format recommendations** for different use cases

## Testing

1. Test with short audio files (< 1 minute)
2. Test with medium audio files (5-10 minutes)
3. Test with long audio files (30+ minutes)
4. Test on different platforms (Windows, macOS, Linux)
5. Test with both MP4 and WebM formats
