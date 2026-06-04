# Issue 101 Case Study: Profile-Based Microphone Noise Reduction

## Issue

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/101

The current audio enhancement noise control did not help enough for microphone hiss. The requested workflow is to provide a noise-only microphone recording, learn that noise, and reduce matching noise in the actual recording while avoiding obvious voice/music distortion.

## Collected Repository Data

- Issue metadata: `docs/case-studies/issue-101/logs/issue-101.json`
- Issue comments: `docs/case-studies/issue-101/logs/issue-101-comments.json`
- Prepared PR metadata: `docs/case-studies/issue-101/logs/pr-103.json`
- Related merged work: PR 98 added the default-off audio enhancement chain with a simple quiet-signal attenuation control.

## Existing Behavior

The implementation from PR 98 used a high-pass filter and waveshaper curve for `noiseReduction`. That can reduce low-level signal regions, but it does not learn the microphone's spectral fingerprint and cannot selectively target steady hiss, hum, or fan tone under wanted audio.

## External Research

- Audacity's Noise Reduction workflow uses a noise-only region to identify the noise floor per frequency, then applies reduction to the selected signal. Its manual also warns that stronger reduction can damage desired audio and that the method works best for constant noise such as hiss, hum, buzz, and fan noise: https://manual.audacityteam.org/man/noise_reduction.html
- The `noisereduce` project describes spectral gating with an optional noise clip, frequency-band thresholds, and stationary vs non-stationary noise reduction: https://github.com/timsainb/noisereduce
- RNNoise is an RNN-based noise suppression library aimed at real-time speech enhancement: https://github.com/xiph/rnnoise
- Browser RNNoise WASM wrappers exist, for example `@shiguredo/rnnoise-wasm`, but they add WASM/model packaging and are speech-oriented rather than general voice/music preserving profile subtraction: https://github.com/shiguredo/rnnoise-wasm
- Web Audio `AudioWorklet` is available for lower-latency custom DSP, but it requires additional processor module packaging and secure-context constraints: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet

## Solution Options Considered

1. Full AudioWorklet spectral subtraction:
   - Best match for textbook spectral subtraction.
   - Higher implementation and packaging risk for this library because it needs worklet module delivery in CDN, bundler, and Electron/example paths.

2. RNNoise/WASM:
   - Strong real-time speech noise suppression.
   - Less appropriate for music-preserving profile subtraction, adds a new binary dependency, and may make non-speech material sound gated or synthetic.

3. Conservative profile-based multiband attenuation:
   - Analyze a noise-only file into log-spaced FFT bands.
   - Apply bounded peaking-filter attenuation for the learned noisy bands before the existing gate, normalization, and saturation chain.
   - Works with existing Web Audio nodes, applies to microphone recording and file conversion, stays dependency-free, and lets users choose moderate reduction to limit artifacts.

## Implemented Approach

Implemented option 3.

- Added `AudioNoiseProfile`, `AudioNoiseProfileBand`, and `AudioNoiseProfileOptions`.
- Added `AudioAnalyzer.createNoiseProfileFromSamples()` and `AudioAnalyzer.createNoiseProfileFromAudioBuffer()`.
- Added `noiseProfile` and `noiseProfileReduction` to `AudioEnhancementOptions`.
- Added a profile reduction stage before the previous noise gate/normalizer/saturation stages.
- Added example-app controls for selecting a noise-only profile file, reducing/clearing that profile, persisting the compact profile, and applying it to both microphone recording and audio-to-video conversion.
- Updated README API documentation.
- Added unit tests for profile creation, validation, runtime clearing, and processed-stream activation.

## Limitations

This is not a destructive offline editor and does not perform full per-frame spectral subtraction. It is intentionally conservative for real-time/browser recording: it learns stationary spectral bands and reduces them with bounded filters. Very loud, variable, or signal-overlapping noise can still require lower reduction settings or a more specialized AudioWorklet/RNNoise path in a future release.
