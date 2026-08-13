# Issue #208 — Codebase audit

> «проанализируй все недачёты и ошибки … и выдай комментарий со всеми пунктами под исправление»

This is the full write-up behind the audit comment posted on issue #208. Every item below
cites `file:line` evidence that was read directly in this repository at commit `a9addac`.

## Baseline

Before auditing, a clean baseline was established so that every finding is a genuine gap
and not a pre-existing failure:

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 — 10 suites, 354 tests |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` (incl. dev) | 55 (4 critical, 37 high, 12 moderate, 2 low) |

## Executable proofs

Two of the findings are backed by tests rather than by reading alone:
`experiments/issue-208-audit-proofs.test.ts`, run with

```
npx jest --config experiments/jest.audit.config.js
```

These tests assert the **current (buggy)** behaviour. When a defect is fixed the matching
test fails and must be inverted — that failure is the regression signal proving the fix
actually changed behaviour.

---

## A. Functional defects

### A1. Five visualizers cannot be rendered to video (proved)

`AudioRecorder` advertises 16 visualizers (`src/AudioRecorder.ts:37-54`), but
`AudioToVideoConverter`'s registry (`src/AudioToVideoConverter.ts:28-40`) only holds 11.
`double-spiral`, `pulse`, `waterfall-bars`, `grid` and `lissajous` are missing, so
`convert()` throws `Unknown visualizer: <name>` for a visualizer the recorder happily
accepts. None of the five appear in `examples/index.html` either.

*Fix:* derive both registries from one shared map so they cannot drift.

### A2. A background/foreground image can never be removed (proved)

`BaseVisualizer.loadImages()` (`src/visualizers/BaseVisualizer.ts:85-97`) rebuilds
`imageLoadPromises` but never resets `backgroundImageElement` / `foregroundImageElement`.
`setOptions({ backgroundImage: undefined })` therefore keeps drawing the old image forever;
only `destroy()` (`:824-829`) clears them.

*Fix:* null the element fields at the top of `loadImages()` when the corresponding option is absent.

### A3. Image load errors are swallowed

`loadImage()` (`src/visualizers/BaseVisualizer.ts:102-129`) calls `resolve()` from
`img.onerror`, so a broken image URL is indistinguishable from success. The caller has no
way to surface the problem to the user.

### A4. `cancel()` is lost if it arrives during setup

`AudioToVideoConverter.convert()` sets `this.isCancelled = false` on entry
(`src/AudioToVideoConverter.ts:562`) and again on the MP4→WebM fallback re-render, so a
cancel issued while the previous phase was still running is silently discarded.

### A5. Video is truncated on any pause or stall

The render loop finalizes when
`!audioElement.ended && !audioElement.paused && !this.isCancelled` fails
(`src/AudioToVideoConverter.ts:761`). A transient stall or buffering pause ends the
recording early and produces a short video with no error.

### A6. `setVisualizer()` destroys the old visualizer before validating the new name

`src/AudioRecorder.ts:516-531` calls `this.visualizer.destroy()` and only then looks up the
requested name. An unknown name leaves the recorder with a destroyed visualizer.

### A7. `stopMicrophone()` corrupts file-source state

`src/AudioRecorder.ts:321-329` unconditionally nulls `_sourceType` and disconnects, even
when the active source is an audio file rather than the microphone.

### A8. `connectAudioFile()` leaks the previous object URL

`src/AudioRecorder.ts:290-316` creates a new object URL on every call without revoking the
previous one or pausing the previous element.

### A9. Concurrent demo visualization orphans a rAF loop

`showDemoVisualization()` (`src/AudioRecorder.ts:419-452`) shares `this.animationFrameId`
with the main render loop; a second call overwrites the handle and the first loop runs
forever.

### A10. Nullable return types that are never null

`getFrequencyData()` / `getTimeDomainData()` are declared `| null` but always return data,
forcing every caller into a dead null check.

---

## B. Resource leaks and hangs

### B1. `AudioToVideoConverter.convert()` leaks on any early throw

`cleanup()` is defined only inside the returned Promise (`src/AudioToVideoConverter.ts:714`).
Anything that throws between `URL.createObjectURL` (`:628`) and the Promise (`:680`) leaks
the blob URL, the `AudioAnalyzer`'s `AudioContext` and the initialized visualizer.
`cleanup()` also never pauses the audio element.

### B2. Metadata wait can hang forever

`src/AudioToVideoConverter.ts:634-637` awaits `onloadedmetadata` / `onerror` with no timeout
and no handler removal. A file that never fires either event hangs the conversion permanently.

### B3. `audioElement.play()` is not awaited

`src/AudioToVideoConverter.ts:711` ignores the returned Promise, so an autoplay rejection is
an unhandled rejection and the render proceeds against silent audio.

### B4. `VideoRecorder.stop()` can hang

`src/core/VideoRecorder.ts:280-304` has no timeout and no reject path. If `onstop` never
fires the Promise never settles, and `onerror` (`:231-245`) does not reject a pending `stop()`.

### B5. `VideoRecorder.start()` leaks the canvas stream on failure

If `new MediaRecorder(...)` or `.start()` throws (`src/core/VideoRecorder.ts:221-248`), the
stream captured at `:200` is never stopped.

### B6. `testEncoderSupport()` never clears its timeout

`src/core/VideoRecorder.ts:150-159` leaves the `setTimeout` pending after an early resolve.

### B7. `AudioAnalyzer.destroy()` ignores the close Promise

`src/core/AudioAnalyzer.ts:1089-1099` calls `this.audioContext.close()` un-awaited and
un-caught → unhandled rejection on a failing close. Also, `connectAudioElement()` throws
`InvalidStateError` when the same element is connected twice.

### B8. YouTube resumable upload has no retry

`YouTubeUploader.uploadChunks()` (`src/core/YouTubeUploader.ts:560-616`) aborts the whole
upload on a single transient 5xx or network error — the resumable protocol exists precisely
to survive these. `getNextOffset()` (`:711+`) also does not guard against a server Range
that fails to advance, which would loop.

### B9. Wrong JSDoc on `recordedSize`

`src/core/VideoRecorder.ts:344-348` documents "recording duration in milliseconds" for a
getter that returns bytes.

---

## C. Security

### C1. OAuth refresh token stored in plaintext

`writeStoredYouTubeAuth()` (`electron/main.js:141-148`) writes the refresh token to
`userData/youtube-auth.json` unencrypted. Electron's `safeStorage` API is not used anywhere.

### C2. OAuth access token and client secret in `localStorage`

`examples/youtube-upload.js:546` persists the access token, and `:113` persists the client
secret, both in plaintext `localStorage`.

### C3. Renderer-supplied filename is not sanitized in one IPC handler

`save-all-videos-and-show` (`electron/main.js:783-811`) joins `recording.fileName` straight
into a path, while the neighbouring `preset-save-file` (`:847-866`) does sanitize with
`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')`. The inconsistency is the bug — apply the same
sanitizer (and reject `..` segments) in both.

