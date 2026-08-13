/**
 * Issue #208 audit — executable proofs for the defects reported in the analysis.
 *
 * These tests assert the CURRENT (buggy) behaviour so that the audit is backed by
 * evidence rather than by reading alone. When a defect is fixed, the matching test
 * here will fail and must be inverted — that is intentional, it is the regression
 * signal that the fix actually changed behaviour.
 *
 * Run with:  npx jest --config experiments/jest.audit.config.js
 */
import { AudioRecorder } from '../src/AudioRecorder';
import { AudioToVideoConverter } from '../src/AudioToVideoConverter';
import { BarVisualizer } from '../src/visualizers';

describe('issue #208 — proof 1: visualizer registries are out of sync', () => {
  it('AudioToVideoConverter rejects visualizers that AudioRecorder advertises', () => {
    const recorderVisualizers = AudioRecorder.getAvailableVisualizers();
    const converterVisualizers = AudioToVideoConverter.getAvailableVisualizers();

    const missing = recorderVisualizers.filter(
      (name) => !converterVisualizers.includes(name)
    );

    // Documents the defect: five visualizers can be selected for live
    // visualization but cannot be used to render a video.
    expect(missing).toEqual([
      'double-spiral',
      'pulse',
      'waterfall-bars',
      'grid',
      'lissajous',
    ]);
  });

  it('convert() throws "Unknown visualizer" for a visualizer the recorder accepts', async () => {
    const canvas = document.createElement('canvas');
    const converter = new AudioToVideoConverter();

    await expect(
      converter.convert({
        audioSource: 'audio.mp3',
        canvas,
        visualizer: 'lissajous',
      })
    ).rejects.toThrow(/Unknown visualizer: lissajous/);
  });
});

describe('issue #208 — proof 2: a background image cannot be removed', () => {
  it('clearing backgroundImage leaves the previously loaded image in place', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;

    const preloaded = new Image();
    const visualizer = new BarVisualizer({ backgroundImage: preloaded });
    await visualizer.init(canvas);

    // Sanity check: the image was accepted.
    expect(
      (visualizer as unknown as { backgroundImageElement: unknown }).backgroundImageElement
    ).toBe(preloaded);

    // The documented way to remove a background image.
    await visualizer.setOptions({ backgroundImage: undefined as never });

    // Defect: loadImages() never clears backgroundImageElement, so the old
    // image keeps being drawn forever.
    expect(
      (visualizer as unknown as { backgroundImageElement: unknown }).backgroundImageElement
    ).toBe(preloaded);
  });
});
