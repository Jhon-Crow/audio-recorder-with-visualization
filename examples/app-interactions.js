/**
 * Audio Recorder with Visualization - Interactions Module
 * Image cropper, audio conversion, canvas interaction, slider enhancements, keyboard shortcuts, presentation mode
 */

// Wait for features module to be ready
function initInteractions() {
  'use strict';

  const app = window.AudioRecorderApp;
  if (!app || !app.featuresReady) {
    window.addEventListener('audioRecorderFeaturesReady', initInteractions, { once: true });
    return;
  }

  const {
    canvas,
    recorder,
    converter,
    saveSettings,
    getCurrentSettings,
    getCurrentOptions,
    updatePreview,
    updateStatus,
    updateButtonStates,
    addRecording,
    elements: el,
  } = app;

  // ==================== IMAGE CROPPER ====================

  const cropperModal = document.getElementById('imageCropperModal');
  const cropperCanvas = document.getElementById('cropperCanvas');
  const cropperCtx = cropperCanvas.getContext('2d');
  const cropperZoom = document.getElementById('cropperZoom');
  const cropperZoomValue = document.getElementById('cropperZoomValue');
  const closeCropperBtn = document.getElementById('closeCropperBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');

  let cropperImage = null;
  let cropperScale = 1;
  let cropperOffsetX = 0;
  let cropperOffsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartOffsetX = 0;
  let dragStartOffsetY = 0;

  function openCropper(imageDataUrl) {
    const img = new Image();
    img.onload = () => {
      cropperImage = img;
      cropperScale = 1;
      cropperOffsetX = 0;
      cropperOffsetY = 0;
      cropperZoom.value = 100;
      cropperZoomValue.textContent = '100%';

      // Set canvas size to fit container (400x400)
      cropperCanvas.width = 400;
      cropperCanvas.height = 400;

      cropperModal.style.display = 'flex';
      drawCropper();
    };
    img.src = imageDataUrl;
  }

  function closeCropper() {
    cropperModal.style.display = 'none';
    cropperImage = null;
    cropperOffsetX = 0;
    cropperOffsetY = 0;
    isDragging = false;
    // Reset file input
    el.centerImage.value = '';
  }

  function drawCropper() {
    if (!cropperImage) return;

    cropperCtx.clearRect(0, 0, cropperCanvas.width, cropperCanvas.height);
    cropperCtx.fillStyle = '#000';
    cropperCtx.fillRect(0, 0, cropperCanvas.width, cropperCanvas.height);

    // Calculate scaled dimensions
    const scale = cropperScale;
    const imgWidth = cropperImage.width * scale;
    const imgHeight = cropperImage.height * scale;

    // Center the image with offset for dragging
    const x = (cropperCanvas.width - imgWidth) / 2 + cropperOffsetX;
    const y = (cropperCanvas.height - imgHeight) / 2 + cropperOffsetY;

    cropperCtx.drawImage(cropperImage, x, y, imgWidth, imgHeight);
  }

  // Mouse drag handlers for cropper
  cropperCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartOffsetX = cropperOffsetX;
    dragStartOffsetY = cropperOffsetY;
    cropperCanvas.style.cursor = 'grabbing';
  });

  cropperCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    cropperOffsetX = dragStartOffsetX + dx;
    cropperOffsetY = dragStartOffsetY + dy;
    drawCropper();
  });

  cropperCanvas.addEventListener('mouseup', () => {
    isDragging = false;
    cropperCanvas.style.cursor = 'grab';
  });

  cropperCanvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      cropperCanvas.style.cursor = 'grab';
    }
  });

  // Set initial cursor style
  cropperCanvas.style.cursor = 'grab';

  // Touch support for mobile
  cropperCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragStartOffsetX = cropperOffsetX;
      dragStartOffsetY = cropperOffsetY;
      e.preventDefault();
    }
  }, { passive: false });

  cropperCanvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;
    cropperOffsetX = dragStartOffsetX + dx;
    cropperOffsetY = dragStartOffsetY + dy;
    drawCropper();
    e.preventDefault();
  }, { passive: false });

  cropperCanvas.addEventListener('touchend', () => {
    isDragging = false;
  });

  function applyCrop() {
    if (!cropperImage) return;

    // Create a temporary canvas for the cropped result
    const resultCanvas = document.createElement('canvas');
    const resultCtx = resultCanvas.getContext('2d');
    const cropSize = 512; // Higher resolution for better quality

    resultCanvas.width = cropSize;
    resultCanvas.height = cropSize;

    // Enable high-quality image smoothing
    resultCtx.imageSmoothingEnabled = true;
    resultCtx.imageSmoothingQuality = 'high';

    // Calculate the source rectangle from the cropper canvas
    const centerX = cropperCanvas.width / 2;
    const centerY = cropperCanvas.height / 2;
    const cropRadius = 100; // Half of display cropSize (200px circle in cropper UI)

    // Get the visible portion parameters (including drag offset)
    const scale = cropperScale;
    const imgWidth = cropperImage.width * scale;
    const imgHeight = cropperImage.height * scale;
    const imgX = (cropperCanvas.width - imgWidth) / 2 + cropperOffsetX;
    const imgY = (cropperCanvas.height - imgHeight) / 2 + cropperOffsetY;

    // Calculate source coordinates on the original image
    const srcCenterX = (centerX - imgX) / scale;
    const srcCenterY = (centerY - imgY) / scale;
    const srcRadius = cropRadius / scale;

    // Draw the cropped circular image
    resultCtx.save();
    resultCtx.beginPath();
    resultCtx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
    resultCtx.clip();

    // Draw image centered in the circle at high resolution
    resultCtx.drawImage(
      cropperImage,
      srcCenterX - srcRadius,
      srcCenterY - srcRadius,
      srcRadius * 2,
      srcRadius * 2,
      0,
      0,
      cropSize,
      cropSize
    );
    resultCtx.restore();

    // Convert to data URL and save with high quality
    const croppedDataUrl = resultCanvas.toDataURL('image/png', 1.0);
    app.currentCenterImageUrl = croppedDataUrl;
    recorder.setVisualizerOptions({ custom: { centerImage: croppedDataUrl } });
    saveSettings(getCurrentSettings());

    // Show center image position controls since we now have a center image
    el.centerImagePositionControls.style.display = 'grid';

    closeCropper();
    updatePreview();
  }

  // Cropper zoom handler
  cropperZoom.addEventListener('input', () => {
    const zoomPercent = parseInt(cropperZoom.value);
    cropperZoomValue.textContent = zoomPercent + '%';
    cropperScale = zoomPercent / 100;
    drawCropper();
  });

  // Cropper button handlers
  closeCropperBtn.addEventListener('click', closeCropper);
  cancelCropBtn.addEventListener('click', closeCropper);
  applyCropBtn.addEventListener('click', applyCrop);

  // Close modal on backdrop click
  cropperModal.addEventListener('click', (e) => {
    if (e.target === cropperModal) {
      closeCropper();
    }
  });

  // Center image upload handler (for circular visualizer)
  el.centerImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        // Open cropper modal instead of applying directly
        openCropper(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  });

  // Center image zoom handler
  el.centerImageZoom.addEventListener('input', () => {
    const zoomValue = parseInt(el.centerImageZoom.value);
    el.centerImageZoomValue.textContent = zoomValue + '%';
    recorder.setVisualizerOptions({
      custom: {
        centerImageZoom: zoomValue / 100,
      },
    });
    updatePreview();
  });
  el.centerImageZoom.addEventListener('change', () => {
    saveSettings(getCurrentSettings());
  });

  // Center image offset X handler
  el.centerImageOffsetX.addEventListener('input', () => {
    const offsetXVal = parseInt(el.centerImageOffsetX.value);
    el.centerImageOffsetXValue.textContent = offsetXVal + 'px';
    recorder.setVisualizerOptions({
      custom: {
        centerImageOffsetX: offsetXVal,
      },
    });
    updatePreview();
  });
  el.centerImageOffsetX.addEventListener('change', () => {
    saveSettings(getCurrentSettings());
  });

  // Center image offset Y handler
  el.centerImageOffsetY.addEventListener('input', () => {
    const offsetYVal = parseInt(el.centerImageOffsetY.value);
    el.centerImageOffsetYValue.textContent = offsetYVal + 'px';
    recorder.setVisualizerOptions({
      custom: {
        centerImageOffsetY: offsetYVal,
      },
    });
    updatePreview();
  });
  el.centerImageOffsetY.addEventListener('change', () => {
    saveSettings(getCurrentSettings());
  });

  // ==================== AUDIO CONVERSION ====================

  // Update progress bar with accessibility
  const progressBar = document.querySelector('.progress-bar');
  const updateProgress = (progress) => {
    const percentage = Math.round(progress * 100);
    progressBar.setAttribute('aria-valuenow', percentage);
    el.progressFill.style.width = percentage + '%';
  };

  // Audio file for conversion
  el.audioFile.addEventListener('change', () => {
    el.convertBtn.disabled = !el.audioFile.files.length || app.isRecording || app.isPreviewing;
    el.previewBtn.disabled = !el.audioFile.files.length || app.isRecording || app.isConverting || app.isPreviewing;
  });

  // Stop preview function
  function stopPreview() {
    if (app.previewAudioElement) {
      app.previewAudioElement.pause();
      app.previewAudioElement.currentTime = 0;
      app.previewAudioElement = null;
    }
    app.isPreviewing = false;
    updateStatus('Ready - Select an audio file to preview or convert', 'ready');
    updateButtonStates();
  }

  // Preview audio with live visualization
  el.previewBtn.addEventListener('click', async () => {
    const file = el.audioFile.files[0];
    if (!file) return;

    app.isPreviewing = true;
    updateStatus('Previewing audio with visualization (adjust settings in real-time)...', 'recording');
    updateButtonStates();

    try {
      // Stop microphone if active to avoid conflicts
      if (recorder.sourceType === 'microphone') {
        recorder.stopMicrophone();
      }

      // Connect the audio file to the recorder for live visualization
      app.previewAudioElement = await recorder.connectAudioFile(file);

      // Set loop mode based on checkbox
      app.previewAudioElement.loop = el.loopPreviewCheckbox.checked;

      // Start playback
      await app.previewAudioElement.play();

      // Listen for audio end (if not looping)
      app.previewAudioElement.addEventListener('ended', () => {
        if (!app.previewAudioElement.loop) {
          stopPreview();
        }
      });
    } catch (error) {
      app.isPreviewing = false;
      updateStatus('Error: ' + error.message, 'error');
      updateButtonStates();
      console.error(error);
    }
  });

  // Stop preview button
  el.stopPreviewBtn.addEventListener('click', stopPreview);

  // Update loop setting when checkbox changes during preview
  el.loopPreviewCheckbox.addEventListener('change', () => {
    if (app.previewAudioElement) {
      app.previewAudioElement.loop = el.loopPreviewCheckbox.checked;
    }
  });

  // Convert audio to video
  el.convertBtn.addEventListener('click', async () => {
    const file = el.audioFile.files[0];
    if (!file) return;

    // Stop preview if running
    if (app.isPreviewing) {
      stopPreview();
    }

    app.isConverting = true;
    el.convertBtn.disabled = true;
    el.convertBtn.style.display = 'none';
    el.cancelConvertBtn.style.display = 'inline-flex';
    progressBar.style.display = 'block';
    updateStatus('Converting audio to video...', 'recording');
    updateButtonStates();

    // Pause AudioRecorder visualization during conversion
    const wasVisualizationActive = recorder.isVisualizationActive;
    if (wasVisualizationActive) {
      recorder.stopVisualization();
    }

    try {
      const dimensions = app.getVideoDimensions();

      const result = await converter.convertWithFallback({
        audioSource: file,
        canvas,
        visualizer: el.visualizerSelect.value,
        visualizerOptions: getCurrentOptions(),
        fps: 30,
        videoWidth: dimensions.width,
        videoHeight: dimensions.height,
        format: el.videoFormat.value,
        onProgress: updateProgress,
      });

      // Check if fallback to WebM occurred
      if (result.usedFallback) {
        updateStatus('Conversion complete! ' + result.fallbackMessage, 'ready');
      } else {
        updateStatus('Conversion complete!', 'ready');
      }
      addRecording(result.blob);
    } catch (error) {
      if (error.message.includes('cancelled')) {
        updateStatus('Conversion cancelled', 'ready');
      } else {
        updateStatus('Error: ' + error.message, 'error');
      }
      console.error(error);
    } finally {
      app.isConverting = false;
      el.convertBtn.disabled = false;
      el.convertBtn.style.display = 'inline-flex';
      el.cancelConvertBtn.style.display = 'none';
      progressBar.style.display = 'none';
      updateProgress(0);
      updateButtonStates();

      // Resume AudioRecorder visualization if it was active before conversion
      if (wasVisualizationActive && recorder.sourceType) {
        recorder.resumeVisualization();
      }
    }
  });

  // Cancel conversion
  el.cancelConvertBtn.addEventListener('click', () => {
    converter.cancel();
    updateStatus('Cancelling conversion...', 'ready');
  });

  // ==================== CANVAS INTERACTION ====================

  // Canvas drag support for adjusting visualization position
  let canvasDragging = false;
  let canvasDragStartX = 0;
  let canvasDragStartY = 0;
  let canvasDragStartOffsetX = 0;
  let canvasDragStartOffsetY = 0;
  let isDraggingCenterImage = false;

  // Mouse drag handlers for canvas
  canvas.addEventListener('mousedown', (e) => {
    canvasDragging = true;
    canvasDragStartX = e.clientX;
    canvasDragStartY = e.clientY;

    // Check if Shift key is held and we're in circular mode with center image
    isDraggingCenterImage = e.shiftKey && el.visualizerSelect.value === 'circular' && app.currentCenterImageUrl;

    if (isDraggingCenterImage) {
      canvasDragStartOffsetX = parseInt(el.centerImageOffsetX.value);
      canvasDragStartOffsetY = parseInt(el.centerImageOffsetY.value);
    } else {
      canvasDragStartOffsetX = parseInt(el.offsetX.value);
      canvasDragStartOffsetY = parseInt(el.offsetY.value);
    }
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!canvasDragging) {
      // Update cursor based on hover position
      if (!canvasDragging && isMouseOverCenterImage(e)) {
        canvas.style.cursor = 'zoom-in';
        canvas.title = 'Scroll to zoom center image';
      } else if (!canvasDragging) {
        canvas.style.cursor = 'grab';
        canvas.title = '';
      }
      return;
    }

    const dx = e.clientX - canvasDragStartX;
    const dy = e.clientY - canvasDragStartY;

    if (isDraggingCenterImage) {
      // Drag center image position
      const newCenterOffsetX = Math.max(-100, Math.min(100, canvasDragStartOffsetX + dx));
      const newCenterOffsetY = Math.max(-100, Math.min(100, canvasDragStartOffsetY + dy));

      // Update sliders
      el.centerImageOffsetX.value = newCenterOffsetX;
      el.centerImageOffsetY.value = newCenterOffsetY;
      el.centerImageOffsetXValue.textContent = newCenterOffsetX + 'px';
      el.centerImageOffsetYValue.textContent = newCenterOffsetY + 'px';

      // Update visualizer
      recorder.setVisualizerOptions({
        custom: {
          centerImageOffsetX: newCenterOffsetX,
          centerImageOffsetY: newCenterOffsetY,
        },
      });
    } else {
      // Drag visualization position
      const newOffsetX = Math.max(-200, Math.min(200, canvasDragStartOffsetX + dx));
      const newOffsetY = Math.max(-200, Math.min(200, canvasDragStartOffsetY + dy));

      // Update sliders
      el.offsetX.value = newOffsetX;
      el.offsetY.value = newOffsetY;
      el.offsetXValue.textContent = newOffsetX + 'px';
      el.offsetYValue.textContent = newOffsetY + 'px';

      // Update visualizer
      recorder.setVisualizerOptions({ offsetX: newOffsetX, offsetY: newOffsetY });
    }
    updatePreview();
  });

  canvas.addEventListener('mouseup', () => {
    if (canvasDragging) {
      canvasDragging = false;
      isDraggingCenterImage = false;
      canvas.style.cursor = 'grab';
      saveSettings(getCurrentSettings());
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (canvasDragging) {
      canvasDragging = false;
      isDraggingCenterImage = false;
      canvas.style.cursor = 'grab';
      saveSettings(getCurrentSettings());
    }
  });

  // Set initial cursor for canvas
  canvas.style.cursor = 'grab';

  // Touch drag handlers for canvas (mobile support)
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      canvasDragging = true;
      canvasDragStartX = e.touches[0].clientX;
      canvasDragStartY = e.touches[0].clientY;
      canvasDragStartOffsetX = parseInt(el.offsetX.value);
      canvasDragStartOffsetY = parseInt(el.offsetY.value);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!canvasDragging) return;
    const dx = e.touches[0].clientX - canvasDragStartX;
    const dy = e.touches[0].clientY - canvasDragStartY;
    const newOffsetX = Math.max(-200, Math.min(200, canvasDragStartOffsetX + dx));
    const newOffsetY = Math.max(-200, Math.min(200, canvasDragStartOffsetY + dy));

    // Update sliders
    el.offsetX.value = newOffsetX;
    el.offsetY.value = newOffsetY;
    el.offsetXValue.textContent = newOffsetX + 'px';
    el.offsetYValue.textContent = newOffsetY + 'px';

    // Update visualizer
    recorder.setVisualizerOptions({ offsetX: newOffsetX, offsetY: newOffsetY });
    updatePreview();
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    if (canvasDragging) {
      canvasDragging = false;
      saveSettings(getCurrentSettings());
    }
  });

  // Helper function to check if mouse is over center image area
  function isMouseOverCenterImage(e) {
    if (el.visualizerSelect.value !== 'circular' || !app.currentCenterImageUrl) {
      return false;
    }

    // Get canvas bounding rect to convert page coordinates to canvas coordinates
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Calculate center and radius of the center image area
    const centerX = canvas.width / 2 + (parseInt(el.offsetX.value) || 0);
    const centerY = canvas.height / 2 + (parseInt(el.offsetY.value) || 0);
    const scale = (parseInt(el.visualizationScale.value) || 100) / 100;
    const minDimension = Math.min(canvas.width, canvas.height) * scale;
    const innerRadius = 0.3 * minDimension;
    const centerRadius = innerRadius * 0.9;

    // Check if mouse is within the center circle
    const distance = Math.sqrt((canvasX - centerX) ** 2 + (canvasY - centerY) ** 2);
    return distance <= centerRadius;
  }

  // Add scroll-to-zoom for center image when hovering over it
  canvas.addEventListener('wheel', (e) => {
    if (isMouseOverCenterImage(e)) {
      e.preventDefault();

      // Adjust center image zoom
      const currentZoom = parseInt(el.centerImageZoom.value);
      const step = 10;
      const delta = e.deltaY < 0 ? step : -step;
      const newZoom = Math.max(50, Math.min(300, currentZoom + delta));

      el.centerImageZoom.value = newZoom;
      el.centerImageZoomValue.textContent = newZoom + '%';
      recorder.setVisualizerOptions({
        custom: {
          centerImageZoom: newZoom / 100,
        },
      });
      saveSettings(getCurrentSettings());
      updatePreview();
    }
  }, { passive: false });

  // ==================== SLIDER ENHANCEMENTS ====================

  // Add mouse wheel support for all range sliders (only when focused/clicked)
  const rangeInputs = document.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(slider => {
    // Track whether slider is active (clicked or focused)
    let isSliderActive = false;

    slider.addEventListener('focus', () => {
      isSliderActive = true;
    });

    slider.addEventListener('blur', () => {
      isSliderActive = false;
    });

    slider.addEventListener('mousedown', () => {
      isSliderActive = true;
    });

    slider.addEventListener('wheel', (e) => {
      // Only handle wheel events when slider is focused/active
      if (!isSliderActive) {
        return;
      }

      e.preventDefault();
      const step = parseFloat(slider.step) || 1;
      const delta = e.deltaY < 0 ? step : -step;
      const newValue = parseFloat(slider.value) + delta;
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);

      if (newValue >= min && newValue <= max) {
        slider.value = newValue;
        // Trigger input event to update the visualization
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, { passive: false });
  });

  // Debug visual feature: Show boundaries during slider dragging
  rangeInputs.forEach(slider => {
    let debugVisualTimeout = null;

    // Show debug visual when slider is being dragged
    slider.addEventListener('input', () => {
      recorder.showDebugVisual();

      // Clear any existing timeout
      if (debugVisualTimeout) {
        clearTimeout(debugVisualTimeout);
      }

      // Hide debug visual after a short delay when dragging stops
      debugVisualTimeout = setTimeout(() => {
        recorder.hideDebugVisual();
      }, 500);
    });

    // Hide debug visual immediately when mouse is released
    slider.addEventListener('change', () => {
      if (debugVisualTimeout) {
        clearTimeout(debugVisualTimeout);
      }
      recorder.hideDebugVisual();
    });
  });

  // Hide debug visual when recording starts
  recorder.on('recording:start', () => {
    recorder.hideDebugVisual();
  });

  // ==================== KEYBOARD SHORTCUTS ====================

  document.addEventListener('keydown', (e) => {
    // Prevent shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    const startMicBtn = document.getElementById('startMic');
    const stopMicBtn = document.getElementById('stopMic');
    const startRecordBtn = document.getElementById('startRecord');
    const stopRecordBtn = document.getElementById('stopRecord');

    // Space: Start/Stop microphone
    if (e.code === 'Space') {
      e.preventDefault();
      if (!startMicBtn.disabled) {
        startMicBtn.click();
      } else if (!stopMicBtn.disabled) {
        stopMicBtn.click();
      }
    }

    // R: Start/Stop recording
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (!startRecordBtn.disabled) {
        startRecordBtn.click();
      } else if (!stopRecordBtn.disabled) {
        stopRecordBtn.click();
      }
    }

    // 1-8: Switch visualizers
    if (e.code >= 'Digit1' && e.code <= 'Digit8') {
      e.preventDefault();
      const visualizers = ['bars', 'waveform', 'circular', 'particles', 'spectrum-gradient', 'glow-waveform', 'vu-meter', 'spectrogram'];
      const index = parseInt(e.code.replace('Digit', '')) - 1;
      if (visualizers[index]) {
        el.visualizerSelect.value = visualizers[index];
        el.visualizerSelect.dispatchEvent(new Event('change'));
      }
    }

    // M: Toggle mirror mode
    if (e.code === 'KeyM') {
      e.preventDefault();
      el.mirror.checked = !el.mirror.checked;
      el.mirror.dispatchEvent(new Event('input'));
    }

    // Arrow keys: Adjust bar count
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const currentValue = parseInt(el.barCount.value);
      const step = 8;
      if (e.code === 'ArrowUp' && currentValue < 256) {
        el.barCount.value = Math.min(256, currentValue + step);
      } else if (e.code === 'ArrowDown' && currentValue > 16) {
        el.barCount.value = Math.max(16, currentValue - step);
      }
      el.barCount.dispatchEvent(new Event('input'));
    }

    // ? or /: Show keyboard shortcuts help
    if (e.key === '?' || e.key === '/') {
      e.preventDefault();
      alert(`Keyboard Shortcuts:

Space - Start/Stop Microphone
R - Start/Stop Recording
1-8 - Switch Visualizers:
  1=Bars, 2=Waveform, 3=Circular, 4=Particles
  5=Spectrum Gradient, 6=Glow Waveform, 7=VU Meter, 8=Spectrogram
M - Toggle Mirror Mode
↑/↓ - Adjust Bar Count
? or / - Show this help

Mouse:
Drag on canvas - Move visualization position`);
    }
  });

  // ==================== PRESENTATION MODE ====================

  // Check if running in Electron
  const isElectron = window.electronAPI && window.electronAPI.isElectron;

  // Track presentation mode state
  let isPresentationActive = false;
  let presentationFrameInterval = null;

  // Hide presentation tab warning if in Electron
  if (isElectron && el.presentationElectronOnly) {
    el.presentationElectronOnly.style.display = 'none';
  }

  // Disable presentation controls if not in Electron
  if (!isElectron) {
    el.togglePresentationBtn.disabled = true;
    el.togglePresentationBtn.title = 'Presentation mode requires Electron app';
    el.presentationWindowMode.disabled = true;
    el.presentationWindowType.disabled = true;
    el.presentationWidth.disabled = true;
    el.presentationHeight.disabled = true;
    el.presentationBgOpacity.disabled = true;
    el.presentationVisualizationOpacity.disabled = true;
    el.presentationClickThrough.disabled = true;
  }

  // Get current presentation settings
  function getPresentationSettings() {
    return {
      windowMode: el.presentationWindowMode.value,
      windowType: el.presentationWindowType.value,
      width: parseInt(el.presentationWidth.value),
      height: parseInt(el.presentationHeight.value),
      x: app.currentPresentationX,
      y: app.currentPresentationY,
      backgroundOpacity: parseFloat(el.presentationBgOpacity.value),
      visualizationOpacity: parseFloat(el.presentationVisualizationOpacity.value),
      clickThrough: el.presentationClickThrough.checked,
    };
  }

  // Start sending visualization frames to presentation window
  function startPresentationFrames() {
    if (presentationFrameInterval) {
      clearInterval(presentationFrameInterval);
    }

    // Send frames at ~30fps
    presentationFrameInterval = setInterval(() => {
      if (!isPresentationActive || !window.electronAPI) return;

      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      window.electronAPI.presentationSendFrame({
        imageData: imageData,
        width: canvas.width,
        height: canvas.height,
      });
    }, 33);
  }

  // Stop sending visualization frames
  function stopPresentationFrames() {
    if (presentationFrameInterval) {
      clearInterval(presentationFrameInterval);
      presentationFrameInterval = null;
    }
  }

  // Update presentation button UI
  function updatePresentationButton(active) {
    if (active) {
      el.togglePresentationBtn.classList.remove('btn-primary');
      el.togglePresentationBtn.classList.add('btn-danger');
      el.togglePresentationBtnText.textContent = 'Stop Presentation';
    } else {
      el.togglePresentationBtn.classList.remove('btn-danger');
      el.togglePresentationBtn.classList.add('btn-primary');
      el.togglePresentationBtnText.textContent = 'Start Presentation';
    }
  }

  // Toggle presentation mode
  async function togglePresentation() {
    if (!isElectron) return;

    if (isPresentationActive) {
      // Stop presentation
      try {
        await window.electronAPI.presentationStop();
        isPresentationActive = false;
        stopPresentationFrames();
        updatePresentationButton(false);
      } catch (error) {
        console.error('Failed to stop presentation:', error);
      }
    } else {
      // Start presentation
      try {
        const settings = getPresentationSettings();
        const result = await window.electronAPI.presentationStart(settings);
        if (result.success) {
          isPresentationActive = true;
          updatePresentationButton(true);

          // Send initial visualizer settings
          window.electronAPI.presentationSendVisualizerType(el.visualizerSelect.value);
          window.electronAPI.presentationSendVisualizerOptions(getCurrentOptions());

          // Start sending frames
          startPresentationFrames();
        }
      } catch (error) {
        console.error('Failed to start presentation:', error);
      }
    }
  }

  // Event: Toggle presentation button
  el.togglePresentationBtn.addEventListener('click', togglePresentation);

  // Event: Listen for presentation closed (from main process)
  if (isElectron) {
    window.electronAPI.onPresentationClosed(() => {
      isPresentationActive = false;
      stopPresentationFrames();
      updatePresentationButton(false);
    });

    // Event: Listen for presentation window position changes
    window.electronAPI.onPresentationPositionChanged(({ x, y }) => {
      app.currentPresentationX = x;
      app.currentPresentationY = y;
      saveSettings(getCurrentSettings());
    });
  }

  // Event: Window mode change
  el.presentationWindowMode.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        windowMode: el.presentationWindowMode.value,
      });
    }
  });

  // Event: Window type change
  el.presentationWindowType.addEventListener('change', async () => {
    el.presentationSizeControls.style.display = el.presentationWindowType.value === 'fullscreen' ? 'none' : 'grid';
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      const settings = getPresentationSettings();
      await window.electronAPI.presentationUpdate(settings);
    }
  });

  // Event: Window size change
  el.presentationWidth.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        width: parseInt(el.presentationWidth.value),
        height: parseInt(el.presentationHeight.value),
      });
    }
  });

  el.presentationHeight.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        width: parseInt(el.presentationWidth.value),
        height: parseInt(el.presentationHeight.value),
      });
    }
  });

  // Event: Background opacity change
  el.presentationBgOpacity.addEventListener('input', async () => {
    const opacity = parseFloat(el.presentationBgOpacity.value);
    const percent = Math.round(opacity * 100);
    el.presentationBgOpacityValue.textContent = percent === 0
      ? '0% (Transparent)'
      : percent === 100 ? '100% (Solid)' : percent + '%';
  });

  el.presentationBgOpacity.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        backgroundOpacity: parseFloat(el.presentationBgOpacity.value),
      });
    }
  });

  // Event: Visualization opacity change
  el.presentationVisualizationOpacity.addEventListener('input', async () => {
    const opacity = parseFloat(el.presentationVisualizationOpacity.value);
    const percent = Math.round(opacity * 100);
    el.presentationVisualizationOpacityValue.textContent = percent + '%';
  });

  el.presentationVisualizationOpacity.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        visualizationOpacity: parseFloat(el.presentationVisualizationOpacity.value),
      });
    }
  });

  // Event: Click-through toggle
  el.presentationClickThrough.addEventListener('change', async () => {
    saveSettings(getCurrentSettings());
    if (isPresentationActive && isElectron) {
      await window.electronAPI.presentationUpdate({
        clickThrough: el.presentationClickThrough.checked,
      });
    }
  });

  // Forward visualizer changes to presentation window
  const originalSetVisualizer = recorder.setVisualizer.bind(recorder);
  recorder.setVisualizer = async function(type, options) {
    const result = await originalSetVisualizer(type, options);
    if (isPresentationActive && isElectron) {
      window.electronAPI.presentationSendVisualizerType(type);
      window.electronAPI.presentationSendVisualizerOptions(options || getCurrentOptions());
    }
    return result;
  };

  const originalSetVisualizerOptions = recorder.setVisualizerOptions.bind(recorder);
  recorder.setVisualizerOptions = async function(options) {
    const result = await originalSetVisualizerOptions(options);
    if (isPresentationActive && isElectron) {
      window.electronAPI.presentationSendVisualizerOptions(getCurrentOptions());
    }
    return result;
  };

  console.log('Interactions module initialized. Presentation mode Electron:', isElectron);
}

// Initialize interactions when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInteractions);
} else {
  initInteractions();
}
