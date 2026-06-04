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
    AudioAnalyzer,
    savedSettings,
    saveSettings,
    getCurrentSettings,
    getCurrentOptions,
    getCurrentAudioEnhancement,
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

  // Audio enhancement handlers
  function updateAudioEnhancement() {
    recorder.setAudioEnhancement(getCurrentAudioEnhancement());
    saveSettings(getCurrentSettings());
  }

  function updateNoiseProfileDisplay() {
    el.noiseProfileFileName.textContent = app.currentNoiseProfileName
      ? `${app.currentNoiseProfileName} (${app.currentNoiseProfile?.bands?.length || 0} bands)`
      : 'No profile loaded';
    el.clearNoiseProfile.disabled = !app.currentNoiseProfile || app.isRecording;
  }

  el.audioEnhancementEnabled.addEventListener('change', () => {
    el.audioEnhancementControls.style.display = el.audioEnhancementEnabled.checked ? 'grid' : 'none';
    updateAudioEnhancement();
  });

  el.noiseReduction.addEventListener('input', () => {
    const value = parseInt(el.noiseReduction.value);
    el.noiseReductionValue.textContent = value + '%';
    updateAudioEnhancement();
  });

  el.noiseProfileFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      updateStatus('Error: Audio profile analysis is not supported in this browser', 'error');
      return;
    }

    let audioContext = null;
    try {
      updateStatus('Analyzing noise profile...', 'recording');
      audioContext = new AudioContextCtor();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const profile = AudioAnalyzer.createNoiseProfileFromAudioBuffer(audioBuffer, {
        bandCount: 12,
        fftSize: 2048,
        minFrequency: 80,
        maxFrequency: Math.min(16000, audioBuffer.sampleRate / 2 - 10),
      });

      app.currentNoiseProfile = profile;
      app.currentNoiseProfileName = file.name;
      el.audioEnhancementEnabled.checked = true;
      el.audioEnhancementControls.style.display = 'grid';
      updateNoiseProfileDisplay();
      updateAudioEnhancement();
      updateStatus('Noise profile loaded', 'ready');
    } catch (error) {
      updateStatus('Error: ' + error.message, 'error');
      console.error(error);
    } finally {
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
      updateButtonStates();
    }
  });

  el.noiseProfileReduction.addEventListener('input', () => {
    const value = parseInt(el.noiseProfileReduction.value);
    el.noiseProfileReductionValue.textContent = value + '%';
    updateAudioEnhancement();
  });

  el.clearNoiseProfile.addEventListener('click', () => {
    app.currentNoiseProfile = null;
    app.currentNoiseProfileName = null;
    el.noiseProfileFile.value = '';
    updateNoiseProfileDisplay();
    updateAudioEnhancement();
    updateButtonStates();
  });

  el.smartNormalization.addEventListener('input', () => {
    const value = parseInt(el.smartNormalization.value);
    el.smartNormalizationValue.textContent = value + '%';
    updateAudioEnhancement();
  });

  el.saturation.addEventListener('input', () => {
    const value = parseInt(el.saturation.value);
    el.saturationValue.textContent = value + '%';
    updateAudioEnhancement();
  });

  el.saturationMode.addEventListener('change', updateAudioEnhancement);

  el.saturationMin.addEventListener('input', () => {
    el.saturationMinValue.textContent = el.saturationMin.value;
    updateAudioEnhancement();
  });

  el.saturationMax.addEventListener('input', () => {
    el.saturationMaxValue.textContent = el.saturationMax.value;
    updateAudioEnhancement();
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

  [el.videoQuality, el.aspectRatio].forEach(elem => {
    elem.addEventListener('change', () => {
      app.applyVideoDimensions();
      saveSettings(getCurrentSettings());
    });
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

  // ==================== IMAGE BLINK HANDLERS ====================

  // Image blink enable/disable handler
  el.imageBlinkEnabled.addEventListener('change', () => {
    const enabled = el.imageBlinkEnabled.checked;
    el.imageBlinkControls.style.display = enabled ? 'grid' : 'none';
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink style handler
  el.imageBlinkStyle.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink target handler
  el.imageBlinkTarget.addEventListener('change', () => {
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink frequency range handlers
  el.blinkFrequencyMin.addEventListener('input', () => {
    const min = parseInt(el.blinkFrequencyMin.value);
    const max = parseInt(el.blinkFrequencyMax.value);
    if (min > max) {
      el.blinkFrequencyMax.value = min;
    }
    el.blinkFrequencyValue.textContent = `${min} - ${parseInt(el.blinkFrequencyMax.value)}`;
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  el.blinkFrequencyMax.addEventListener('input', () => {
    const min = parseInt(el.blinkFrequencyMin.value);
    const max = parseInt(el.blinkFrequencyMax.value);
    if (max < min) {
      el.blinkFrequencyMin.value = max;
    }
    el.blinkFrequencyValue.textContent = `${parseInt(el.blinkFrequencyMin.value)} - ${max}`;
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink threshold handler
  el.blinkThreshold.addEventListener('input', () => {
    const threshold = parseInt(el.blinkThreshold.value);
    el.blinkThresholdValue.textContent = threshold;
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink intensity handler
  el.blinkIntensity.addEventListener('input', () => {
    const intensity = parseInt(el.blinkIntensity.value);
    el.blinkIntensityValue.textContent = `${intensity}%`;
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // Image blink duration handler
  el.blinkDuration.addEventListener('input', () => {
    const duration = parseInt(el.blinkDuration.value);
    el.blinkDurationValue.textContent = `${duration}ms`;
    recorder.setVisualizerOptions(getCurrentOptions());
    saveSettings(getCurrentSettings());
    updatePreview();
  });

  // ==================== BLINK DEBUG MODE ====================

  // Helper function to format time as m:ss or mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Helper function to format time with decimals
  function formatTimeWithDecimals(seconds) {
    return seconds.toFixed(2) + 's';
  }

  // Draw waveform on canvas
  function drawBlinkWaveform(audioBuffer) {
    const waveformCanvas = el.blinkWaveformCanvas;
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get audio data (use first channel)
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / width);

    // Draw waveform
    ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
    const centerY = height / 2;

    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel;
      let min = 1;
      let max = -1;

      // Find min and max in this segment
      for (let i = 0; i < samplesPerPixel && startSample + i < channelData.length; i++) {
        const sample = channelData[startSample + i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      // Draw vertical line representing the amplitude range
      const minY = centerY + min * (height / 2);
      const maxY = centerY + max * (height / 2);
      ctx.fillRect(x, maxY, 1, minY - maxY || 1);
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Update selection overlay position
  function updateSelectionOverlay() {
    if (app.blinkDebugAudioDuration <= 0) return;

    const waveformCanvas = el.blinkWaveformCanvas;
    const width = waveformCanvas.offsetWidth;

    if (app.blinkDebugIntervalStartTime > 0 || app.blinkDebugIntervalEndTime > 0) {
      const startX = (app.blinkDebugIntervalStartTime / app.blinkDebugAudioDuration) * width;
      const endX = (app.blinkDebugIntervalEndTime / app.blinkDebugAudioDuration) * width;

      el.blinkSelectionOverlay.style.display = 'block';
      el.blinkSelectionOverlay.style.left = startX + 'px';
      el.blinkSelectionOverlay.style.width = (endX - startX) + 'px';

      el.blinkIntervalDisplay.textContent = `${formatTimeWithDecimals(app.blinkDebugIntervalStartTime)} - ${formatTimeWithDecimals(app.blinkDebugIntervalEndTime)}`;
      el.blinkPlayIntervalBtn.disabled = false;
      el.blinkClearIntervalBtn.disabled = false;
    } else {
      el.blinkSelectionOverlay.style.display = 'none';
      el.blinkIntervalDisplay.textContent = '0.00s - 0.00s';
      el.blinkPlayIntervalBtn.disabled = true;
      el.blinkClearIntervalBtn.disabled = true;
    }
  }

  // Analyze audio interval to extract frequency and volume parameters
  async function analyzeAudioInterval(audioBuffer, startTime, endTime) {
    if (!audioBuffer || startTime >= endTime) return null;

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    // Calculate sample indices
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);

    if (startSample >= channelData.length) return null;

    // Extract the interval data
    const intervalData = channelData.slice(startSample, Math.min(endSample, channelData.length));

    // Calculate RMS volume
    let sumSquares = 0;
    let maxAmp = 0;
    for (let i = 0; i < intervalData.length; i++) {
      const amp = Math.abs(intervalData[i]);
      sumSquares += amp * amp;
      if (amp > maxAmp) maxAmp = amp;
    }

    // Convert RMS to 0-255 scale (approximate threshold)
    const volumeThreshold = Math.round(maxAmp * 255);

    // Perform simple frequency analysis using zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < intervalData.length; i++) {
      if ((intervalData[i] >= 0 && intervalData[i - 1] < 0) ||
          (intervalData[i] < 0 && intervalData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }

    // Estimate frequency from zero crossing rate
    const durationSecs = (endTime - startTime);
    const estimatedFreq = (zeroCrossings / 2) / durationSecs;

    // Create a reasonable frequency range around the estimated frequency
    const freqMin = Math.max(20, Math.round(estimatedFreq * 0.5));
    const freqMax = Math.min(2000, Math.round(estimatedFreq * 1.5));

    return {
      frequencyMin: freqMin,
      frequencyMax: freqMax,
      volumeThreshold: Math.max(50, Math.min(255, volumeThreshold)),
    };
  }

  // Update extracted parameters display and apply to visualizer
  async function updateExtractedParams() {
    if (!app.blinkDebugAudioBuffer || app.blinkDebugIntervalStartTime >= app.blinkDebugIntervalEndTime) {
      el.blinkExtractedParams.style.display = 'none';
      return;
    }

    const params = await analyzeAudioInterval(
      app.blinkDebugAudioBuffer,
      app.blinkDebugIntervalStartTime,
      app.blinkDebugIntervalEndTime
    );

    if (params) {
      el.blinkExtractedParams.style.display = 'block';
      el.blinkExtractedFreq.textContent = `${params.frequencyMin} - ${params.frequencyMax} Hz`;
      el.blinkExtractedThreshold.textContent = params.volumeThreshold;

      // Apply the extracted parameters to the visualizer
      el.blinkFrequencyMin.value = params.frequencyMin;
      el.blinkFrequencyMax.value = params.frequencyMax;
      el.blinkThreshold.value = params.volumeThreshold;
      el.blinkFrequencyValue.textContent = `${params.frequencyMin} - ${params.frequencyMax}`;
      el.blinkThresholdValue.textContent = params.volumeThreshold;

      recorder.setVisualizerOptions(getCurrentOptions());
      saveSettings(getCurrentSettings());
    }
  }

  // Load audio file and create waveform visualization
  async function loadBlinkDebugAudio(dataUrl) {
    try {
      // Create audio context if needed
      if (!app.blinkDebugAudioContext) {
        app.blinkDebugAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Decode audio data
      const response = await fetch(dataUrl);
      const arrayBuffer = await response.arrayBuffer();
      app.blinkDebugAudioBuffer = await app.blinkDebugAudioContext.decodeAudioData(arrayBuffer);
      app.blinkDebugAudioDuration = app.blinkDebugAudioBuffer.duration;

      // Draw waveform
      drawBlinkWaveform(app.blinkDebugAudioBuffer);

      // Update time labels
      el.blinkWaveformStart.textContent = '0:00';
      el.blinkWaveformEnd.textContent = formatTime(app.blinkDebugAudioDuration);

      // Show waveform container
      el.blinkWaveformContainer.style.display = 'block';

      // Update selection overlay
      updateSelectionOverlay();

      // Update extracted params if interval is set
      if (app.blinkDebugIntervalStartTime > 0 || app.blinkDebugIntervalEndTime > 0) {
        await updateExtractedParams();
      }
    } catch (error) {
      console.error('Error loading debug audio:', error);
      el.blinkWaveformContainer.style.display = 'none';
    }
  }

  // Debug mode enable/disable handler
  el.blinkDebugModeEnabled.addEventListener('change', () => {
    const enabled = el.blinkDebugModeEnabled.checked;
    el.blinkDebugControls.style.display = enabled ? 'block' : 'none';
    el.blinkManualControls.style.display = enabled ? 'none' : 'block';

    // If enabling and we have saved audio data, load it
    if (enabled && app.blinkDebugAudioDataUrl) {
      loadBlinkDebugAudio(app.blinkDebugAudioDataUrl);
    }

    saveSettings(getCurrentSettings());
  });

  // Debug audio file input handler
  el.blinkDebugAudioFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    app.blinkDebugAudioFileName = file.name;
    el.blinkDebugFileName.textContent = file.name;

    // Convert to data URL for persistence
    const reader = new FileReader();
    reader.onload = async (event) => {
      app.blinkDebugAudioDataUrl = event.target.result;

      // Reset interval selection
      app.blinkDebugIntervalStartTime = 0;
      app.blinkDebugIntervalEndTime = 0;

      // Load and display waveform
      await loadBlinkDebugAudio(app.blinkDebugAudioDataUrl);

      saveSettings(getCurrentSettings());
    };
    reader.readAsDataURL(file);
  });

  // Waveform canvas mouse events for interval selection
  el.blinkWaveformCanvas.addEventListener('mousedown', (e) => {
    if (!app.blinkDebugAudioBuffer) return;

    app.blinkDebugIsSelecting = true;
    const rect = el.blinkWaveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    app.blinkDebugSelectionStartX = x;

    // Calculate time from x position
    const width = rect.width;
    app.blinkDebugIntervalStartTime = (x / width) * app.blinkDebugAudioDuration;
    app.blinkDebugIntervalEndTime = app.blinkDebugIntervalStartTime;

    updateSelectionOverlay();
  });

  el.blinkWaveformCanvas.addEventListener('mousemove', (e) => {
    if (!app.blinkDebugIsSelecting) return;

    const rect = el.blinkWaveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Calculate time from x position
    const currentTime = (x / width) * app.blinkDebugAudioDuration;

    // Update start and end times based on drag direction
    if (x >= app.blinkDebugSelectionStartX) {
      app.blinkDebugIntervalStartTime = (app.blinkDebugSelectionStartX / width) * app.blinkDebugAudioDuration;
      app.blinkDebugIntervalEndTime = currentTime;
    } else {
      app.blinkDebugIntervalStartTime = currentTime;
      app.blinkDebugIntervalEndTime = (app.blinkDebugSelectionStartX / width) * app.blinkDebugAudioDuration;
    }

    // Clamp values
    app.blinkDebugIntervalStartTime = Math.max(0, app.blinkDebugIntervalStartTime);
    app.blinkDebugIntervalEndTime = Math.min(app.blinkDebugAudioDuration, app.blinkDebugIntervalEndTime);

    updateSelectionOverlay();
  });

  el.blinkWaveformCanvas.addEventListener('mouseup', async () => {
    if (app.blinkDebugIsSelecting) {
      app.blinkDebugIsSelecting = false;

      // Analyze the selected interval
      await updateExtractedParams();
      saveSettings(getCurrentSettings());
    }
  });

  el.blinkWaveformCanvas.addEventListener('mouseleave', async () => {
    if (app.blinkDebugIsSelecting) {
      app.blinkDebugIsSelecting = false;

      // Analyze the selected interval
      await updateExtractedParams();
      saveSettings(getCurrentSettings());
    }
  });

  // Play interval button handler
  el.blinkPlayIntervalBtn.addEventListener('click', () => {
    if (!app.blinkDebugAudioBuffer || !app.blinkDebugAudioContext) return;
    if (app.blinkDebugIntervalStartTime >= app.blinkDebugIntervalEndTime) return;

    // Stop any existing playback
    if (app.blinkDebugAudioSource) {
      try {
        app.blinkDebugAudioSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    // Create new source and play the interval
    app.blinkDebugAudioSource = app.blinkDebugAudioContext.createBufferSource();
    app.blinkDebugAudioSource.buffer = app.blinkDebugAudioBuffer;
    app.blinkDebugAudioSource.connect(app.blinkDebugAudioContext.destination);

    const duration = app.blinkDebugIntervalEndTime - app.blinkDebugIntervalStartTime;
    app.blinkDebugAudioSource.start(0, app.blinkDebugIntervalStartTime, duration);

    // Update button text during playback
    el.blinkPlayIntervalBtn.textContent = 'Playing...';
    el.blinkPlayIntervalBtn.disabled = true;

    setTimeout(() => {
      el.blinkPlayIntervalBtn.textContent = 'Play Interval';
      el.blinkPlayIntervalBtn.disabled = false;
    }, duration * 1000);
  });

  // Clear interval button handler
  el.blinkClearIntervalBtn.addEventListener('click', () => {
    app.blinkDebugIntervalStartTime = 0;
    app.blinkDebugIntervalEndTime = 0;
    el.blinkExtractedParams.style.display = 'none';
    updateSelectionOverlay();
    saveSettings(getCurrentSettings());
  });

  // Initialize debug mode from saved settings after page load
  if (savedSettings.blinkDebugModeEnabled && savedSettings.blinkDebugAudioData) {
    // Defer loading to allow page to fully initialize
    setTimeout(() => {
      loadBlinkDebugAudio(savedSettings.blinkDebugAudioData);
    }, 500);
  }

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
