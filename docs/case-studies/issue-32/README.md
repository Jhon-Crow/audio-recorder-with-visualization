# Case Study: Issue #32 - Mirror Horizontal and Offline Rendering Failures

## Executive Summary

This case study analyzes two persistent bugs in the audio visualization application:
1. **Mirror Horizontal Bug**: Background image incorrectly mirrors along with visualization
2. **Offline Rendering Bug**: MediaRecorder produces 0-byte blobs, causing video export failures

Both issues have persisted through multiple attempted fixes, indicating fundamental design flaws rather than simple implementation errors.

## Timeline of Events

### Initial Issue Report (2026-01-05 ~16:00 UTC)
User reported three problems:
1. Visualization doesn't work when window is minimized (should work the same as non-minimized)
2. Need ability to render video with visualization without real-time audio playback
3. Mirror horizontal incorrectly displays - mirrors background image (shouldn't) and left visualization starts from left edge instead of center

### First Fix Attempt (2026-01-05 16:22 UTC)
**Changes Made:**
- Used `volume=0` instead of `muted=true` for offline rendering
- Added `audioContextClosed` flag to prevent double-close errors
- Simplified mirror horizontal to mirror both background and visualization
- Added CSS `image-rendering` properties for HD+ pixelization

**Result:** FAILED
- Mirror horizontal still mirrored background (incorrect)
- Offline rendering produced 0-byte blobs

### Second Fix Attempt (2026-01-05 17:50 UTC)
**Changes Made:**
- Background saved before visualization
- Visualization clipped to left half
- Left half mirrored to right half

**Result:** FAILED
- Mirror horizontal still showed background mirroring
- Visualization still started from edges, not center

### Third Fix Attempt (2026-01-05 18:10 UTC)
**Changes Made:**
- Extract left half visualization
- Restore full background (unmirrored)
- Place left half on RIGHT side
- Mirror left half to LEFT side

**Result:** FAILED
- No visible change in behavior
- Still mirroring background

### Fourth Fix Attempt (2026-01-05 18:30 UTC)
**Changes Made:**
- Used `destination-out` composite operation to extract visualization
- Draw initial frame before captureStream
- Use requestAnimationFrame instead of setTimeout

**Result:** PARTIALLY FAILED
- Mirror horizontal: Gap removed ✓, but background still mirrored ✗
- Offline rendering: Still produced 0-byte blobs ✗

### Latest Status (2026-01-05 18:50 UTC)
**User Feedback:**
- Mirror horizontal: Visualizations correctly positioned, but background still mirrors
- Offline rendering: Still throwing errors, 0-byte blobs
- Performance: Lags in background mode

## Root Cause Analysis

### Issue 1: Mirror Horizontal Background Mirroring

**Hypothesis 1: destination-out Not Working**
The current implementation uses `destination-out` to extract visualization from background:
```typescript
tempCtx.globalCompositeOperation = 'destination-out';
tempCtx.drawImage(this._mirrorBackgroundCanvas, ...);
```

**Why This Fails:**
1. **Pixel-Perfect Alignment Required**: `destination-out` requires EXACT pixel matching to remove areas. If the background saved in `_mirrorBackgroundCanvas` doesn't perfectly match the background on the main canvas, it won't remove anything.
2. **Shadow/Effects Interference**: Known bug (Mozilla #1201272) - `destination-out` fails when shadows are present
3. **Composite Operation Limitations**: `destination-out` only affects alpha channel, can't distinguish between "background" and "foreground" conceptually

**Evidence:**
- All four fix attempts using composite operations failed
- User consistently reports background still mirrors
- No change in visible behavior despite code changes

**True Root Cause:**
The approach is fundamentally flawed. You cannot "extract visualization from background" using composite operations because:
- Canvas doesn't track layers separately
- Once drawn, pixels are just pixels - no concept of "this is background, this is visualization"
- Composite operations work on pixel values, not semantic layers

### Issue 2: Offline Rendering 0-Byte Blobs

**Error Pattern Analysis:**
```
Error log 1 (1767629314627):
- Line 178: Recording stopped, total size: 0 bytes
- Line 184: InvalidStateError: Cannot close a closed AudioContext

Error log 2 (1767635787670):
- Line 28-29: Recording stopped immediately, 0 bytes

Error log 3 (1767636862495):
- Line 13: Audio playback started successfully
- Line 13-14: Recording stopped immediately, 0 bytes

Error log 4 (1767638981737):
- Line 49: Audio playback started successfully
- Lines 50-56: Window blur/focus events during recording
- Line 59: Recording stopped, 0 bytes
```

**Pattern Identified:**
Recording stops almost immediately (within milliseconds) producing 0 bytes, even though:
- Canvas stream starts successfully
- Audio tracks are added
- MediaRecorder starts
- Initial frame is drawn
- Audio plays successfully

**Research Findings:**
From W3C Issue #213 and MDN documentation:
1. **Real-time Clock Problem**: MediaRecorder records in real-time using wall clock, not logical frames
2. **captureStream Timing**: Canvas needs continuous updates for captureStream to capture frames
3. **requestAnimationFrame Throttling**: When window is blurred/hidden, rAF throttles to ~1fps or pauses entirely
4. **MediaRecorder Synchronization**: MediaRecorder expects constant stream updates at specified framerate

**Why Current Code Fails:**
```typescript
// Line 533-535: Uses requestAnimationFrame
requestAnimationFrame(renderNextFrame);
```

**The Problem:**
- Window blur events occur during rendering (see error logs)
- requestAnimationFrame gets throttled/paused when window is blurred
- MediaRecorder expects frames at 30fps
- No frames arrive → MediaRecorder stops with 0 bytes

**Additional Issue - Timing Race Condition:**
```typescript
// Line 444-445: Wait one frame
await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
```
This doesn't guarantee the canvas content is actually captured by the stream. The stream capture timing is asynchronous and browser-dependent.

## Technical Research Summary

### Canvas Composite Operations
- **destination-out** removes pixels where source and destination overlap
- Only affects alpha channel, not semantic layers
- Fails with shadows (Mozilla bug #1201272)
- Requires pixel-perfect matching
- Cannot distinguish "background" from "visualization"

Sources:
- [Mozilla Bug #1201272](https://bugzilla.mozilla.org/show_bug.cgi?id=1201272)
- [MDN: globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation)

### MediaRecorder + captureStream
- MediaRecorder records in real-time using wall clock
- Empty blobs occur when stream provides no frames
- requestAnimationFrame throttles when window is blurred/backgrounded
- No standard way to do true offline/non-realtime recording
- Initial frame timing is browser-dependent and unreliable

Sources:
- [W3C Issue #213 - Non-realtime recording](https://github.com/w3c/mediacapture-record/issues/213)
- [Mozilla Bug #1344524 - captureStream background tab](https://bugzilla.mozilla.org/show_bug.cgi?id=1344524)
- [MDN: MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [W3C Issue #28 - requestFrame timing](https://github.com/w3c/mediacapture-fromelement/issues/28)

## Proposed Solutions

### Solution 1: Mirror Horizontal - Render Separately Approach

**Strategy:** Don't try to "extract" visualization. Instead, render it separately.

**Implementation:**
1. Draw background to full canvas
2. Create temporary canvas for visualization only
3. Render visualization to temp canvas with transparent background
4. Mirror the temp canvas to both sides of main canvas

**Why This Works:**
- No composite operations needed
- True separation of background and visualization
- Clean, predictable behavior

**Code Approach:**
```typescript
// 1. Draw background normally
drawBackground(ctx);

// 2. Create temp canvas for visualization only
const tempCanvas = document.createElement('canvas');
tempCanvas.width = width / 2;
tempCanvas.height = height;
const tempCtx = tempCanvas.getContext('2d')!;

// 3. Draw visualization to temp canvas (transparent background)
drawVisualization(tempCtx, data);

// 4. Mirror to both sides
const centerX = width / 2;

// Right side: normal
ctx.drawImage(tempCanvas, centerX, 0);

// Left side: mirrored
ctx.save();
ctx.translate(centerX, 0);
ctx.scale(-1, 1);
ctx.drawImage(tempCanvas, 0, 0);
ctx.restore();
```

### Solution 2: Offline Rendering - Use setInterval Instead of requestAnimationFrame

**Strategy:** Don't rely on requestAnimationFrame which gets throttled. Use setInterval which runs regardless of window state.

**Implementation:**
1. Draw initial frame
2. Start captureStream and MediaRecorder
3. Use setInterval to render frames at precise intervals
4. Clear interval when all frames complete
5. Wait for audio completion with proper timing

**Why This Works:**
- setInterval runs at consistent rate even when window is blurred
- Provides steady stream of frames to MediaRecorder
- No throttling issues
- Predictable timing

**Code Approach:**
```typescript
// Start recording
videoRecorder.start(canvas, audioStream, options);

// Start audio
audioElement.volume = 0;
await audioElement.play();

// Use setInterval for consistent frame delivery
const frameInterval = 1000 / fps;  // e.g., 33.33ms for 30fps
let frameIndex = 0;

const intervalId = setInterval(() => {
  if (frameIndex >= totalFrames) {
    clearInterval(intervalId);
    return;
  }

  // Render frame
  const currentTime = frameIndex / fps;
  const data = generateVisualizationData(currentTime);
  visualizer.draw(ctx, data);

  frameIndex++;
}, frameInterval);

// Wait for completion
await waitForInterval(intervalId);
await waitForAudioEnd(audioElement);
await sleep(1000);  // Let MediaRecorder finalize

const blob = await videoRecorder.stop();
```

### Alternative Solution 2B: Manual Frame Capture with requestFrame()

For browsers that support it, use manual frame requests:

```typescript
const stream = canvas.captureStream(0);  // 0 = manual mode
const track = stream.getVideoTracks()[0];

for (let i = 0; i < totalFrames; i++) {
  // Render frame
  visualizer.draw(ctx, data);

  // Manually request frame capture
  if (track.requestFrame) {
    track.requestFrame();
  }

  // Small delay for processing
  await sleep(1000 / fps);
}
```

## Implementation Priority

1. **Fix Mirror Horizontal** (High Priority)
   - Simpler problem with clear solution
   - Render visualization separately instead of extraction

2. **Fix Offline Rendering** (High Priority)
   - Use setInterval instead of requestAnimationFrame
   - Ensure steady frame delivery to MediaRecorder

3. **Testing** (Critical)
   - Test mirror horizontal with various background images
   - Test offline rendering with window minimized/blurred
   - Test on different browsers (Chrome, Firefox, Safari)

## Lessons Learned

1. **Composite operations are not magic** - They work on pixels, not semantic layers
2. **Browser APIs have limitations** - MediaRecorder expects real-time streams
3. **requestAnimationFrame throttles** - Not suitable for offline rendering
4. **Complex approaches fail** - Simple solutions (separate rendering) often better
5. **Test assumptions early** - All four fixes assumed composite operations would work

## Latest Update (2026-01-06 10:20 UTC)

### User Feedback on Previous Fixes

User reported that **BOTH issues remain UNFIXED** after 10+ attempted commits:

> "Обе ошибки не исправлены." (Both errors are not fixed)

**Evidence:**
- User log file: `-1767694792264.log` showing 0-byte blob after rendering 1265 frames
- Both issues persist despite claims of fixes in previous PR comments

### Critical Finding from Latest User Log Analysis

```
Line 34: [AudioToVideoConverter] All 1265 frames rendered
Line 35: [AudioToVideoConverter] Frame rendering complete. Elapsed: 100020ms, Expected duration: 49659ms
Line 40: [AudioToVideoConverter] Recording stopped, total size: 0 bytes from 0 chunks
Line 41: [AudioToVideoConverter] MediaRecorder stopped. Blob type: video/webm;codecs=vp9,opus, size: 0 bytes
```

**Key Insight**: The implementation uses `requestAnimationFrame` which IS throttled in minimized/background windows, causing MediaRecorder to receive ZERO frames despite canvas drawing completing.

### Additional Research (2026-01-06)

**[Mozilla Bug #1344524](https://bugzilla.mozilla.org/show_bug.cgi?id=1344524)**:
> "canvas.captureStream: doesn't capture frames in a background tab - navigating to a different tab in Firefox causes less than 1 fps capture"

**[Chromium Bug #639105](https://bugs.chromium.org/p/chromium/issues/detail?id=639105)**:
> "canvas.captureStream() empty on background tab - video stalls entirely when using canvas with requestAnimationFrame"

**[Medium: How To Record Canvas Without Browser Throttling](https://medium.com/@chemsabd/how-to-recorded-canvas-in-react-without-browser-throttling-using-web-workers-and-webcodecs-792446d21f10)**:
> "Modern browsers throttle requestAnimationFrame and canvas updates when tabs aren't active, making background recording nearly impossible. Use Web Workers and OffscreenCanvas or WebCodecs for reliable recording."

## Implementation Results

### Status: BOTH ISSUES STILL PRESENT ❌

Previous attempts claimed to fix issues but user testing confirms both problems persist:

1. **Mirror Horizontal** - Still showing incorrect behavior
2. **Offline Rendering** - Still producing 0-byte blobs

### Why Previous Fixes Failed

**Mirror Horizontal Previous Attempt:**
- Used RIGHT half clipping and mirroring
- Background caching implemented
- **Issue**: Despite code logic being correct, user reports it still doesn't work as expected

**Offline Rendering Previous Attempt:**
- Used `requestAnimationFrame` with `canvas.captureStream(fps)`
- **Fatal Flaw**: `requestAnimationFrame` is THROTTLED in background/minimized windows
- MediaRecorder operates on wall-clock time and expects real-time frame delivery
- When RAF delivers frames slowly (< fps), MediaRecorder times out with 0 bytes
- This is a fundamental architectural problem, not a simple bug

## Testing

Run automated tests:
```bash
npm test
npm run build
npm run lint
npm run typecheck
```

Manual testing scenarios:
1. Mirror horizontal with background image - verify background doesn't mirror
2. Mirror horizontal without background - verify visualization mirrors correctly
3. Offline rendering with window minimized - verify video exports successfully
4. Offline rendering with window focused - verify no performance issues

## Next Steps

1. Commit changes with detailed commit message
2. Push to PR branch
3. Test in browser with actual usage scenarios
4. Monitor CI/CD pipeline
5. Request user testing and feedback
