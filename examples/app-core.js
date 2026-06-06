/**
 * Audio Recorder with Visualization - Core Application
 * Core functionality: initialization, settings, recording, visualizer options
 */

// Global app state shared between modules
window.AudioRecorderApp = window.AudioRecorderApp || {};

(async function() {
  'use strict';

  // Wait for library to load
  await new Promise(resolve => {
    if (window.AudioRecorderVisualization) {
      resolve();
    } else {
      // Retry loading
      const interval = setInterval(() => {
        if (window.AudioRecorderVisualization) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    }
  });

  const { AudioRecorder, AudioToVideoConverter, AudioAnalyzer } = window.AudioRecorderVisualization;

  // Elements
  const canvas = document.getElementById('visualizer');
  const previewOverlay = document.getElementById('previewOverlay');
  const status = document.getElementById('status');
  const startMicBtn = document.getElementById('startMic');
  const stopMicBtn = document.getElementById('stopMic');
  const startRecordBtn = document.getElementById('startRecord');
  const stopRecordBtn = document.getElementById('stopRecord');
  const visualizerSelect = document.getElementById('visualizerSelect');
  const primaryColor = document.getElementById('primaryColor');
  const secondaryColor = document.getElementById('secondaryColor');
  const swapColorsBtn = document.getElementById('swapColorsBtn');
  const bgColor = document.getElementById('bgColor');
  const barCount = document.getElementById('barCount');
  const frequencyWidth = document.getElementById('frequencyWidth');
  const sensitivity = document.getElementById('sensitivity');
  // ADSR Envelope controls
  const adsrAccordion = document.getElementById('adsrAccordion');
  const adsrAccordionHeader = document.getElementById('adsrAccordionHeader');
  const adsrAttack = document.getElementById('adsrAttack');
  const adsrAttackValue = document.getElementById('adsrAttackValue');
  const adsrDecay = document.getElementById('adsrDecay');
  const adsrDecayValue = document.getElementById('adsrDecayValue');
  const adsrSustain = document.getElementById('adsrSustain');
  const adsrSustainValue = document.getElementById('adsrSustainValue');
  const adsrRelease = document.getElementById('adsrRelease');
  const adsrReleaseValue = document.getElementById('adsrReleaseValue');
  const bgImage = document.getElementById('bgImage');
  const mirror = document.getElementById('mirror');
  const mirrorHorizontal = document.getElementById('mirrorHorizontal');
  const visualizationAlpha = document.getElementById('visualizationAlpha');
  const alphaValue = document.getElementById('alphaValue');
  const offsetX = document.getElementById('offsetX');
  const offsetXValue = document.getElementById('offsetXValue');
  const offsetY = document.getElementById('offsetY');
  const offsetYValue = document.getElementById('offsetYValue');
  const visualizationScale = document.getElementById('visualizationScale');
  const scaleValue = document.getElementById('scaleValue');
  const recordingsList = document.getElementById('recordingsList');
  const saveAllRecordingsBtn = document.getElementById('saveAllRecordings');
  const audioFile = document.getElementById('audioFile');
  const convertBtn = document.getElementById('convertBtn');
  const cancelConvertBtn = document.getElementById('cancelConvertBtn');
  const previewBtn = document.getElementById('previewBtn');
  const stopPreviewBtn = document.getElementById('stopPreviewBtn');
  const loopPreviewCheckbox = document.getElementById('loopPreview');
  const progressFill = document.getElementById('progressFill');
  const videoQuality = document.getElementById('videoQuality');
  const aspectRatio = document.getElementById('aspectRatio');
  const videoDimensions = document.getElementById('videoDimensions');
  const bgSizeMode = document.getElementById('bgSizeMode');
  const customSizeControls = document.getElementById('customSizeControls');
  const bgCustomWidth = document.getElementById('bgCustomWidth');
  const bgCustomHeight = document.getElementById('bgCustomHeight');
  const layerEffect = document.getElementById('layerEffect');
  const layerEffectIntensity = document.getElementById('layerEffectIntensity');
  const layerEffectIntensityValue = document.getElementById('layerEffectIntensityValue');
  const useCustomColors = document.getElementById('useCustomColors');
  const centerImage = document.getElementById('centerImage');
  const centerImageControls = document.getElementById('centerImageControls');
  const centerImagePositionControls = document.getElementById('centerImagePositionControls');
  const centerImageZoom = document.getElementById('centerImageZoom');
  const centerImageZoomValue = document.getElementById('centerImageZoomValue');
  const centerImageOffsetX = document.getElementById('centerImageOffsetX');
  const centerImageOffsetXValue = document.getElementById('centerImageOffsetXValue');
  const centerImageOffsetY = document.getElementById('centerImageOffsetY');
  const centerImageOffsetYValue = document.getElementById('centerImageOffsetYValue');
  const barShapeControls = document.getElementById('barShapeControls');
  const barShapeSelect = document.getElementById('barShape');
  const particleShapeControls = document.getElementById('particleShapeControls');
  const particleShapeSelect = document.getElementById('particleShape');
  const videoFormat = document.getElementById('videoFormat');
  const audioEnhancementEnabled = document.getElementById('audioEnhancementEnabled');
  const audioEnhancementControls = document.getElementById('audioEnhancementControls');
  const noiseReduction = document.getElementById('noiseReduction');
  const noiseReductionValue = document.getElementById('noiseReductionValue');
  const noiseProfileFile = document.getElementById('noiseProfileFile');
  const noiseProfileFileName = document.getElementById('noiseProfileFileName');
  const noiseProfileReduction = document.getElementById('noiseProfileReduction');
  const noiseProfileReductionValue = document.getElementById('noiseProfileReductionValue');
  const noiseProfileVoiceProtection = document.getElementById('noiseProfileVoiceProtection');
  const noiseProfileVoiceProtectionValue = document.getElementById('noiseProfileVoiceProtectionValue');
  const clearNoiseProfile = document.getElementById('clearNoiseProfile');
  const smartNormalization = document.getElementById('smartNormalization');
  const smartNormalizationValue = document.getElementById('smartNormalizationValue');
  const saturation = document.getElementById('saturation');
  const saturationValue = document.getElementById('saturationValue');
  const saturationMode = document.getElementById('saturationMode');
  const saturationMin = document.getElementById('saturationMin');
  const saturationMinValue = document.getElementById('saturationMinValue');
  const saturationMax = document.getElementById('saturationMax');
  const saturationMaxValue = document.getElementById('saturationMaxValue');

  // Image blink controls
  const imageBlinkEnabled = document.getElementById('imageBlinkEnabled');
  const imageBlinkControls = document.getElementById('imageBlinkControls');
  const imageBlinkStyle = document.getElementById('imageBlinkStyle');
  const imageBlinkTarget = document.getElementById('imageBlinkTarget');
  const blinkFrequencyMin = document.getElementById('blinkFrequencyMin');
  const blinkFrequencyMax = document.getElementById('blinkFrequencyMax');
  const blinkFrequencyValue = document.getElementById('blinkFrequencyValue');
  const blinkThreshold = document.getElementById('blinkThreshold');
  const blinkThresholdValue = document.getElementById('blinkThresholdValue');
  const blinkIntensity = document.getElementById('blinkIntensity');
  const blinkIntensityValue = document.getElementById('blinkIntensityValue');
  const blinkDuration = document.getElementById('blinkDuration');
  const blinkDurationValue = document.getElementById('blinkDurationValue');

  // Blink debug mode controls
  const blinkDebugModeEnabled = document.getElementById('blinkDebugModeEnabled');
  const blinkDebugControls = document.getElementById('blinkDebugControls');
  const blinkDebugAudioFile = document.getElementById('blinkDebugAudioFile');
  const blinkDebugFileName = document.getElementById('blinkDebugFileName');
  const blinkWaveformContainer = document.getElementById('blinkWaveformContainer');
  const blinkWaveformCanvas = document.getElementById('blinkWaveformCanvas');
  const blinkSelectionOverlay = document.getElementById('blinkSelectionOverlay');
  const blinkIntervalDisplay = document.getElementById('blinkIntervalDisplay');
  const blinkWaveformStart = document.getElementById('blinkWaveformStart');
  const blinkWaveformEnd = document.getElementById('blinkWaveformEnd');
  const blinkPlayIntervalBtn = document.getElementById('blinkPlayIntervalBtn');
  const blinkClearIntervalBtn = document.getElementById('blinkClearIntervalBtn');
  const blinkExtractedParams = document.getElementById('blinkExtractedParams');
  const blinkExtractedFreq = document.getElementById('blinkExtractedFreq');
  const blinkExtractedThreshold = document.getElementById('blinkExtractedThreshold');
  const blinkManualControls = document.getElementById('blinkManualControls');

  // Presentation mode elements
  const presentationTab = document.getElementById('presentationTab');
  const togglePresentationBtn = document.getElementById('togglePresentationBtn');
  const togglePresentationBtnText = document.getElementById('togglePresentationBtnText');
  const presentationWindowMode = document.getElementById('presentationWindowMode');
  const presentationWindowType = document.getElementById('presentationWindowType');
  const presentationSizeControls = document.getElementById('presentationSizeControls');
  const presentationWidth = document.getElementById('presentationWidth');
  const presentationHeight = document.getElementById('presentationHeight');
  const presentationBgOpacity = document.getElementById('presentationBgOpacity');
  const presentationBgOpacityValue = document.getElementById('presentationBgOpacityValue');
  const presentationVisualizationOpacity = document.getElementById('presentationVisualizationOpacity');
  const presentationVisualizationOpacityValue = document.getElementById('presentationVisualizationOpacityValue');
  const presentationClickThrough = document.getElementById('presentationClickThrough');
  const presentationElectronOnly = document.getElementById('presentationElectronOnly');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const presetList = document.getElementById('presetList');
  const presetSettingsBtn = document.getElementById('presetSettingsBtn');
  const presetEdgeTrigger = document.getElementById('presetEdgeTrigger');
  const presetSidebar = document.getElementById('presetSidebar');
  const presetContextMenu = document.getElementById('presetContextMenu');
  const presetRenameBtn = document.getElementById('presetRenameBtn');
  const presetDeleteBtn = document.getElementById('presetDeleteBtn');
  const presetSaveModal = document.getElementById('presetSaveModal');
  const presetNameInput = document.getElementById('presetNameInput');
  const presetFolderInput = document.getElementById('presetFolderInput');
  const presetChooseFolderBtn = document.getElementById('presetChooseFolderBtn');
  const presetDontShowAgain = document.getElementById('presetDontShowAgain');
  const presetCancelSaveBtn = document.getElementById('presetCancelSaveBtn');
  const presetConfirmSaveBtn = document.getElementById('presetConfirmSaveBtn');
  const presetSettingsModal = document.getElementById('presetSettingsModal');
  const presetSettingsPathInput = document.getElementById('presetSettingsPathInput');
  const presetSettingsChooseFolderBtn = document.getElementById('presetSettingsChooseFolderBtn');
  const presetSettingsCloseBtn = document.getElementById('presetSettingsCloseBtn');
  const presetRenameModal = document.getElementById('presetRenameModal');
  const presetRenameInput = document.getElementById('presetRenameInput');
  const presetCancelRenameBtn = document.getElementById('presetCancelRenameBtn');
  const presetConfirmRenameBtn = document.getElementById('presetConfirmRenameBtn');

  // Settings persistence
  const SETTINGS_KEY = 'audio-recorder-settings';
  const ACCORDION_STATE_KEY = 'audio-recorder-accordion-states';
  const PRESETS_KEY = 'audio-recorder-presets';
  const PRESET_OPTIONS_KEY = 'audio-recorder-preset-options';
  const ACTIVE_PRESET_KEY = 'audio-recorder-active-preset-id';

  // Default settings
  const defaultSettings = {
    visualizer: 'bars',
    primaryColor: '#00ff88',
    secondaryColor: '#0088ff',
    backgroundColor: '#000000',
    barCount: 64,
    frequencyWidth: 100,
    sensitivity: 1.0,
    // ADSR envelope settings
    adsrAttack: 20,
    adsrDecay: 30,
    adsrSustain: 10,
    adsrRelease: 50,
    mirror: false,
    mirrorHorizontal: false,
    visualizationAlpha: 1,
    offsetX: 0,
    offsetY: 0,
    scale: 100,
    backgroundImage: null,
    backgroundSizeMode: 'cover',
    backgroundWidth: 800,
    backgroundHeight: 400,
    videoQuality: '1080p',
    aspectRatio: '16:9',
    videoFormat: 'webm',
    layerEffect: 'none',
    layerEffectIntensity: 50,
    useCustomColors: false,
    centerImage: null,
    centerImageZoom: 100,
    centerImageOffsetX: 0,
    centerImageOffsetY: 0,
    barShape: 'rounded',
    particleShape: 'circle',
    audioEnhancementEnabled: false,
    noiseReduction: 0,
    noiseProfile: null,
    noiseProfileName: null,
    noiseProfileReduction: 45,
    noiseProfileVoiceProtection: 85,
    smartNormalization: 0,
    saturation: 0,
    saturationMode: 'soft-clip',
    saturationMin: 20,
    saturationMax: 20000,
    imageBlinkEnabled: false,
    imageBlinkStyle: 'gradient-sweep',
    imageBlinkTarget: 'background',
    imageBlinkFrequencyMin: 60,
    imageBlinkFrequencyMax: 250,
    imageBlinkThreshold: 200,
    imageBlinkIntensity: 80,
    imageBlinkDuration: 150,
    // Blink debug mode settings
    blinkDebugModeEnabled: false,
    blinkDebugAudioData: null, // base64 encoded audio data
    blinkDebugAudioName: null, // original filename
    blinkDebugIntervalStart: 0, // interval start time in seconds
    blinkDebugIntervalEnd: 0, // interval end time in seconds
    // Presentation mode settings
    presentationWindowMode: 'alwaysOnTop',
    presentationWindowType: 'frameless',
    presentationWidth: 800,
    presentationHeight: 600,
    presentationX: null, // null = auto-center, otherwise use saved position
    presentationY: null,
    presentationBgOpacity: 0,
    presentationVisualizationOpacity: 1,
    presentationClickThrough: true,
  };

  // Load settings from localStorage
  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return defaultSettings;
  }

  // Save settings to localStorage
  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
    updateActivePresetIndicator();
  }

  function loadPresets() {
    try {
      const saved = localStorage.getItem(PRESETS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load presets:', error);
      return [];
    }
  }

  function savePresets(presets) {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
      console.warn('Failed to save presets:', error);
    }
  }

  function loadPresetOptions() {
    try {
      const saved = localStorage.getItem(PRESET_OPTIONS_KEY);
      return saved ? JSON.parse(saved) : { savePath: '', skipDialog: false };
    } catch (error) {
      console.warn('Failed to load preset options:', error);
      return { savePath: '', skipDialog: false };
    }
  }

  function savePresetOptions(options) {
    try {
      localStorage.setItem(PRESET_OPTIONS_KEY, JSON.stringify(options));
    } catch (error) {
      console.warn('Failed to save preset options:', error);
    }
  }

  function loadActivePresetId() {
    try {
      return localStorage.getItem(ACTIVE_PRESET_KEY);
    } catch (error) {
      console.warn('Failed to load active preset:', error);
      return null;
    }
  }

  function saveActivePresetId(presetId) {
    try {
      if (presetId) {
        localStorage.setItem(ACTIVE_PRESET_KEY, presetId);
      } else {
        localStorage.removeItem(ACTIVE_PRESET_KEY);
      }
    } catch (error) {
      console.warn('Failed to save active preset:', error);
    }
  }

  // Accordion state management
  function loadAccordionStates() {
    try {
      const saved = localStorage.getItem(ACCORDION_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load accordion states:', error);
    }
    // Default: all sections expanded
    return {
      visualizer: true,
      colors: true,
      animation: true,
      background: true,
      transform: true,
      effects: true,
      audioEnhancement: true,
      imageBlink: true
    };
  }

  function saveAccordionStates(states) {
    try {
      localStorage.setItem(ACCORDION_STATE_KEY, JSON.stringify(states));
    } catch (error) {
      console.warn('Failed to save accordion states:', error);
    }
  }

  // Initialize accordions
  function initializeAccordions() {
    const sections = document.querySelectorAll('.settings-section[data-section]');
    const accordionStates = loadAccordionStates();

    sections.forEach(section => {
      const sectionName = section.getAttribute('data-section');
      const header = section.querySelector('.settings-section-header');
      const isExpanded = accordionStates[sectionName] !== false; // Default to true

      // Set initial state
      if (isExpanded) {
        section.classList.add('expanded');
        header.setAttribute('aria-expanded', 'true');
      } else {
        header.setAttribute('aria-expanded', 'false');
      }

      // Add click handler
      header.addEventListener('click', () => {
        const wasExpanded = section.classList.toggle('expanded');
        header.setAttribute('aria-expanded', wasExpanded);

        // Save state
        accordionStates[sectionName] = wasExpanded;
        saveAccordionStates(accordionStates);
      });
    });
  }

  // Track background image URL
  let currentBackgroundImageUrl = null;
  let currentCenterImageUrl = null;
  let currentNoiseProfile = null;
  let currentNoiseProfileName = null;

  // Blink debug mode state
  let blinkDebugAudioBuffer = null;
  let blinkDebugAudioContext = null;
  let blinkDebugAudioSource = null;
  let blinkDebugAudioDuration = 0;
  let blinkDebugIntervalStartTime = 0;
  let blinkDebugIntervalEndTime = 0;
  let blinkDebugIsSelecting = false;
  let blinkDebugSelectionStartX = 0;
  let blinkDebugAudioDataUrl = null;
  let blinkDebugAudioFileName = null;

  // Track presentation window position (null = auto-center)
  let currentPresentationX = null;
  let currentPresentationY = null;
  let presets = loadPresets();
  let presetOptions = loadPresetOptions();
  let activePresetMenuId = null;
  let activeLoadedPresetId = loadActivePresetId();
  let presetRenameTargetId = null;
  let draggedPresetId = null;
  let presetSidebarCloseTimer = null;
  const savedRecordings = [];

  function getVideoExtension(blob, fallbackFormat) {
    if (blob && typeof blob.type === 'string') {
      if (blob.type.includes('mp4')) {
        return 'mp4';
      }
      if (blob.type.includes('webm')) {
        return 'webm';
      }
    }
    return fallbackFormat || 'webm';
  }

  function sanitizeFileBaseName(fileName) {
    return (fileName || 'recording')
      .replace(/\.[^/.]+$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'recording';
  }

  function buildRecordingFileName(sourceName, blob, format) {
    const extension = getVideoExtension(blob, format);
    if (sourceName) {
      return `${sanitizeFileBaseName(sourceName)}.${extension}`;
    }
    return `recording-${recordingCount}.${extension}`;
  }

  function triggerBrowserDownload(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function saveRecording(recording, button) {
    const isElectron = window.electronAPI && window.electronAPI.isElectron;

    if (isElectron) {
      const result = await window.electronAPI.saveVideoAndShow(recording.blob, recording.fileName);
      if (!result.success && !result.canceled) {
        throw new Error(result.error || 'Failed to save video');
      }
      return result;
    }

    triggerBrowserDownload(recording.url, recording.fileName);
    return { success: true };
  }

  async function saveAllRecordings() {
    if (!savedRecordings.length || saveAllRecordingsBtn.disabled) {
      return;
    }

    const originalText = saveAllRecordingsBtn.textContent;
    saveAllRecordingsBtn.disabled = true;
    saveAllRecordingsBtn.textContent = 'Saving...';

    try {
      if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.saveAllVideosAndShow) {
        const result = await window.electronAPI.saveAllVideosAndShow(savedRecordings);
        if (!result.success && !result.canceled) {
          throw new Error(result.error || 'Failed to save videos');
        }
      } else {
        for (let i = 0; i < savedRecordings.length; i++) {
          saveAllRecordingsBtn.textContent = `Saving ${i + 1}/${savedRecordings.length}...`;
          await saveRecording(savedRecordings[i], saveAllRecordingsBtn);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      saveAllRecordingsBtn.textContent = 'Saved All';
      setTimeout(() => {
        saveAllRecordingsBtn.textContent = originalText;
        saveAllRecordingsBtn.disabled = savedRecordings.length === 0;
      }, 2000);
    } catch (error) {
      console.error('Error saving all recordings:', error);
      saveAllRecordingsBtn.textContent = 'Error - Try Again';
      setTimeout(() => {
        saveAllRecordingsBtn.textContent = originalText;
        saveAllRecordingsBtn.disabled = savedRecordings.length === 0;
      }, 2000);
    }
  }

  if (saveAllRecordingsBtn) {
    saveAllRecordingsBtn.addEventListener('click', saveAllRecordings);
  }

  // Get current settings from UI
  function getCurrentSettings() {
    return {
      visualizer: visualizerSelect.value,
      primaryColor: primaryColor.value,
      secondaryColor: secondaryColor.value,
      backgroundColor: bgColor.value,
      barCount: parseInt(barCount.value),
      frequencyWidth: parseInt(frequencyWidth.value),
      sensitivity: parseFloat(sensitivity.value),
      // ADSR envelope settings
      adsrAttack: parseInt(adsrAttack.value),
      adsrDecay: parseInt(adsrDecay.value),
      adsrSustain: parseInt(adsrSustain.value),
      adsrRelease: parseInt(adsrRelease.value),
      mirror: mirror.checked,
      mirrorHorizontal: mirrorHorizontal.checked,
      visualizationAlpha: parseFloat(visualizationAlpha.value),
      offsetX: parseInt(offsetX.value),
      offsetY: parseInt(offsetY.value),
      scale: parseInt(visualizationScale.value),
      backgroundImage: currentBackgroundImageUrl,
      backgroundSizeMode: bgSizeMode.value,
      backgroundWidth: parseInt(bgCustomWidth.value),
      backgroundHeight: parseInt(bgCustomHeight.value),
      videoQuality: videoQuality.value,
      aspectRatio: aspectRatio.value,
      videoFormat: videoFormat.value,
      layerEffect: layerEffect.value,
      layerEffectIntensity: parseInt(layerEffectIntensity.value),
      useCustomColors: useCustomColors.checked,
      centerImage: currentCenterImageUrl,
      centerImageZoom: parseInt(centerImageZoom.value),
      centerImageOffsetX: parseInt(centerImageOffsetX.value),
      centerImageOffsetY: parseInt(centerImageOffsetY.value),
      barShape: barShapeSelect.value,
      particleShape: particleShapeSelect.value,
      audioEnhancementEnabled: audioEnhancementEnabled.checked,
      noiseReduction: parseInt(noiseReduction.value),
      noiseProfile: currentNoiseProfile,
      noiseProfileName: currentNoiseProfileName,
      noiseProfileReduction: parseInt(noiseProfileReduction.value),
      noiseProfileVoiceProtection: parseInt(noiseProfileVoiceProtection.value),
      smartNormalization: parseInt(smartNormalization.value),
      saturation: parseInt(saturation.value),
      saturationMode: saturationMode.value,
      saturationMin: parseInt(saturationMin.value),
      saturationMax: parseInt(saturationMax.value),
      imageBlinkEnabled: imageBlinkEnabled.checked,
      imageBlinkStyle: imageBlinkStyle.value,
      imageBlinkTarget: imageBlinkTarget.value,
      imageBlinkFrequencyMin: parseInt(blinkFrequencyMin.value),
      imageBlinkFrequencyMax: parseInt(blinkFrequencyMax.value),
      imageBlinkThreshold: parseInt(blinkThreshold.value),
      imageBlinkIntensity: parseInt(blinkIntensity.value),
      imageBlinkDuration: parseInt(blinkDuration.value),
      // Blink debug mode settings
      blinkDebugModeEnabled: blinkDebugModeEnabled.checked,
      blinkDebugAudioData: blinkDebugAudioDataUrl,
      blinkDebugAudioName: blinkDebugAudioFileName,
      blinkDebugIntervalStart: blinkDebugIntervalStartTime,
      blinkDebugIntervalEnd: blinkDebugIntervalEndTime,
      // Presentation mode settings
      presentationWindowMode: presentationWindowMode.value,
      presentationWindowType: presentationWindowType.value,
      presentationWidth: parseInt(presentationWidth.value),
      presentationHeight: parseInt(presentationHeight.value),
      presentationX: currentPresentationX,
      presentationY: currentPresentationY,
      presentationBgOpacity: parseFloat(presentationBgOpacity.value),
      presentationVisualizationOpacity: parseFloat(presentationVisualizationOpacity.value),
      presentationClickThrough: presentationClickThrough.checked,
    };
  }

  function normalizeSettings(settings = {}) {
    return { ...defaultSettings, ...(settings || {}) };
  }

  function sortSerializableValue(value) {
    if (Array.isArray(value)) {
      return value.map(sortSerializableValue);
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((sorted, key) => {
        sorted[key] = sortSerializableValue(value[key]);
        return sorted;
      }, {});
    }
    return value;
  }

  function settingsMatch(leftSettings, rightSettings) {
    return JSON.stringify(sortSerializableValue(normalizeSettings(leftSettings))) ===
      JSON.stringify(sortSerializableValue(normalizeSettings(rightSettings)));
  }

  function savedPresetFieldsMatch(currentSettings, presetSettings = {}) {
    if (Object.keys(presetSettings || {}).length === 0) {
      return settingsMatch(currentSettings, presetSettings);
    }

    const normalizedCurrent = sortSerializableValue(normalizeSettings(currentSettings));
    const normalizedPreset = sortSerializableValue(presetSettings || {});

    return Object.keys(normalizedPreset).every(key => (
      JSON.stringify(normalizedCurrent[key]) === JSON.stringify(normalizedPreset[key])
    ));
  }

  function isPresetCurrentlyActive(preset) {
    return Boolean(
      activeLoadedPresetId &&
      preset &&
      preset.id === activeLoadedPresetId &&
      savedPresetFieldsMatch(getCurrentSettings(), preset.settings)
    );
  }

  function updateActivePresetIndicator() {
    const buttons = presetList.querySelectorAll('.preset-load-btn');
    const activePreset = presets.find(item => item.id === activeLoadedPresetId);
    if (activeLoadedPresetId && !isPresetCurrentlyActive(activePreset)) {
      activeLoadedPresetId = null;
      saveActivePresetId(null);
    }

    buttons.forEach(button => {
      const preset = presets.find(item => item.id === button.dataset.presetId);
      const isActive = isPresetCurrentlyActive(preset);
      button.classList.toggle('is-active', isActive);

      if (isActive) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }

  // Apply settings to UI
  function applySettings(settings) {
    visualizerSelect.value = settings.visualizer;
    primaryColor.value = settings.primaryColor;
    secondaryColor.value = settings.secondaryColor;
    bgColor.value = settings.backgroundColor;
    barCount.value = settings.barCount;
    document.getElementById('barCountValue').textContent = settings.barCount;
    frequencyWidth.value = settings.frequencyWidth || 100;
    document.getElementById('frequencyWidthValue').textContent = (settings.frequencyWidth || 100) + '%';
    sensitivity.value = settings.sensitivity ?? 1.0;
    document.getElementById('sensitivityValue').textContent = (settings.sensitivity ?? 1.0).toFixed(1) + 'x';
    // ADSR envelope settings
    adsrAttack.value = settings.adsrAttack ?? 20;
    adsrAttackValue.textContent = (settings.adsrAttack ?? 20) + '%';
    adsrDecay.value = settings.adsrDecay ?? 30;
    adsrDecayValue.textContent = (settings.adsrDecay ?? 30) + '%';
    adsrSustain.value = settings.adsrSustain ?? 10;
    adsrSustainValue.textContent = (settings.adsrSustain ?? 10) + '%';
    adsrRelease.value = settings.adsrRelease ?? 50;
    adsrReleaseValue.textContent = (settings.adsrRelease ?? 50) + '%';
    mirror.checked = settings.mirror;
    mirrorHorizontal.checked = settings.mirrorHorizontal || false;
    visualizationAlpha.value = settings.visualizationAlpha;
    alphaValue.textContent = Math.round(settings.visualizationAlpha * 100) + '%';
    offsetX.value = settings.offsetX;
    offsetXValue.textContent = settings.offsetX + 'px';
    offsetY.value = settings.offsetY;
    offsetYValue.textContent = settings.offsetY + 'px';
    visualizationScale.value = settings.scale || 100;
    scaleValue.textContent = (settings.scale || 100) + '%';
    bgSizeMode.value = settings.backgroundSizeMode || 'cover';
    bgCustomWidth.value = settings.backgroundWidth || 800;
    bgCustomHeight.value = settings.backgroundHeight || 400;
    videoQuality.value = settings.videoQuality || '1080p';
    aspectRatio.value = settings.aspectRatio || '16:9';
    layerEffect.value = settings.layerEffect || 'none';
    layerEffectIntensity.value = settings.layerEffectIntensity || 50;
    layerEffectIntensityValue.textContent = (settings.layerEffectIntensity || 50) + '%';

    // Show/hide custom size controls based on mode
    customSizeControls.style.display = settings.backgroundSizeMode === 'custom' ? 'grid' : 'none';

    // Use custom colors setting
    useCustomColors.checked = settings.useCustomColors || false;

    currentBackgroundImageUrl = settings.backgroundImage || null;
    currentCenterImageUrl = settings.centerImage || null;

    // Show/hide center image controls based on visualizer
    const isCircular = settings.visualizer === 'circular';
    centerImageControls.style.display = isCircular ? 'grid' : 'none';

    // Show center image position controls only if circular and has center image
    const hasCenterImage = Boolean(currentCenterImageUrl);
    centerImagePositionControls.style.display = (isCircular && hasCenterImage) ? 'grid' : 'none';

    // Center image zoom and offset settings
    centerImageZoom.value = settings.centerImageZoom || 100;
    centerImageZoomValue.textContent = (settings.centerImageZoom || 100) + '%';
    centerImageOffsetX.value = settings.centerImageOffsetX || 0;
    centerImageOffsetXValue.textContent = (settings.centerImageOffsetX || 0) + 'px';
    centerImageOffsetY.value = settings.centerImageOffsetY || 0;
    centerImageOffsetYValue.textContent = (settings.centerImageOffsetY || 0) + 'px';

    // Image blink settings
    imageBlinkEnabled.checked = settings.imageBlinkEnabled || false;
    imageBlinkStyle.value = settings.imageBlinkStyle || 'gradient-sweep';
    imageBlinkTarget.value = settings.imageBlinkTarget || 'background';
    blinkFrequencyMin.value = settings.imageBlinkFrequencyMin || 60;
    blinkFrequencyMax.value = settings.imageBlinkFrequencyMax || 250;
    blinkFrequencyValue.textContent = `${settings.imageBlinkFrequencyMin || 60} - ${settings.imageBlinkFrequencyMax || 250}`;
    blinkThreshold.value = settings.imageBlinkThreshold || 200;
    blinkThresholdValue.textContent = settings.imageBlinkThreshold || 200;
    blinkIntensity.value = settings.imageBlinkIntensity || 80;
    blinkIntensityValue.textContent = `${settings.imageBlinkIntensity || 80}%`;
    blinkDuration.value = settings.imageBlinkDuration || 150;
    blinkDurationValue.textContent = `${settings.imageBlinkDuration || 150}ms`;

    // Show/hide image blink controls
    imageBlinkControls.style.display = (settings.imageBlinkEnabled || false) ? 'grid' : 'none';

    // Video format setting
    videoFormat.value = settings.videoFormat || 'webm';

    // Bar and particle shape settings
    barShapeSelect.value = settings.barShape || 'rounded';
    particleShapeSelect.value = settings.particleShape || 'circle';

    // Audio enhancement settings
    audioEnhancementEnabled.checked = settings.audioEnhancementEnabled || false;
    audioEnhancementControls.style.display = audioEnhancementEnabled.checked ? 'grid' : 'none';
    noiseReduction.value = settings.noiseReduction || 0;
    noiseReductionValue.textContent = (settings.noiseReduction || 0) + '%';
    currentNoiseProfile = settings.noiseProfile || null;
    currentNoiseProfileName = settings.noiseProfileName || null;
    noiseProfileFileName.textContent = currentNoiseProfileName
      ? `${currentNoiseProfileName} (${currentNoiseProfile?.bands?.length || 0} bands)`
      : 'No profile loaded';
    clearNoiseProfile.disabled = !currentNoiseProfile;
    noiseProfileReduction.value = settings.noiseProfileReduction ?? 45;
    noiseProfileReductionValue.textContent = (settings.noiseProfileReduction ?? 45) + '%';
    noiseProfileVoiceProtection.value = settings.noiseProfileVoiceProtection ?? 85;
    noiseProfileVoiceProtectionValue.textContent = (settings.noiseProfileVoiceProtection ?? 85) + '%';
    smartNormalization.value = settings.smartNormalization || 0;
    smartNormalizationValue.textContent = (settings.smartNormalization || 0) + '%';
    saturation.value = settings.saturation || 0;
    saturationValue.textContent = (settings.saturation || 0) + '%';
    saturationMode.value = settings.saturationMode || 'soft-clip';
    saturationMin.value = settings.saturationMin || 20;
    saturationMinValue.textContent = settings.saturationMin || 20;
    saturationMax.value = settings.saturationMax || 20000;
    saturationMaxValue.textContent = settings.saturationMax || 20000;

    // Show/hide shape controls based on visualizer type
    const isBars = settings.visualizer === 'bars';
    const isParticles = settings.visualizer === 'particles';
    barShapeControls.style.display = isBars ? 'grid' : 'none';
    particleShapeControls.style.display = isParticles ? 'grid' : 'none';

    // Blink debug mode settings
    blinkDebugModeEnabled.checked = settings.blinkDebugModeEnabled || false;
    blinkDebugControls.style.display = settings.blinkDebugModeEnabled ? 'block' : 'none';
    blinkManualControls.style.display = settings.blinkDebugModeEnabled ? 'none' : 'block';

    // Restore debug audio data if saved
    if (settings.blinkDebugAudioData) {
      blinkDebugAudioDataUrl = settings.blinkDebugAudioData;
      blinkDebugAudioFileName = settings.blinkDebugAudioName;
      blinkDebugIntervalStartTime = settings.blinkDebugIntervalStart || 0;
      blinkDebugIntervalEndTime = settings.blinkDebugIntervalEnd || 0;
      if (blinkDebugAudioFileName) {
        blinkDebugFileName.textContent = blinkDebugAudioFileName;
      }
    }

    // Apply presentation mode settings
    presentationWindowMode.value = settings.presentationWindowMode || 'alwaysOnTop';
    presentationWindowType.value = settings.presentationWindowType || 'frameless';
    presentationWidth.value = settings.presentationWidth || 800;
    presentationHeight.value = settings.presentationHeight || 600;
    presentationBgOpacity.value = settings.presentationBgOpacity || 0;
    const bgOpacityPercent = Math.round((settings.presentationBgOpacity || 0) * 100);
    presentationBgOpacityValue.textContent = bgOpacityPercent === 0
      ? '0% (Transparent)'
      : bgOpacityPercent === 100 ? '100% (Solid)' : bgOpacityPercent + '%';
    presentationVisualizationOpacity.value = settings.presentationVisualizationOpacity !== undefined ? settings.presentationVisualizationOpacity : 1;
    const vizOpacityPercent = Math.round((settings.presentationVisualizationOpacity !== undefined ? settings.presentationVisualizationOpacity : 1) * 100);
    presentationVisualizationOpacityValue.textContent = vizOpacityPercent + '%';
    presentationClickThrough.checked = settings.presentationClickThrough !== false;
    // Show/hide size controls based on window type
    presentationSizeControls.style.display = settings.presentationWindowType === 'fullscreen' ? 'none' : 'grid';

    // Restore presentation position
    currentPresentationX = settings.presentationX;
    currentPresentationY = settings.presentationY;
  }

  // Initialize accordions
  initializeAccordions();

  const qualityDimensions = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
    '2160p': { width: 3840, height: 2160 },
  };

  function getVideoDimensions() {
    const base = qualityDimensions[videoQuality.value] || qualityDimensions['1080p'];
    const [ratioWidth, ratioHeight] = (aspectRatio.value || '16:9')
      .split(':')
      .map(value => parseInt(value, 10));

    if (!ratioWidth || !ratioHeight) {
      return base;
    }

    if (ratioWidth >= ratioHeight) {
      return {
        width: base.width,
        height: Math.round(base.width * ratioHeight / ratioWidth),
      };
    }

    return {
      width: Math.round(base.height * ratioWidth / ratioHeight),
      height: base.height,
    };
  }

  function applyVideoDimensions(redraw = true) {
    const dimensions = getVideoDimensions();
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    videoDimensions.textContent = `${dimensions.width} x ${dimensions.height}`;
    updatePreviewGuides();
    if (redraw) {
      updatePreview();
    }
  }

  // Load and apply saved settings on startup
  const savedSettings = loadSettings();
  applySettings(savedSettings);
  applyVideoDimensions(false);

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Initialize AudioRecorder with saved settings
  const visualizerOptions = {
    primaryColor: savedSettings.primaryColor,
    secondaryColor: savedSettings.secondaryColor,
    backgroundColor: savedSettings.backgroundColor,
    barCount: savedSettings.barCount,
    frequencyWidth: savedSettings.frequencyWidth || 100,
    // ADSR envelope settings
    adsrAttack: savedSettings.adsrAttack ?? 20,
    adsrDecay: savedSettings.adsrDecay ?? 30,
    adsrSustain: savedSettings.adsrSustain ?? 10,
    adsrRelease: savedSettings.adsrRelease ?? 50,
    mirror: savedSettings.mirror,
    mirrorHorizontal: savedSettings.mirrorHorizontal || false,
    visualizationAlpha: savedSettings.visualizationAlpha,
    offsetX: savedSettings.offsetX,
    offsetY: savedSettings.offsetY,
    scale: (savedSettings.scale || 100) / 100,
    layerEffect: savedSettings.layerEffect || 'none',
    layerEffectIntensity: savedSettings.layerEffectIntensity || 50,
    backgroundSizeMode: savedSettings.backgroundSizeMode || 'cover',
    backgroundWidth: savedSettings.backgroundWidth,
    backgroundHeight: savedSettings.backgroundHeight,
    custom: {
      useColorGradient: savedSettings.useCustomColors || false,
      useCustomColors: savedSettings.useCustomColors || false,
    },
  };

  // Add background image if it was saved
  if (savedSettings.backgroundImage) {
    visualizerOptions.backgroundImage = savedSettings.backgroundImage;
  }

  // Add center image and its settings if it was saved (for circular visualizer)
  if (savedSettings.centerImage) {
    visualizerOptions.custom.centerImage = savedSettings.centerImage;
    visualizerOptions.custom.centerImageZoom = (savedSettings.centerImageZoom || 100) / 100;
    visualizerOptions.custom.centerImageOffsetX = savedSettings.centerImageOffsetX || 0;
    visualizerOptions.custom.centerImageOffsetY = savedSettings.centerImageOffsetY || 0;
  }

  // Add custom color scheme/fillStyle if using custom colors (for spectrogram/spectrum-gradient)
  if (savedSettings.useCustomColors) {
    visualizerOptions.custom.colorScheme = 'custom';
    visualizerOptions.custom.fillStyle = 'custom';
  }

  // Add bar shape if saved
  if (savedSettings.barShape) {
    visualizerOptions.custom.barShape = savedSettings.barShape;
  }

  // Add particle shape if saved
  if (savedSettings.particleShape) {
    visualizerOptions.custom.particleShape = savedSettings.particleShape;
  }

  // Add image blink settings if enabled
  if (savedSettings.imageBlinkEnabled) {
    visualizerOptions.imageBlinkEnabled = true;
    visualizerOptions.imageBlinkFrequencyRange = {
      min: savedSettings.imageBlinkFrequencyMin || 60,
      max: savedSettings.imageBlinkFrequencyMax || 250,
    };
    visualizerOptions.imageBlinkVolumeThreshold = savedSettings.imageBlinkThreshold || 200;
    visualizerOptions.imageBlinkStyle = savedSettings.imageBlinkStyle || 'gradient-sweep';
    visualizerOptions.imageBlinkIntensity = savedSettings.imageBlinkIntensity || 80;
    visualizerOptions.imageBlinkTarget = savedSettings.imageBlinkTarget || 'background';
    visualizerOptions.imageBlinkDuration = savedSettings.imageBlinkDuration || 150;
  }

  const recorder = new AudioRecorder({
    canvas,
    fftSize: 2048,
    fps: 30,
    visualizer: savedSettings.visualizer,
    visualizerOptions,
    audioEnhancement: {
      enabled: savedSettings.audioEnhancementEnabled || false,
      noiseReduction: savedSettings.noiseReduction || 0,
      noiseProfile: savedSettings.noiseProfile || null,
      noiseProfileReduction: savedSettings.noiseProfileReduction ?? 45,
      noiseProfileVoiceProtection: savedSettings.noiseProfileVoiceProtection ?? 85,
      smartNormalization: savedSettings.smartNormalization || 0,
      saturation: savedSettings.saturation || 0,
      saturationFrequencyRange: {
        min: savedSettings.saturationMin || 20,
        max: savedSettings.saturationMax || 20000,
      },
      saturationMode: savedSettings.saturationMode || 'soft-clip',
    },
    debug: true,
  });

  // Wait for recorder to be fully initialized then draw initial frame
  recorder.ready().then(() => {
    // Draw initial preview frame to show the visualization settings
    recorder.showDemoVisualization(100);
  });

  // Initialize converter
  const converter = new AudioToVideoConverter({ debug: true });
  initializePresetControls();

  // Recording counter
  let recordingCount = 0;

  // Track recording state for UI safety
  let isRecording = false;
  let isConverting = false;
  let isPreviewing = false;
  let previewAudioElement = null;

  // Update status
  function updateStatus(message, type = 'ready') {
    status.textContent = message;
    status.className = 'status ' + type;
  }

  // Update button states based on current recording/conversion state
  function updateButtonStates() {
    const isMicActive = recorder.sourceType === 'microphone';
    const isBusy = isRecording || isConverting;

    // Microphone controls
    startMicBtn.disabled = isMicActive || isBusy;
    stopMicBtn.disabled = !isMicActive || isRecording;

    // Recording controls
    startRecordBtn.disabled = !isMicActive || isRecording || isConverting;
    stopRecordBtn.disabled = !isRecording;

    // Tab switching - disable the other tab during recording/conversion
    const micTab = document.querySelector('.tab[data-tab="microphone"]');
    const convertTab = document.querySelector('.tab[data-tab="convert"]');
    if (micTab && convertTab) {
      if (isRecording) {
        convertTab.disabled = true;
        convertTab.style.pointerEvents = 'none';
        convertTab.style.opacity = '0.5';
      } else if (isConverting) {
        micTab.disabled = true;
        micTab.style.pointerEvents = 'none';
        micTab.style.opacity = '0.5';
      } else {
        micTab.disabled = false;
        micTab.style.pointerEvents = '';
        micTab.style.opacity = '';
        convertTab.disabled = false;
        convertTab.style.pointerEvents = '';
        convertTab.style.opacity = '';
      }
    }

    // Conversion controls
    if (!isConverting) {
      convertBtn.disabled = !audioFile.files.length || isRecording || isPreviewing;
    }

    // Preview controls
    previewBtn.disabled = !audioFile.files.length || isRecording || isConverting || isPreviewing;
    if (isPreviewing) {
      stopPreviewBtn.style.display = 'inline-flex';
      previewBtn.style.display = 'none';
    } else {
      stopPreviewBtn.style.display = 'none';
      previewBtn.style.display = 'inline-flex';
    }

    // Visualizer settings - disable during recording to prevent issues
    const settingsElements = [
      visualizerSelect, primaryColor, secondaryColor, swapColorsBtn, bgColor,
      barCount, frequencyWidth, bgImage, bgSizeMode, bgCustomWidth, bgCustomHeight,
      mirror, mirrorHorizontal, useCustomColors, centerImage, centerImageZoom,
      centerImageOffsetX, centerImageOffsetY, visualizationAlpha, offsetX, offsetY,
      visualizationScale, layerEffect, layerEffectIntensity, barShapeSelect, particleShapeSelect,
      audioEnhancementEnabled, noiseReduction, noiseProfileFile, noiseProfileReduction,
      noiseProfileVoiceProtection,
      smartNormalization, saturation,
      saturationMode, saturationMin, saturationMax
    ];

    settingsElements.forEach(el => {
      if (el) el.disabled = isRecording;
    });
    clearNoiseProfile.disabled = isRecording || !currentNoiseProfile;
  }

  // Start microphone
  startMicBtn.addEventListener('click', async () => {
    try {
      await recorder.startMicrophone();
      updateStatus('Microphone active - visualization running', 'ready');
      updateButtonStates();
    } catch (error) {
      updateStatus('Error: ' + error.message, 'error');
      console.error(error);
    }
  });

  // Stop microphone
  stopMicBtn.addEventListener('click', () => {
    recorder.stopMicrophone();
    recorder.stopVisualization();
    updateStatus('Microphone stopped', 'ready');
    updateButtonStates();
  });

  // Start recording
  startRecordBtn.addEventListener('click', () => {
    isRecording = true;
    recorder.startRecording();
    updateStatus('Recording...', 'recording');
    updateButtonStates();
  });

  // Stop recording
  stopRecordBtn.addEventListener('click', async () => {
    try {
      const blob = await recorder.stopRecording();
      isRecording = false;
      updateStatus('Recording saved!', 'ready');
      updateButtonStates();

      // Add to recordings list
      addRecording(blob);
    } catch (error) {
      isRecording = false;
      updateStatus('Error: ' + error.message, 'error');
      updateButtonStates();
      console.error(error);
    }
  });

  // Add recording to list
  function addRecording(blob, options = {}) {
    recordingCount++;
    const recordingNumber = recordingCount;
    const url = URL.createObjectURL(blob);
    const fileName = buildRecordingFileName(options.sourceName, blob, options.format);
    const recording = {
      blob,
      url,
      fileName,
      index: recordingCount,
    };
    savedRecordings.push(recording);
    if (saveAllRecordingsBtn) {
      saveAllRecordingsBtn.disabled = false;
    }

    const item = document.createElement('div');
    item.className = 'recording-item';

    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.src = url;
    videoEl.width = 200;

    // Enable fullscreen on double-click
    videoEl.addEventListener('dblclick', () => {
      if (videoEl.requestFullscreen) {
        videoEl.requestFullscreen();
      } else if (videoEl.webkitRequestFullscreen) {
        videoEl.webkitRequestFullscreen();
      } else if (videoEl.mozRequestFullScreen) {
        videoEl.mozRequestFullScreen();
      } else if (videoEl.msRequestFullscreen) {
        videoEl.msRequestFullscreen();
      }
    });

    // Add title attribute for hint
    videoEl.title = 'Double-click for fullscreen';

    const infoDiv = document.createElement('div');

    // Check if running in Electron
    const isElectron = window.electronAPI && window.electronAPI.isElectron;

    if (isElectron) {
      // Electron: Use IPC to save and show in folder
      infoDiv.innerHTML = `
        <p>${fileName}</p>
        <p>Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB</p>
        <div class="recording-actions">
          <button type="button" class="btn-info" data-action="save" data-blob-index="${recordingNumber}">Save and Show in Folder</button>
          <button type="button" class="btn-info youtube-upload-btn">Upload to YouTube</button>
        </div>
        <p style="font-size: 12px; color: #888; margin-top: 5px;">Double-click video for fullscreen</p>
      `;

      // Store blob reference for later use
      item.dataset.blobUrl = url;
      item.dataset.fileName = fileName;

      // Add click handler for save button
      const saveBtn = infoDiv.querySelector('button[data-action="save"]');
      saveBtn.addEventListener('click', async () => {
        try {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';

          const result = await saveRecording(recording, saveBtn);

          if (result.success) {
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
              saveBtn.textContent = 'Save and Show in Folder';
              saveBtn.disabled = false;
            }, 2000);
          } else if (result.canceled) {
            saveBtn.textContent = 'Save and Show in Folder';
            saveBtn.disabled = false;
          } else {
            saveBtn.textContent = 'Error - Try Again';
            saveBtn.disabled = false;
            console.error('Save error:', result.error);
          }
        } catch (error) {
          console.error('Error saving video:', error);
          saveBtn.textContent = 'Error - Try Again';
          saveBtn.disabled = false;
        }
      });
    } else {
      // Browser: Use regular download link
      infoDiv.innerHTML = `
        <p>${fileName}</p>
        <p>Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB</p>
        <div class="recording-actions">
          <a href="${url}" download="${fileName}">Download</a>
          <button type="button" class="btn-info youtube-upload-btn">Upload to YouTube</button>
        </div>
        <p style="font-size: 12px; color: #888; margin-top: 5px;">Double-click video for fullscreen</p>
      `;
    }

    const youtubeUploadBtn = infoDiv.querySelector('.youtube-upload-btn');
    if (youtubeUploadBtn) {
      youtubeUploadBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('audioRecorderYouTubeUploadRequested', {
          detail: { blob, fileName, recordingNumber },
        }));
      });
    }

    item.appendChild(videoEl);
    item.appendChild(infoDiv);
    recordingsList.appendChild(item);
  }

  // Get current options
  function getCurrentOptions() {
    const isCustomColors = useCustomColors.checked;
    const customOptions = {
      // For circular visualizer
      useColorGradient: isCustomColors,
      // For particles visualizer
      useCustomColors: isCustomColors,
    };

    // Only set colorScheme when custom colors is enabled (for spectrogram)
    // Don't set it to undefined as it would override the visualizer's default
    if (isCustomColors) {
      customOptions.colorScheme = 'custom';
      // For spectrum-gradient visualizer - also set fillStyle
      customOptions.fillStyle = 'custom';
    }

    const options = {
      primaryColor: primaryColor.value,
      secondaryColor: secondaryColor.value,
      backgroundColor: bgColor.value,
      barCount: parseInt(barCount.value),
      frequencyWidth: parseInt(frequencyWidth.value),
      sensitivity: parseFloat(sensitivity.value),
      // ADSR envelope settings
      adsrAttack: parseInt(adsrAttack.value),
      adsrDecay: parseInt(adsrDecay.value),
      adsrSustain: parseInt(adsrSustain.value),
      adsrRelease: parseInt(adsrRelease.value),
      mirror: mirror.checked,
      mirrorHorizontal: mirrorHorizontal.checked,
      visualizationAlpha: parseFloat(visualizationAlpha.value),
      offsetX: parseInt(offsetX.value),
      offsetY: parseInt(offsetY.value),
      scale: parseInt(visualizationScale.value) / 100,
      backgroundSizeMode: bgSizeMode.value,
      layerEffect: layerEffect.value,
      layerEffectIntensity: parseInt(layerEffectIntensity.value),
      custom: customOptions,
    };
    // Include background image if one is set
    if (currentBackgroundImageUrl) {
      options.backgroundImage = currentBackgroundImageUrl;
    }
    // Include custom dimensions if in custom mode
    if (bgSizeMode.value === 'custom') {
      options.backgroundWidth = parseInt(bgCustomWidth.value);
      options.backgroundHeight = parseInt(bgCustomHeight.value);
    }
    // Include center image if one is set (for circular visualizer)
    if (currentCenterImageUrl) {
      options.custom.centerImage = currentCenterImageUrl;
      options.custom.centerImageZoom = parseInt(centerImageZoom.value) / 100;
      options.custom.centerImageOffsetX = parseInt(centerImageOffsetX.value);
      options.custom.centerImageOffsetY = parseInt(centerImageOffsetY.value);
    }
    // Include bar shape (for bars visualizer)
    options.custom.barShape = barShapeSelect.value;
    // Include particle shape (for particles visualizer)
    options.custom.particleShape = particleShapeSelect.value;
    // Include image blink settings if enabled
    if (imageBlinkEnabled.checked) {
      options.imageBlinkEnabled = true;
      options.imageBlinkFrequencyRange = {
        min: parseInt(blinkFrequencyMin.value),
        max: parseInt(blinkFrequencyMax.value),
      };
      options.imageBlinkVolumeThreshold = parseInt(blinkThreshold.value);
      options.imageBlinkStyle = imageBlinkStyle.value;
      options.imageBlinkIntensity = parseInt(blinkIntensity.value);
      options.imageBlinkTarget = imageBlinkTarget.value;
      options.imageBlinkDuration = parseInt(blinkDuration.value);
    } else {
      options.imageBlinkEnabled = false;
    }
    return options;
  }

  // Get current audio enhancement settings
  function getCurrentAudioEnhancement() {
    const minHz = parseInt(saturationMin.value);
    const maxHz = parseInt(saturationMax.value);

    return {
      enabled: audioEnhancementEnabled.checked,
      noiseReduction: parseInt(noiseReduction.value),
      noiseProfile: currentNoiseProfile,
      noiseProfileReduction: parseInt(noiseProfileReduction.value),
      noiseProfileVoiceProtection: parseInt(noiseProfileVoiceProtection.value),
      smartNormalization: parseInt(smartNormalization.value),
      saturation: parseInt(saturation.value),
      saturationFrequencyRange: {
        min: Math.min(minHz, maxHz),
        max: Math.max(minHz, maxHz),
      },
      saturationMode: saturationMode.value,
    };
  }

  // Helper function to show preview after settings change
  function updatePreview() {
    updatePreviewGuides();
    // Show demo visualization if no audio source is active
    if (!recorder.sourceType) {
      recorder.showDemoVisualization(500);
    }
  }

  function updatePreviewGuides() {
    if (!previewOverlay) return;

    const offsetXValue = parseInt(offsetX.value) || 0;
    const offsetYValue = parseInt(offsetY.value) || 0;
    const scale = Math.max(0.01, parseInt(visualizationScale.value) / 100 || 1);
    const snapTolerance = 6;
    const gridStepX = canvas.width / 8;
    const gridStepY = canvas.height / 8;
    const overlayX = 50 + (offsetXValue / canvas.width) * 100;
    const overlayY = 50 + (offsetYValue / canvas.height) * 100;
    const visualWidth = Math.min(100, Math.max(0, 100 * scale));
    const visualHeight = Math.min(100, Math.max(0, 100 * scale));

    previewOverlay.style.setProperty('--visual-center-x', `${overlayX}%`);
    previewOverlay.style.setProperty('--visual-center-y', `${overlayY}%`);
    previewOverlay.style.setProperty('--visual-width', `${visualWidth}%`);
    previewOverlay.style.setProperty('--visual-height', `${visualHeight}%`);

    const verticalCenter = previewOverlay.querySelector('[data-guide="vertical-center"]');
    const horizontalCenter = previewOverlay.querySelector('[data-guide="horizontal-center"]');
    const verticalGrid = previewOverlay.querySelector('[data-guide="vertical-grid"]');
    const horizontalGrid = previewOverlay.querySelector('[data-guide="horizontal-grid"]');

    setGuide(verticalCenter, Math.abs(offsetXValue) <= snapTolerance, 'left', '50%');
    setGuide(horizontalCenter, Math.abs(offsetYValue) <= snapTolerance, 'top', '50%');

    const nearestGridX = Math.round(offsetXValue / gridStepX) * gridStepX;
    const nearestGridY = Math.round(offsetYValue / gridStepY) * gridStepY;
    const showGridX = Math.abs(offsetXValue - nearestGridX) <= snapTolerance && Math.abs(nearestGridX) > snapTolerance;
    const showGridY = Math.abs(offsetYValue - nearestGridY) <= snapTolerance && Math.abs(nearestGridY) > snapTolerance;

    setGuide(verticalGrid, showGridX, 'left', `${50 + (nearestGridX / canvas.width) * 100}%`);
    setGuide(horizontalGrid, showGridY, 'top', `${50 + (nearestGridY / canvas.height) * 100}%`);
  }

  function setPreviewGuidesDragging(isDragging) {
    if (!previewOverlay) return;
    previewOverlay.classList.toggle('is-dragging', isDragging);
    updatePreviewGuides();
  }

  function setGuide(guide, visible, property, value) {
    if (!guide) return;
    guide.classList.toggle('is-visible', visible);
    guide.style[property] = value;
  }

  function getNextPresetName() {
    let index = presets.length + 1;
    const names = new Set(presets.map(preset => preset.name));
    while (names.has(String(index))) {
      index++;
    }
    return String(index);
  }

  function openModal(modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openPresetSidebar() {
    clearTimeout(presetSidebarCloseTimer);
    presetSidebar.classList.add('is-open');
  }

  function scheduleClosePresetSidebar() {
    clearTimeout(presetSidebarCloseTimer);
    presetSidebarCloseTimer = setTimeout(() => {
      if (!presetSidebar.matches(':hover') && !presetContextMenu.classList.contains('active')) {
        presetSidebar.classList.remove('is-open');
      }
    }, 180);
  }

  function hidePresetContextMenu() {
    presetContextMenu.classList.remove('active');
    presetContextMenu.setAttribute('aria-hidden', 'true');
    activePresetMenuId = null;
  }

  function showPresetContextMenu(presetId, x, y) {
    activePresetMenuId = presetId;
    presetContextMenu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
    presetContextMenu.style.top = `${Math.min(y, window.innerHeight - 88)}px`;
    presetContextMenu.classList.add('active');
    presetContextMenu.setAttribute('aria-hidden', 'false');
    openPresetSidebar();
  }

  function openPresetRenameDialog(presetId) {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) return;

    presetRenameTargetId = presetId;
    presetRenameInput.value = preset.name || '';
    openModal(presetRenameModal);
    presetRenameInput.focus();
    presetRenameInput.select();
  }

  function closePresetRenameDialog() {
    presetRenameTargetId = null;
    closeModal(presetRenameModal);
  }

  function confirmPresetRename() {
    const presetId = presetRenameTargetId;
    const trimmedName = presetRenameInput.value.trim();

    if (!presetId) return;
    if (!trimmedName) {
      presetRenameInput.focus();
      return;
    }

    renamePreset(presetId, trimmedName);
    closePresetRenameDialog();
  }

  function renamePreset(presetId, nextName) {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) return;

    const trimmedName = nextName ? nextName.trim() : '';
    if (!trimmedName) return;

    presets = presets.map(item => (
      item.id === presetId ? { ...item, name: trimmedName } : item
    ));
    savePresets(presets);
    renderPresets();
    openPresetSidebar();
    updateStatus(`Preset renamed to "${trimmedName}"`, 'ready');
  }

  function deletePreset(presetId) {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) return;

    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;

    presets = presets.filter(item => item.id !== presetId);
    if (activeLoadedPresetId === presetId) {
      activeLoadedPresetId = null;
      saveActivePresetId(null);
    }
    savePresets(presets);
    renderPresets();
    openPresetSidebar();
    updateStatus(`Preset "${preset.name}" deleted`, 'ready');
  }

  function movePresetBefore(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const source = presets.find(item => item.id === sourceId);
    if (!source) return;

    const withoutSource = presets.filter(item => item.id !== sourceId);
    const targetIndex = withoutSource.findIndex(item => item.id === targetId);
    if (targetIndex === -1) return;

    presets = [
      ...withoutSource.slice(0, targetIndex),
      source,
      ...withoutSource.slice(targetIndex),
    ];
    savePresets(presets);
    renderPresets();
  }

  async function choosePresetFolder() {
    if (window.electronAPI && window.electronAPI.choosePresetFolder) {
      const result = await window.electronAPI.choosePresetFolder();
      if (result && result.success && result.folderPath) {
        presetOptions = { ...presetOptions, savePath: result.folderPath };
        savePresetOptions(presetOptions);
        presetFolderInput.value = result.folderPath;
        presetSettingsPathInput.value = result.folderPath;
      }
      return;
    }

    presetOptions = { ...presetOptions, savePath: 'Browser local storage' };
    savePresetOptions(presetOptions);
    presetFolderInput.value = presetOptions.savePath;
    presetSettingsPathInput.value = presetOptions.savePath;
  }

  async function persistPresetToFolder(preset) {
    if (!window.electronAPI || !window.electronAPI.savePresetFile || !presetOptions.savePath) {
      return;
    }

    const result = await window.electronAPI.savePresetFile(presetOptions.savePath, preset);
    if (!result.success) {
      console.warn('Failed to export preset file:', result.error);
    }
  }

  function renderPresets() {
    presetList.innerHTML = '';

    presets.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-icon-btn preset-load-btn';
      button.textContent = preset.name || String(index + 1);
      button.setAttribute('aria-label', `Load preset ${preset.name || index + 1}`);
      button.dataset.presetId = preset.id;
      button.draggable = true;
      if (isPresetCurrentlyActive(preset)) {
        button.classList.add('is-active');
        button.setAttribute('aria-current', 'true');
      }
      button.addEventListener('click', () => loadPreset(preset.id));
      button.addEventListener('contextmenu', event => {
        event.preventDefault();
        showPresetContextMenu(preset.id, event.clientX, event.clientY);
      });
      button.addEventListener('dragstart', event => {
        draggedPresetId = preset.id;
        button.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', preset.id);
      });
      button.addEventListener('dragend', () => {
        draggedPresetId = null;
        button.classList.remove('is-dragging');
        presetList.querySelectorAll('.is-drop-target').forEach(item => item.classList.remove('is-drop-target'));
      });
      button.addEventListener('dragover', event => {
        if (draggedPresetId && draggedPresetId !== preset.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          button.classList.add('is-drop-target');
        }
      });
      button.addEventListener('dragleave', () => {
        button.classList.remove('is-drop-target');
      });
      button.addEventListener('drop', event => {
        event.preventDefault();
        button.classList.remove('is-drop-target');
        movePresetBefore(event.dataTransfer.getData('text/plain') || draggedPresetId, preset.id);
      });
      presetList.appendChild(button);
    });
  }

  async function savePreset(name) {
    const preset = {
      id: `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name || getNextPresetName(),
      createdAt: new Date().toISOString(),
      settings: getCurrentSettings(),
    };

    presets = [...presets, preset];
    activeLoadedPresetId = preset.id;
    saveActivePresetId(activeLoadedPresetId);
    savePresets(presets);
    await persistPresetToFolder(preset);
    renderPresets();
    updateStatus(`Preset "${preset.name}" saved`, 'ready');
  }

  async function loadPreset(presetId) {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) {
      updateStatus('Preset not found', 'error');
      return;
    }

    const settings = { ...defaultSettings, ...preset.settings };
    activeLoadedPresetId = preset.id;
    saveActivePresetId(activeLoadedPresetId);
    applySettings(settings);
    saveSettings(settings);
    await recorder.setVisualizer(visualizerSelect.value, getCurrentOptions());
    recorder.setAudioEnhancement(getCurrentAudioEnhancement());
    applyVideoDimensions();
    updateSliderColors();
    updateButtonStates();
    updatePreview();
    updateActivePresetIndicator();
    updateStatus(`Preset "${preset.name}" loaded`, 'ready');
  }

  function openPresetSaveDialog() {
    presetNameInput.value = getNextPresetName();
    presetFolderInput.value = presetOptions.savePath || 'Browser local storage';
    presetDontShowAgain.checked = presetOptions.skipDialog || false;
    openModal(presetSaveModal);
    presetNameInput.focus();
    presetNameInput.select();
  }

  function initializePresetControls() {
    presetSettingsPathInput.value = presetOptions.savePath || 'Browser local storage';
    renderPresets();

    savePresetBtn.addEventListener('click', async () => {
      if (presetOptions.skipDialog) {
        await savePreset(getNextPresetName());
      } else {
        openPresetSaveDialog();
      }
    });

    presetConfirmSaveBtn.addEventListener('click', async () => {
      presetOptions = {
        ...presetOptions,
        savePath: presetFolderInput.value,
        skipDialog: presetDontShowAgain.checked,
      };
      savePresetOptions(presetOptions);
      await savePreset(presetNameInput.value.trim() || getNextPresetName());
      closeModal(presetSaveModal);
    });

    presetCancelSaveBtn.addEventListener('click', () => closeModal(presetSaveModal));
    presetChooseFolderBtn.addEventListener('click', choosePresetFolder);

    presetSettingsBtn.addEventListener('click', () => {
      presetSettingsPathInput.value = presetOptions.savePath || 'Browser local storage';
      openModal(presetSettingsModal);
    });
    presetSettingsChooseFolderBtn.addEventListener('click', choosePresetFolder);
    presetSettingsCloseBtn.addEventListener('click', () => closeModal(presetSettingsModal));

    presetEdgeTrigger.addEventListener('pointerenter', openPresetSidebar);
    presetSidebar.addEventListener('pointerenter', openPresetSidebar);
    presetSidebar.addEventListener('pointerleave', scheduleClosePresetSidebar);
    presetEdgeTrigger.addEventListener('pointerleave', scheduleClosePresetSidebar);

    presetRenameBtn.addEventListener('click', event => {
      event.stopPropagation();
      const presetId = activePresetMenuId;
      hidePresetContextMenu();
      openPresetRenameDialog(presetId);
    });
    presetDeleteBtn.addEventListener('click', event => {
      event.stopPropagation();
      const presetId = activePresetMenuId;
      hidePresetContextMenu();
      deletePreset(presetId);
    });
    presetCancelRenameBtn.addEventListener('click', closePresetRenameDialog);
    presetConfirmRenameBtn.addEventListener('click', confirmPresetRename);
    presetRenameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        confirmPresetRename();
      } else if (event.key === 'Escape') {
        closePresetRenameDialog();
      }
    });

    document.addEventListener('click', event => {
      if (!presetContextMenu.contains(event.target)) {
        hidePresetContextMenu();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        hidePresetContextMenu();
        if (presetRenameModal.classList.contains('active')) {
          closePresetRenameDialog();
        }
      }
    });

    [presetSaveModal, presetSettingsModal, presetRenameModal].forEach(modal => {
      modal.addEventListener('click', event => {
        if (event.target === modal) {
          if (modal === presetRenameModal) {
            closePresetRenameDialog();
          } else {
            closeModal(modal);
          }
        }
      });
    });
  }

  // Function to update slider colors based on current primary/secondary colors
  function updateSliderColors() {
    const primary = primaryColor.value;
    const secondary = secondaryColor.value;

    // Update CSS custom properties for sliders
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);

    // Update all range sliders to use the gradient
    const rangeSliders = document.querySelectorAll('.option-group input[type="range"]');
    rangeSliders.forEach(slider => {
      slider.style.background = `linear-gradient(to right, ${primary} 0%, ${secondary} 100%)`;
    });

    // Update checkboxes accent color
    const checkboxes = document.querySelectorAll('.option-group input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.style.accentColor = primary;
    });
  }

  // Initialize slider colors on load
  updateSliderColors();

  // Expose shared state and functions to global app object for use by other modules
  window.AudioRecorderApp = {
    // State
    canvas,
    recorder,
    converter,
    AudioAnalyzer,
    savedSettings,
    // Mutable state accessors
    get currentBackgroundImageUrl() { return currentBackgroundImageUrl; },
    set currentBackgroundImageUrl(val) { currentBackgroundImageUrl = val; },
    get currentCenterImageUrl() { return currentCenterImageUrl; },
    set currentCenterImageUrl(val) { currentCenterImageUrl = val; },
    get currentNoiseProfile() { return currentNoiseProfile; },
    set currentNoiseProfile(val) { currentNoiseProfile = val; },
    get currentNoiseProfileName() { return currentNoiseProfileName; },
    set currentNoiseProfileName(val) { currentNoiseProfileName = val; },
    get isRecording() { return isRecording; },
    set isRecording(val) { isRecording = val; },
    get isConverting() { return isConverting; },
    set isConverting(val) { isConverting = val; },
    get isPreviewing() { return isPreviewing; },
    set isPreviewing(val) { isPreviewing = val; },
    get previewAudioElement() { return previewAudioElement; },
    set previewAudioElement(val) { previewAudioElement = val; },
    get currentPresentationX() { return currentPresentationX; },
    set currentPresentationX(val) { currentPresentationX = val; },
    get currentPresentationY() { return currentPresentationY; },
    set currentPresentationY(val) { currentPresentationY = val; },
    // Blink debug state
    get blinkDebugAudioBuffer() { return blinkDebugAudioBuffer; },
    set blinkDebugAudioBuffer(val) { blinkDebugAudioBuffer = val; },
    get blinkDebugAudioContext() { return blinkDebugAudioContext; },
    set blinkDebugAudioContext(val) { blinkDebugAudioContext = val; },
    get blinkDebugAudioSource() { return blinkDebugAudioSource; },
    set blinkDebugAudioSource(val) { blinkDebugAudioSource = val; },
    get blinkDebugAudioDuration() { return blinkDebugAudioDuration; },
    set blinkDebugAudioDuration(val) { blinkDebugAudioDuration = val; },
    get blinkDebugIntervalStartTime() { return blinkDebugIntervalStartTime; },
    set blinkDebugIntervalStartTime(val) { blinkDebugIntervalStartTime = val; },
    get blinkDebugIntervalEndTime() { return blinkDebugIntervalEndTime; },
    set blinkDebugIntervalEndTime(val) { blinkDebugIntervalEndTime = val; },
    get blinkDebugIsSelecting() { return blinkDebugIsSelecting; },
    set blinkDebugIsSelecting(val) { blinkDebugIsSelecting = val; },
    get blinkDebugSelectionStartX() { return blinkDebugSelectionStartX; },
    set blinkDebugSelectionStartX(val) { blinkDebugSelectionStartX = val; },
    get blinkDebugAudioDataUrl() { return blinkDebugAudioDataUrl; },
    set blinkDebugAudioDataUrl(val) { blinkDebugAudioDataUrl = val; },
    get blinkDebugAudioFileName() { return blinkDebugAudioFileName; },
    set blinkDebugAudioFileName(val) { blinkDebugAudioFileName = val; },
    // Functions
    saveSettings,
    getCurrentSettings,
    getCurrentOptions,
    getCurrentAudioEnhancement,
    updatePreview,
    setPreviewGuidesDragging,
    updateSliderColors,
    updateStatus,
    updateButtonStates,
    addRecording,
    getVideoDimensions,
    applyVideoDimensions,
    // Elements (for other modules)
    elements: {
      visualizerSelect,
      primaryColor,
      secondaryColor,
      swapColorsBtn,
      bgColor,
      barCount,
      frequencyWidth,
      sensitivity,
      adsrAccordion,
      adsrAccordionHeader,
      adsrAttack,
      adsrAttackValue,
      adsrDecay,
      adsrDecayValue,
      adsrSustain,
      adsrSustainValue,
      adsrRelease,
      adsrReleaseValue,
      bgImage,
      mirror,
      mirrorHorizontal,
      visualizationAlpha,
      alphaValue,
      offsetX,
      offsetXValue,
      offsetY,
      offsetYValue,
      visualizationScale,
      scaleValue,
      audioFile,
      saveAllRecordingsBtn,
      convertBtn,
      cancelConvertBtn,
      previewBtn,
      stopPreviewBtn,
      loopPreviewCheckbox,
      progressFill,
      videoQuality,
      aspectRatio,
      videoDimensions,
      bgSizeMode,
      customSizeControls,
      bgCustomWidth,
      bgCustomHeight,
      layerEffect,
      layerEffectIntensity,
      layerEffectIntensityValue,
      useCustomColors,
      centerImage,
      centerImageControls,
      centerImagePositionControls,
      centerImageZoom,
      centerImageZoomValue,
      centerImageOffsetX,
      centerImageOffsetXValue,
      centerImageOffsetY,
      centerImageOffsetYValue,
      barShapeControls,
      barShapeSelect,
      particleShapeControls,
      particleShapeSelect,
      videoFormat,
      audioEnhancementEnabled,
      audioEnhancementControls,
      noiseReduction,
      noiseReductionValue,
      noiseProfileFile,
      noiseProfileFileName,
      noiseProfileReduction,
      noiseProfileReductionValue,
      noiseProfileVoiceProtection,
      noiseProfileVoiceProtectionValue,
      clearNoiseProfile,
      smartNormalization,
      smartNormalizationValue,
      saturation,
      saturationValue,
      saturationMode,
      saturationMin,
      saturationMinValue,
      saturationMax,
      saturationMaxValue,
      imageBlinkEnabled,
      imageBlinkControls,
      imageBlinkStyle,
      imageBlinkTarget,
      blinkFrequencyMin,
      blinkFrequencyMax,
      blinkFrequencyValue,
      blinkThreshold,
      blinkThresholdValue,
      blinkIntensity,
      blinkIntensityValue,
      blinkDuration,
      blinkDurationValue,
      blinkDebugModeEnabled,
      blinkDebugControls,
      blinkDebugAudioFile,
      blinkDebugFileName,
      blinkWaveformContainer,
      blinkWaveformCanvas,
      blinkSelectionOverlay,
      blinkIntervalDisplay,
      blinkWaveformStart,
      blinkWaveformEnd,
      blinkPlayIntervalBtn,
      blinkClearIntervalBtn,
      blinkExtractedParams,
      blinkExtractedFreq,
      blinkExtractedThreshold,
      blinkManualControls,
      togglePresentationBtn,
      togglePresentationBtnText,
      presentationWindowMode,
      presentationWindowType,
      presentationSizeControls,
      presentationWidth,
      presentationHeight,
      presentationBgOpacity,
      presentationBgOpacityValue,
      presentationVisualizationOpacity,
      presentationVisualizationOpacityValue,
      presentationClickThrough,
      presentationElectronOnly,
    },
  };

  // Signal that core module is ready
  window.AudioRecorderApp.coreReady = true;
  window.dispatchEvent(new CustomEvent('audioRecorderCoreReady'));

  // Show available visualizers in console
  console.log('Available visualizers:', AudioRecorder.getAvailableVisualizers());
  console.log('Supported formats:', AudioRecorder.getSupportedFormats());
  console.log('Keyboard shortcuts: Press ? or / for help');
})();
