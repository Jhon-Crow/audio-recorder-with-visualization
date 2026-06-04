# Issue 101 Case Study: Profile-Based Microphone Noise Reduction

## Issue

Issue: https://github.com/Jhon-Crow/audio-recorder-with-visualization/issues/101

The current audio enhancement noise control did not help enough for microphone hiss. The requested workflow is to provide a noise-only microphone recording, learn that noise, and reduce matching noise in the actual recording while avoiding obvious voice/music distortion.

## Collected Repository Data

- Issue metadata: `docs/case-studies/issue-101/logs/issue-101.json`
- Issue comments: `docs/case-studies/issue-101/logs/issue-101-comments.json`
- Prepared PR metadata: `docs/case-studies/issue-101/logs/pr-103.json`
- Prepared PR comments: `docs/case-studies/issue-101/logs/pr-103-comments.json`
- Desktop control screenshot: `docs/case-studies/issue-101/noise-profile-smart-controls-desktop.png`
- Mobile control screenshot: `docs/case-studies/issue-101/noise-profile-smart-controls-mobile.png`
- Related merged work: PR 98 added the default-off audio enhancement chain with a simple quiet-signal attenuation control.

## Follow-Up Feedback

After the first draft, the repository owner reported that the profile cleanup still distorted voice noticeably and asked for a smarter control surface that keeps complexity under the hood, preferably with one or two sliders. That feedback changed the target from "make learned profile reduction available" to "make learned profile reduction voice-safe by default."

## Existing Behavior

The implementation from PR 98 used a high-pass filter and waveshaper curve for `noiseReduction`. That can reduce low-level signal regions, but it does not learn the microphone's spectral fingerprint and cannot selectively target steady hiss, hum, or fan tone under wanted audio.

The first profile-based draft learned broad noisy FFT bands and turned each selected band into a static peaking-filter cut. That worked for dominant hum or hiss, but a broadband noise-only profile could mark many voice-range bands as equally noisy. At the previous default strength, those bands could receive large cuts in the 100 Hz to 5 kHz speech range, which explains the reported voice coloration.

## External Research

- Audacity's Noise Reduction workflow uses a noise-only region to identify the noise floor per frequency, then applies reduction to the selected signal. Its manual also warns that stronger reduction can damage desired audio and that the method works best for constant noise such as hiss, hum, buzz, and fan noise: https://manual.audacityteam.org/man/noise_reduction.html
- The `noisereduce` project describes spectral gating with an optional noise clip, frequency-band thresholds, and stationary vs non-stationary noise reduction: https://github.com/timsainb/noisereduce
- RNNoise is an RNN-based noise suppression library aimed at real-time speech enhancement: https://github.com/xiph/rnnoise
- Browser RNNoise WASM wrappers exist, for example `@shiguredo/rnnoise-wasm`, but they add WASM/model packaging and are speech-oriented rather than general voice/music preserving profile subtraction: https://github.com/shiguredo/rnnoise-wasm
- Web Audio `AudioWorklet` is available for lower-latency custom DSP, but it requires additional processor module packaging and secure-context constraints: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- Browser `noiseSuppression` media constraints exist, but support is not universal and the browser may ignore unsupported constraints, so it cannot be the only library-level solution: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/noiseSuppression

## Solution Options Considered

1. Full AudioWorklet spectral subtraction:
   - Best match for textbook spectral subtraction.
   - Higher implementation and packaging risk for this library because it needs worklet module delivery in CDN, bundler, and Electron/example paths.

2. RNNoise/WASM:
   - Strong real-time speech noise suppression.
   - Less appropriate for music-preserving profile subtraction, adds a new binary dependency, and may make non-speech material sound gated or synthetic.

3. Browser microphone `noiseSuppression` constraint:
   - Useful when available from the browser or device.
   - Not reliable enough as the primary feature because browser support varies, unsupported constraints can be ignored, and it does not use the user-provided noise-only profile requested in the issue.

4. Conservative profile-based multiband attenuation:
   - Analyze a noise-only file into log-spaced FFT bands.
   - Apply bounded peaking-filter attenuation for the learned noisy bands before the existing gate, normalization, and saturation chain.
   - Weight strong tonal or frequency-localized noise more heavily than flat broadband noise.
   - Protect likely speech bands by default, while still allowing rumble and hiss cleanup.
   - Works with existing Web Audio nodes, applies to microphone recording and file conversion, stays dependency-free, and exposes only one primary slider plus one protection slider.

## Implemented Approach

Implemented option 4.

- Added `AudioNoiseProfile`, `AudioNoiseProfileBand`, and `AudioNoiseProfileOptions`.
- Added `AudioAnalyzer.createNoiseProfileFromSamples()` and `AudioAnalyzer.createNoiseProfileFromAudioBuffer()`.
- Added `noiseProfile`, `noiseProfileReduction`, and `noiseProfileVoiceProtection` to `AudioEnhancementOptions`.
- Added a profile reduction stage before the previous noise gate/normalizer/saturation stages.
- Changed profile generation to compare each learned band against the profile median and peak so flat broadband profiles no longer produce maximum cuts across voice.
- Added per-band speech-overlap metadata and caps, with stronger default protection in the 100 Hz to 5 kHz speech range and a taper above that range.
- Lowered the learned-profile default cleanup from 60 to 45 and defaulted profile voice protection to 85 when a profile is loaded.
- Kept stronger cleanup available for low rumble and high hiss bands where speech overlap is lower.
- Added example-app controls for selecting a noise-only profile file, reducing/clearing that profile, persisting the compact profile, and applying it to both microphone recording and audio-to-video conversion.
- Simplified the example UI to the main profile file selector, `Clean Voice`, and `Voice Protection`, with older raw enhancement controls collapsed into `Advanced`.
- Updated README API documentation.
- Added unit tests for profile creation, validation, runtime clearing, processed-stream activation, smarter profile defaults, and broadband speech-band protection.

## Limitations

This is not a destructive offline editor and does not perform full per-frame spectral subtraction. It is intentionally conservative for real-time/browser recording: it learns stationary spectral bands and reduces them with bounded filters. Very loud, variable, or signal-overlapping noise can still require lower cleanup settings, higher voice protection, browser/device-level noise suppression where available, or a more specialized AudioWorklet/RNNoise path in a future release.
