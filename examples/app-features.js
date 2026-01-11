/**
 * Audio Recorder with Visualization - Features Module
 * Visualizer change handlers, image blink handlers, blink debug mode
 */

// Wait for core module to be ready
function initFeatures() {
  'use strict';

  const app = window.AudioRecorderApp;
  if (!app || !app.coreReady) {
    window.addEventListener('audioRecorderCoreReady', initFeatures, { once: true });
    return;
  }

  const {
    canvas,
    recorder,
    converter,
    savedSettings,
    saveSettings,
    getCurrentSettings,
    getCurrentOptions,
    updatePreview,
    updateSliderColors,
    updateStatus,
    updateButtonStates,
    addRecording,
    elements: el,
  } = app;

  // ==================== VISUALIZER CHANGE HANDLERS ====================

  // Visualizer change
  el.visualizerSelect.addEventListener('change', async () => {
    // Temporarily stop visualization to avoid drawing during visualizer switch
    const wasVisualizationActive = recorder.isVisualizationActive;
    if (wasVisualizationActive) {
      recorder.stopVisualization();
    }

    try {
      await recorder.setVisualizer(el.visualizerSelect.value, getCurrentOptions());
    } finally {
      // Resume visualization if it was active
      if (wasVisualizationActive && recorder.sourceType) {
        recorder.resumeVisualization();
      }
    }

    saveSettings(getCurrentSettings());
    // Show/hide center image controls based on visualizer type
    const isCircular = el.visualizerSelect.value === 'circular';
    el.centerImageControls.style.display = isCircular ? 'grid' : 'none';
    // Show center image position controls only if circular and has center image
    el.centerImagePositionControls.style.display = (isCircular && app.currentCenterImageUrl) ? 'grid' : 'none';
    // Show/hide shape controls based on visualizer type
    const isBars = el.visualizerSelect.value === 'bars';
    const isParticles = el.visualizerSelect.value === 'particles';
    el.barShapeControls.style.display = isBars ? 'grid' : 'none';
    el.particleShapeControls.style.display = isParticles ? 'grid' : 'none';
    updatePreview();
  });

  // Options change handlers
  [el.primaryColor, el.secondaryColor, el.bgColor, el.mirror, el.mirrorHorizontal].forEach(elem => {
    elem.addEventListener('input', () => {
      recorder.setVisualizerOptions(getCurrentOptions());
      saveSettings(getCurrentSettings());
      // Update slider colors when colors change
      if (elem === el.primaryColor || elem === el.secondaryColor) {
        updateSliderColors();
      }
      updatePreview();
    });
  });

  // Swap colors button handler
  el.swapColorsBtn.addEventListener('click', () => {
    // Swap primary and secondary color values
    const tempColor = el.primaryColor.value;
    el.primaryColor.value = el.secondaryColor.value;
    el.secondaryColor.value = tempColor;

    // Update visualizer with new colors
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updateSliderColors();
    updatePreview();
  });

  // Bar Count change handler with demo visualization and value display
  const barCountValue = document.getElementById('barCountValue');
  el.barCount.addEventListener('input', () => {
    const newBarCount = parseInt(el.barCount.value);
    barCountValue.textContent = newBarCount;
    recorder.setVisualizerOptions({ barCount: newBarCount });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Frequency Width change handler with demo visualization and value display
  const frequencyWidthValue = document.getElementById('frequencyWidthValue');
  el.frequencyWidth.addEventListener('input', () => {
    const newFrequencyWidth = parseInt(el.frequencyWidth.value);
    frequencyWidthValue.textContent = newFrequencyWidth + '%';
    recorder.setVisualizerOptions({ frequencyWidth: newFrequencyWidth });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Sensitivity change handler with demo visualization and value display
  const sensitivityValue = document.getElementById('sensitivityValue');
  el.sensitivity.addEventListener('input', () => {
    const newSensitivity = parseFloat(el.sensitivity.value);
    sensitivityValue.textContent = newSensitivity.toFixed(1) + 'x';
    recorder.setVisualizerOptions({ sensitivity: newSensitivity });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // ADSR Accordion toggle handler
  el.adsrAccordionHeader.addEventListener('click', () => {
    const isExpanded = el.adsrAccordion.classList.toggle('expanded');
    el.adsrAccordionHeader.setAttribute('aria-expanded', isExpanded);
  });

  // ADSR Attack change handler
  el.adsrAttack.addEventListener('input', () => {
    const value = parseInt(el.adsrAttack.value);
    el.adsrAttackValue.textContent = value + '%';
    recorder.setVisualizerOptions({ adsrAttack: value });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // ADSR Decay change handler
  el.adsrDecay.addEventListener('input', () => {
    const value = parseInt(el.adsrDecay.value);
    el.adsrDecayValue.textContent = value + '%';
    recorder.setVisualizerOptions({ adsrDecay: value });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // ADSR Sustain change handler
  el.adsrSustain.addEventListener('input', () => {
    const value = parseInt(el.adsrSustain.value);
    el.adsrSustainValue.textContent = value + '%';
    recorder.setVisualizerOptions({ adsrSustain: value });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // ADSR Release change handler
  el.adsrRelease.addEventListener('input', () => {
    const value = parseInt(el.adsrRelease.value);
    el.adsrReleaseValue.textContent = value + '%';
    recorder.setVisualizerOptions({ adsrRelease: value });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Visualization alpha handler with display update
  el.visualizationAlpha.addEventListener('input', () => {
    const alpha = parseFloat(el.visualizationAlpha.value);
    el.alphaValue.textContent = Math.round(alpha * 100) + '%';
    recorder.setVisualizerOptions({ visualizationAlpha: alpha });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Offset X handler with display update
  el.offsetX.addEventListener('input', () => {
    const x = parseInt(el.offsetX.value);
    el.offsetXValue.textContent = x + 'px';
    recorder.setVisualizerOptions({ offsetX: x });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Offset Y handler with display update
  el.offsetY.addEventListener('input', () => {
    const y = parseInt(el.offsetY.value);
    el.offsetYValue.textContent = y + 'px';
    recorder.setVisualizerOptions({ offsetY: y });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Scale handler with display update
  el.visualizationScale.addEventListener('input', () => {
    const s = parseInt(el.visualizationScale.value);
    el.scaleValue.textContent = s + '%';
    recorder.setVisualizerOptions({ scale: s / 100 });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Layer effect handler
  el.layerEffect.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Layer effect intensity handler with display update
  el.layerEffectIntensity.addEventListener('input', () => {
    const intensity = parseInt(el.layerEffectIntensity.value);
    el.layerEffectIntensityValue.textContent = intensity + '%';
    recorder.setVisualizerOptions({ layerEffectIntensity: intensity });
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Background image
  el.bgImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert image to base64 data URL for persistence across sessions
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        app.currentBackgroundImageUrl = dataUrl;
        // Wait for image to load before continuing to prevent flickering
        await recorder.setVisualizerOptions({ backgroundImage: dataUrl });
        // Save settings with the new background image
        saveSettings(getCurrentSettings());
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  });

  // Background size mode change handler
  el.bgSizeMode.addEventListener('change', () => {
    const mode = el.bgSizeMode.value;
    el.customSizeControls.style.display = mode === 'custom' ? 'grid' : 'none';
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Custom background size handlers
  el.bgCustomWidth.addEventListener('input', () => {
    if (el.bgSizeMode.value === 'custom') {
      recorder.setVisualizerOptions(getCurrentOptions());
      saveSettings(getCurrentSettings());
      updatePreview();
    }
  });

  el.bgCustomHeight.addEventListener('input', () => {
    if (el.bgSizeMode.value === 'custom') {
      recorder.setVisualizerOptions(getCurrentOptions());
      saveSettings(getCurrentSettings());
      updatePreview();
    }
  });

  // Use custom colors checkbox handler
  el.useCustomColors.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Bar shape change handler
  el.barShapeSelect.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Particle shape change handler
  el.particleShapeSelect.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Video format change handler - persist setting
  el.videoFormat.addEventListener('change', () => {
    saveSettings(getCurrentSettings());
  });

  // Signal that features module is ready
  app.featuresReady = true;
  window.dispatchEvent(new CustomEvent('audioRecorderFeaturesReady'));

  console.log('Features module initialized');
}

// Initialize features when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFeatures);
} else {
  initFeatures();
}