### C4. No navigation hardening

`web-contents-created` (`electron/main.js:717-751`) sets no `setWindowOpenHandler` and no
`will-navigate` guard, so nothing constrains where a window may navigate.
(`contextIsolation` and `nodeIntegration: false` *are* set correctly.)

### C5. No IPC sender validation

The `presentation-*` handlers accept messages without checking `event.senderFrame`.

---

## D. Lifecycle correctness (Electron main)

- `app.on('will-quit')` does not await `appServer.close()` — the HTTP server can outlive quit.
- The `activate` handler calls `createWindow()` without awaiting it.
- `globalShortcut.register(...)` return values are unchecked; a failed registration is silent.
- The presentation window's `close` handler calls `preventDefault()`, which can block app quit.

---

## E. CI and tooling coverage gaps

### E1. CI does not run lint, typecheck, or E2E

`.github/workflows/build-portable.yml` has a single `build` job running `npm test`,
`npm run build` and electron-builder. `npm run lint`, `npm run typecheck` and
`npm run test:e2e` never gate a PR — 10 Cypress specs and both static checks are effectively
dead weight.

### E2. ~11,000 lines of JavaScript are never linted

`.eslintrc.js` sets `ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js']` and
`npm run lint` targets only `src`. `electron/main.js` (1066 lines) and `examples/*.js`
(~10,000 lines) — where most of the security findings above live — are excluded.

### E3. Coverage is configured but never collected

`jest.config.js` declares `collectCoverageFrom: ['src/**/*.ts']`, but no CI step collects or
enforces a threshold.

### E4. Single-platform CI

Only `windows-latest` builds. Linux/macOS regressions are invisible.

### E5. 55 dev-dependency advisories

4 critical / 37 high / 12 moderate / 2 low. **Important nuance:** `npm audit --omit=dev`
reports **0** — none of these ship to users. They are build-chain risk (`app-builder-lib`,
`@typescript-eslint/*`, `@electron/rebuild`, `@xmldom/xmldom`, …), not runtime risk, and
should be prioritised accordingly rather than treated as an emergency.

---

## Suggested priority

1. **A1, A2** — user-visible, reproduced by a passing test, small fixes.
2. **B1, B2, B4, B8** — hangs and leaks; users see a frozen or failed export.
3. **C1, C2, C3** — credential storage and path handling.
4. **E1, E2** — without these, every fix above can silently regress.
5. **A3–A10, B3, B5–B7, B9, C4, C5, D** — correctness hardening.
6. **E3–E5** — infrastructure follow-ups.
