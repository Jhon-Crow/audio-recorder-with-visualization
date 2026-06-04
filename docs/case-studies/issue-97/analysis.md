# Issue 97 Audio Enhancement Case Study

## Source Artifacts

- Issue snapshot: `logs/issue-97.json`
- Issue comments snapshot: `logs/issue-97-comments.json`
- Issue URL: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/97

The issue asks for a new audio enhancement section that is disabled by default and can improve noisy or compressed microphone input with noise reduction, smart normalization, saturation, and optional frequency/method controls.

## Current Architecture Findings

- Microphone capture flows through `AudioRecorder.startMicrophone()`, then `AudioAnalyzer.connectStream()`, and recording uses the active microphone `MediaStream`.
- Audio-file conversion flows through `AudioToVideoConverter.convert()`, then `AudioAnalyzer.connectAudioElement()`, and recording previously captured the raw media element stream.
- Visualization already depends on `AnalyserNode`, so the lowest-risk place to add enhancement is the analyzer graph before both visualization data and recording/export capture.
- The example UI persists settings through `examples/app-core.js` and updates controls through the feature/interactions modules.

## External Research

- MDN documents `DynamicsCompressorNode` as the native Web Audio node for dynamic range control, including threshold, knee, ratio, attack, and release parameters: https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode
- MDN documents `WaveShaperNode` as a native non-linear distortion node often used to add warmth to a signal: https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode
- MDN documents `MediaStreamAudioDestinationNode.stream` as a way to get a `MediaStream` out of a Web Audio graph for use by MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode
- MDN notes `MediaTrackConstraints.noiseSuppression` is not Baseline and may be ignored by unsupported browsers, so relying only on browser capture constraints would not satisfy a portable library-level enhancement path: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/noiseSuppression

## Considered Solutions

1. Browser capture constraints only

   Pros: simple and cheap. Cons: browser support is uneven, it applies only to capture inputs, and the current project deliberately disables browser noise suppression/AGC to preserve raw audio.

2. Native Web Audio processing graph

   Pros: works for microphone and file conversion, requires no new runtime dependency, can stay fully disabled by default, and integrates with the existing analyzer/recorder graph. Cons: noise reduction is practical attenuation/gating rather than ML source separation.

3. RNNoise/WebAssembly or WebRTC Audio Processing Module

   Pros: better speech denoising potential. Cons: significant dependency and packaging cost, AudioWorklet/WASM loading complexity, and more browser compatibility and latency risk.

4. Offline FFmpeg-style filters

   Pros: powerful for file post-processing. Cons: does not cover live microphone visualization/recording and would require a much larger worker/WASM pipeline.

## Implemented Solution

The implementation uses an optional native Web Audio enhancement graph:

- `noiseReduction`: high-pass filtering plus a low-level attenuation curve to reduce rumble and quiet noise floor.
- `smartNormalization`: `DynamicsCompressorNode` plus make-up gain to smooth level jumps and reduce clipping risk.
- `saturation`: `WaveShaperNode` with soft clip, hard clip, tape, and tube curves, mixed with dry signal.
- `saturationFrequencyRange`: optional wet-path high-pass/low-pass limits so saturation can target the requested band.
- `MediaStreamAudioDestinationNode`: only created when enhancement is active, so raw recording/export paths remain unchanged when the feature is off.

Public API additions:

- `AudioEnhancementOptions`
- `ResolvedAudioEnhancementOptions`
- `SaturationMode`
- `AudioRecorderConfig.audioEnhancement`
- `ConversionConfig.audioEnhancement`
- `AudioRecorder.setAudioEnhancement()`
- `AudioRecorder.getAudioEnhancement()`
- `AudioRecorder.getProcessedAudioStream()`

## Verification

- Unit tests assert the feature is off by default.
- Unit tests assert settings are clamped and frequency ranges are normalized.
- Unit tests assert an enhanced graph exposes a processed stream for recording/export.
- Unit tests assert runtime setting changes rebuild the active graph.
- Existing recorder and converter tests cover the unchanged raw path plus the new enhanced stream path.
