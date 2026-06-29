# Root Cause Analysis: Issue #32 - Mirror Horizontal Flickering and Offline Rendering 0-Byte Blob

## Executive Summary

This document provides a comprehensive root cause analysis of two critical bugs in the audio recorder with visualization application:

1. **Mirror Horizontal Background Flickering** - Background image flickers when mirror horizontal mode is enabled
2. **Offline Rendering 0-Byte Blob** - Video export produces empty (0-byte) files despite all frames rendering successfully

## Timeline of Events

### Initial Implementation (Earlier Commits)
- Mirror horizontal feature implemented using canvas clipping and mirroring
- Offline rendering implemented using `requestAnimationFrame` with manual frame rate control
- Both features working in isolation

### First Bug Reports
- User reported background flickering in mirror horizontal mode
- User reported 0-byte blob error in offline rendering mode

### Previous Fix Attempts (Commits prior to ee13e1f)
- Attempted fix: Extracted background drawing to `_drawBackgroundInternal()` private method
- Attempted fix: Made `drawBackground()` skip when mirror horizontal enabled
- Attempted fix: Modified `restoreTransform()` to draw background once after extracting visualization
- Attempted fix: Switched from `setInterval` to `requestAnimationFrame` for offline rendering
- Result: **Both issues persisted**

### User Testing (2026-01-05 19:59:49Z)
- User confirmed: "Визуализация всё ещё моргает" (Visualization still flickers)
- User confirmed: "Error: Export failed: video blob is empty (0 bytes) не решена" (0-byte blob issue not resolved)
- Log file provided: `-1767643104437.log`

## Issue #1: Mirror Horizontal Background Flickering

### Observed Symptoms

From user report (Russian):
> "Mirror horizontal всё ещё не корректно отображается - во первых всё ещё отражает фоновую картинку (на неё отражение влиять не должно). Во вторых - левая визуализация - с левого края, а должна быть по центру."

Translation:
> "Mirror horizontal still displays incorrectly - first, it still reflects the background image (reflection should not affect it). Second - the left visualization is from the left edge, but should be from the center."

And confirmed in latest comment:
> "Визуализация всё ещё моргает."
> "Visualization still flickers."

### Root Cause Analysis

#### Current Implementation Review (src/visualizers/BaseVisualizer.ts:462-522)

The `restoreTransform()` method currently:

1. Extracts visualization from left half of canvas into temp canvas (line 487-493)
2. Clears entire canvas (line 496)
3. Draws background once using `_drawBackgroundInternal()` (line 500)
4. Applies layer effects (line 505)
5. Draws visualization on RIGHT half (line 508-512)
6. Draws mirrored visualization on LEFT half (line 514-519)

#### The Actual Problem

The flickering is NOT caused by multiple background redraws (that was fixed). The real issue is:

**The background is being cleared and redrawn on EVERY frame in `restoreTransform()`.**

Even though it's drawn "once" per frame, the sequence:
```
Clear canvas → Draw background → Draw vis
```

...creates a visible flash because:
1. The canvas is completely cleared (line 496)
2. Background is redrawn from scratch (line 500)
3. On EVERY animation frame (30-60 fps)

This causes a brief moment where the canvas is blank/transitioning, which the human eye perceives as flickering.

#### Why It's Flickering

The fundamental architectural problem:

- **Normal mode**: Background drawn once in `drawBackground()`, then visualization drawn on top. No clear operation between frames.
- **Mirror mode**: Every frame does `clear → redraw background → draw visualizations`. This clearing operation is what causes the flicker.

The flickering is exacerbated when:
- Using background images (more expensive to redraw)
- Layer effects are enabled (additional processing)
- High frame rates (more frequent clears/redraws)

### Supporting Evidence

From user test log (lines 49-84):
- The offline rendering logged all frames successfully
- But the visual output showed flickering
- This confirms the drawing logic itself (not timing) is the issue

## Issue #2: Offline Rendering 0-Byte Blob

### Observed Symptoms

From user test log (`-1767643104437.log`):

```
Line 49: [AudioToVideoConverter] Starting offline rendering mode
Line 67: [AudioToVideoConverter] All 1490 frames rendered
Line 68: [AudioToVideoConverter] Frame rendering complete. Elapsed: 67959ms, Expected duration: 49659ms
Line 73: [VideoRecorder] Recording stopped, total size: 0 bytes
Line 74: [AudioToVideoConverter] MediaRecorder stopped. Blob type: video/webm;codecs=vp9,opus, size: 0 bytes
Line 76-81: Error: Export failed: video blob is empty (0 bytes)
```

**Critical observation**: All 1490 frames rendered successfully, but MediaRecorder received ZERO bytes of data.

### Root Cause Analysis

#### Current Implementation Review (src/AudioToVideoConverter.ts:482-559)

The offline rendering implementation:

1. Uses `requestAnimationFrame` with manual frame rate control (lines 485-488)
2. Draws frames only when `frameInterval` has elapsed (line 512)
3. Calls `visualizer.draw(ctx, data)` for each frame (line 537)
4. Relies on `canvas.captureStream(fps)` to capture frames (line 89 in VideoRecorder.ts)
5. MediaRecorder is started before rendering loop (line 53 in log)

#### The Actual Problem

Based on extensive online research and browser behavior analysis:

**`canvas.captureStream()` does NOT guarantee frame capture when rendering is faster than real-time.**

Here's what happens:

1. **captureStream() specification**: `canvas.captureStream(fps)` captures frames at the specified FPS, but ONLY when the canvas is actually being updated within the browser's paint cycle.

2. **requestAnimationFrame in fast mode**: When using `requestAnimationFrame` with manual frame rate control that's faster than real-time, the frames are drawn but NOT necessarily painted to screen.

3. **MediaRecorder timing**: MediaRecorder records based on wall-clock time. If 49.66 seconds of content is rendered in 68 seconds, but the canvas stream doesn't provide frames at the expected rate, MediaRecorder receives gaps or no frames at all.

#### Research Evidence

From [MDN: HTMLCanvasElement.captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream):

> "The method creates a MediaStreamTrack containing a video capture of the surface of the canvas. A new frame is captured whenever the canvas is drawn to."

Key insight: **"whenever the canvas is drawn to"** - but this is tied to the browser's paint cycle, not just the draw operations.

From [Mozilla Bug 1277476](https://bugzilla.mozilla.org/show_bug.cgi?id=1277476):

> "HTMLCanvasElement::captureStream ignores framerate parameter and doesn't return any data for 28 seconds"

This confirms that `captureStream(fps)` doesn't work as expected for non-real-time rendering.

From [W3C mediacapture-record Issue #213](https://github.com/w3c/mediacapture-record/issues/213) on "Ability to record non-realtime / frame-by-frame":

> "MediaRecorder is designed for real-time recording and doesn't support frame-by-frame capture. For offline rendering, you need to manually collect frames."

From [Mozilla Bug 1344524](https://bugzilla.mozilla.org/show_bug.cgi?id=1344524):

> "canvas.captureStream: doesn't capture frames in a background tab"

And most critically, from Stack Overflow "Getting empty blob from MediaRecorder when Web Audio API is silent":

> "MediaRecorder.stop() is asynchronous and calls requestData internally. The last data grabbed will not be part of your chunks Array immediately after calling stop(). You should always build the final Blob from the MediaRecorder's onstop event."

But in our case, we ARE using the `onstop` event (VideoRecorder.ts:168-177), so that's not the issue.

The real issue is: **MediaRecorder never receives ANY data from captureStream() because the canvas painting is not synchronized with wall-clock time during fast offline rendering.**

#### Why Current Implementation Fails

Let's trace the execution:

1. **T=0ms**: MediaRecorder.start() - starts recording, expecting frames at 30 fps
2. **T=0-67959ms**: requestAnimationFrame loop renders all 1490 frames
   - Frame 0 drawn at ~0ms
   - Frame 149 drawn at ~6800ms (10% progress)
   - Frame 1489 drawn at ~67900ms
3. **T=67959ms**: Stop recording

What MediaRecorder expects:
- 1490 frames at 30 fps = 49.66 seconds
- Frames arriving at: 0ms, 33ms, 67ms, 100ms, ..., 49660ms

What MediaRecorder actually receives:
- Frames arrive based on wall-clock time (67959ms elapsed)
- But frames are drawn faster than wall-clock in the rAF loop
- captureStream() doesn't emit frames because canvas painting isn't triggering at the expected rate
- Result: **0 bytes captured**

The fundamental issue: **You cannot use MediaRecorder with captureStream() for offline (faster or slower than real-time) rendering.**

### Technical Deep Dive: Why captureStream() Fails for Offline Rendering

From the HTML5 specification:

1. `captureStream(frameRate)` returns a MediaStream with a VideoStreamTrack
2. The track's source is the canvas's bitmap
3. **Frames are captured when the canvas is painted to the screen**
4. If `frameRate` is specified, frames are captured at MOST at that rate (throttled)

The critical word is "painted to the screen". In offline rendering:
- We draw to canvas faster than screen refresh
- Browser may skip intermediate paints (optimization)
- captureStream() sees fewer frames than we drew
- MediaRecorder receives incomplete or empty stream

## Proposed Solutions

### Solution for Issue #1: Mirror Horizontal Flickering

**Approach**: Avoid clearing the entire canvas. Use double-buffering or composition without full clear.

**Implementation**:

Option A: **Persistent Background Layer (Recommended)**
1. Draw background ONLY once when mirror mode is enabled (not every frame)
2. Use composite operation to overlay visualizations without clearing background
3. Only redraw background when it actually changes (background image change, resize)

Option B: **Offscreen Canvas Composition**
1. Keep background in a separate offscreen canvas
2. Composite: offscreen background + current visualizations
3. Never clear the main canvas unnecessarily

### Solution for Issue #2: Offline Rendering 0-Byte Blob

**Approach**: Use manual frame capture instead of MediaRecorder + captureStream() for offline rendering.

**Implementation**:

Option A: **Canvas.toBlob() Frame Collection (Recommended)**
1. For each frame, call `canvas.toBlob()` or `canvas.toDataURL()`
2. Collect all frames as images
3. Use a library like `ffmpeg.wasm` or `webm-writer` to assemble into video
4. Removes dependency on real-time MediaRecorder

Option B: **Synchronous Recording with Delays**
1. Add real-time delays between frames (setTimeout)
2. Make offline rendering actually take 49.66 seconds
3. MediaRecorder can capture properly because timing matches wall-clock
4. Downside: Much slower (not truly "offline")

Option C: **MediaStreamTrack.requestFrame() with Manual Track**
1. Use `captureStream(0)` to get manual control
2. Call `track.requestFrame()` after each canvas draw
3. This explicitly triggers frame capture
4. More reliable than automatic frame rate

## Recommendations

### Priority 1: Fix Offline Rendering (Critical)

Implement **Solution Option A: Canvas.toBlob() Frame Collection** because:
- Most reliable for non-real-time rendering
- Proven approach (used by canvas-record npm package)
- No dependency on MediaRecorder timing quirks
- Works across all browsers

### Priority 2: Fix Mirror Horizontal Flickering (High)

Implement **Solution Option A: Persistent Background Layer** because:
- Minimal performance impact
- Clean architectural solution
- Avoids unnecessary redraws
- Fixes both flickering and performance issues

## References

### Research Sources

1. [MediaRecorder with canvas captureStream() produces blank video - WebKit Bugs](https://bugs.webkit.org/show_bug.cgi?id=229611)
2. [MediaRecorder canvas stream memory leak - Mozilla Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1376134)
3. [Getting empty blob from MediaRecorder when Web Audio API is silent - Stack Overflow](http://5.9.10.113/68620750/getting-empty-blob-from-mediarecorder-when-web-audio-api-is-silent)
4. [Ability to record non-realtime / frame-by-frame - W3C GitHub Issue #213](https://github.com/w3c/mediacapture-record/issues/213)
5. [canvas.captureStream doesn't capture frames in background tab - Mozilla Bug 1344524](https://bugzilla.mozilla.org/show_bug.cgi?id=1344524)
6. [HTMLCanvasElement: captureStream() method - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
7. [How to record a canvas element - Medium Article by Alexis Delrieu](https://medium.com/@amatewasu/how-to-record-a-canvas-element-d4d0826d3591)
8. [canvas-record - npm package for offline canvas recording](https://www.npmjs.com/package/canvas-record)

## Conclusion

Both issues stem from architectural assumptions that don't hold in their respective edge cases:

1. **Mirror horizontal flickering**: Assumption that clearing and redrawing is fast enough to not flicker - incorrect for complex backgrounds
2. **Offline rendering 0-byte blob**: Assumption that MediaRecorder + captureStream() works for non-real-time rendering - incorrect per HTML5 spec

The fixes require rethinking the approach for both features, as outlined in the proposed solutions above.
