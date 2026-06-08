/**
 * Audio Recorder with Visualization - Pipeline mode
 */

(function() {
  'use strict';

  const PIPELINE_STAGES_KEY = 'audio-recorder-pipeline-stages';
  const SAVED_PIPELINES_KEY = 'audio-recorder-pipelines';
  const ACTIVE_PIPELINE_KEY = 'audio-recorder-active-pipeline-id';
  const PIPELINE_TIMEZONE_KEY = 'audio-recorder-pipeline-timezone';
  const PIPELINE_UPLOAD_ORDER_KEY = 'audio-recorder-pipeline-upload-order';
  const RESET_OPTIONS_KEY = 'audio-recorder-pipeline-reset-options';
  const PLAYLISTS_KEY = 'audio-recorder-youtube-playlists';
  const HOLD_TO_RESET_MS = 600;
  const DEFAULT_RELATIVE_OFFSET_MINUTES = 30;
  const PREVIEW_MAX_SIDE = 360;
  const PREVIEW_FFT_SIZE = 2048;

  const addStageBtn = document.getElementById('addPipelineStageBtn');
  const clearPipelineBtn = document.getElementById('clearPipelineBtn');
  const runPipelineBtn = document.getElementById('runPipelineBtn');
  const resetPipelineFieldsBtn = document.getElementById('resetPipelineFieldsBtn');
  const pipelineTimezoneBtn = document.getElementById('pipelineTimezoneBtn');
  const validationStatus = document.getElementById('pipelineValidationStatus');
  const stagesContainer = document.getElementById('pipelineStages');
  const stageNav = document.getElementById('pipelineStageNav');
  const pipelineTab = document.getElementById('pipelineTab');
  const pipelineSidebar = document.getElementById('pipelineSidebar');
  const savePipelineBtn = document.getElementById('savePipelineBtn');
  const pipelineList = document.getElementById('pipelineList');
  const pipelineSettingsBtn = document.getElementById('pipelineSettingsBtn');

  const deleteModal = document.getElementById('pipelineDeleteModal');
  const deleteMessage = document.getElementById('pipelineDeleteMessage');
  const cancelDeleteBtn = document.getElementById('cancelPipelineDeleteBtn');
  const cancelDeleteXBtn = document.getElementById('cancelPipelineDeleteXBtn');
  const confirmDeleteBtn = document.getElementById('confirmPipelineDeleteBtn');

  const resetModal = document.getElementById('pipelineResetModal');
  const cancelResetBtn = document.getElementById('cancelPipelineResetBtn');
  const cancelResetXBtn = document.getElementById('cancelPipelineResetXBtn');
  const confirmResetHoldBtn = document.getElementById('confirmPipelineResetHoldBtn');
  const resetCheckboxes = {
    names: document.getElementById('resetPipelineNames'),
    files: document.getElementById('resetPipelineFiles'),
    descriptions: document.getElementById('resetPipelineDescriptions'),
    dates: document.getElementById('resetPipelineDates'),
    presets: document.getElementById('resetPipelinePresets'),
    actions: document.getElementById('resetPipelineActions'),
    privacy: document.getElementById('resetPipelinePrivacy'),
    youtubeFlags: document.getElementById('resetPipelineYouTubeFlags'),
    album: document.getElementById('resetPipelineAlbum'),
  };

  const timezoneModal = document.getElementById('pipelineTimezoneModal');
  const timezoneSelect = document.getElementById('pipelineTimezoneSelect');
  const uploadOrderSelect = document.getElementById('pipelineUploadOrderSelect');
  const cancelTimezoneBtn = document.getElementById('cancelPipelineTimezoneBtn');
  const cancelTimezoneXBtn = document.getElementById('cancelPipelineTimezoneXBtn');
  const confirmTimezoneBtn = document.getElementById('confirmPipelineTimezoneBtn');

  const reportModal = document.getElementById('pipelineReportModal');
  const reportSummary = document.getElementById('pipelineReportSummary');
  const reportList = document.getElementById('pipelineReportList');
  const closeReportBtn = document.getElementById('closePipelineReportBtn');
  const closeReportXBtn = document.getElementById('closePipelineReportXBtn');

  const requiredElements = [
    addStageBtn, clearPipelineBtn, runPipelineBtn, resetPipelineFieldsBtn, pipelineTimezoneBtn,
    validationStatus, stagesContainer, pipelineTab, pipelineSidebar, savePipelineBtn, pipelineList,
    pipelineSettingsBtn, deleteModal, deleteMessage, cancelDeleteBtn, cancelDeleteXBtn,
    confirmDeleteBtn, resetModal, cancelResetBtn, cancelResetXBtn, confirmResetHoldBtn,
    timezoneModal, timezoneSelect, uploadOrderSelect, cancelTimezoneBtn, cancelTimezoneXBtn, confirmTimezoneBtn,
    reportModal, reportSummary, reportList, closeReportBtn, closeReportXBtn,
    ...Object.values(resetCheckboxes),
  ];

  if (requiredElements.some(element => !element)) {
    console.warn('Pipeline UI is incomplete.');
    return;
  }

  const defaultResetOptions = {
    names: true,
    files: true,
    descriptions: false,
    dates: false,
    presets: false,
    actions: false,
    privacy: false,
    youtubeFlags: false,
    album: false,
  };

  const selectedFilesByStageId = new Map();
  const selectedCoversByStageId = new Map();
  let stages = loadStages();
  let savedPipelines = loadSavedPipelines();
  let activePipelineId = localStorage.getItem(ACTIVE_PIPELINE_KEY) || '';
  let pipelineTimezone = localStorage.getItem(PIPELINE_TIMEZONE_KEY) || '';
  let pipelineUploadOrder = localStorage.getItem(PIPELINE_UPLOAD_ORDER_KEY) === 'manual'
    ? 'manual'
    : 'chronological';
  let pendingDeleteStageId = '';
  let hasPipelineRun = false;
  let isPipelineRunning = false;
  let resetHoldTimer = 0;
  let resetHoldCompleted = false;
  let draggedTrack = null;
  let activeStageId = '';
  let stageObserver = null;
  const pipelinePreviewCache = new Map();

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function toDateTimeLocalValue(date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function defaultPublishAt(minutesOffset = 0) {
    return toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + minutesOffset * 60000));
  }

  function createTrack(title, index = 0) {
    return {
      id: createId('track'),
      title: title || `Track ${String(index + 1).padStart(2, '0')}`,
    };
  }

  function getDefaultPresetId() {
    const firstPreset = loadSavedVisualizationPresets()[0];
    return firstPreset ? `preset:${firstPreset.id}` : '';
  }

  function relativePartsFromMinutes(minutes) {
    const signedMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : DEFAULT_RELATIVE_OFFSET_MINUTES;
    let remaining = Math.abs(Math.round(signedMinutes));
    const months = Math.floor(remaining / (30 * 24 * 60));
    remaining -= months * 30 * 24 * 60;
    const days = Math.floor(remaining / (24 * 60));
    remaining -= days * 24 * 60;
    const hours = Math.floor(remaining / 60);
    remaining -= hours * 60;

    return {
      direction: signedMinutes < 0 ? 'before' : 'after',
      months,
      days,
      hours,
      minutes: remaining,
    };
  }

  function createRelativeOffsetFields(minutes, reference = 'previous') {
    const parts = relativePartsFromMinutes(minutes);
    return {
      relativeReference: reference,
      relativeOffsetDirection: parts.direction,
      relativeOffsetMonths: parts.months,
      relativeOffsetDays: parts.days,
      relativeOffsetHours: parts.hours,
      relativeOffsetUnitMinutes: parts.minutes,
      relativeOffsetMinutes: Number(minutes),
    };
  }

  function createDefaultStage(kind = 'custom', index = stages.length) {
    const defaultPresetId = getDefaultPresetId();
    const defaults = {
      presave: {
        name: 'Pre-save short',
        action: 'visualize-upload',
        resolution: '1080x1920',
        presetId: defaultPresetId,
        scheduleMode: 'relative',
        ...createRelativeOffsetFields(-2 * 24 * 60, 'next'),
        publishAtLocal: defaultPublishAt(0),
        short: true,
        tags: 'shorts, pre-save, audio',
      },
      release: {
        name: 'Release',
        action: 'visualize-upload',
        resolution: '1920x1080',
        presetId: defaultPresetId,
        scheduleMode: 'absolute',
        ...createRelativeOffsetFields(0, 'previous'),
        publishAtLocal: defaultPublishAt(1),
        short: false,
        tags: 'release, audio, visualizer',
        releaseType: 'album',
        tracks: [createTrack('Track 01', 0), createTrack('Track 02', 1)],
      },
      postalbum: {
        name: 'Post-album short',
        action: 'visualize-upload',
        resolution: '1080x1920',
        presetId: defaultPresetId,
        scheduleMode: 'relative',
        ...createRelativeOffsetFields(24 * 60, 'previous'),
        publishAtLocal: defaultPublishAt(2),
        short: true,
        tags: 'shorts, album, audio',
      },
      custom: {
        name: `Stage ${index + 1}`,
        action: 'visualize-upload',
        resolution: '1920x1080',
        presetId: defaultPresetId,
        scheduleMode: 'relative',
        ...createRelativeOffsetFields(DEFAULT_RELATIVE_OFFSET_MINUTES, index > 0 ? 'previous' : 'next'),
        publishAtLocal: defaultPublishAt(index),
        short: false,
        tags: 'audio, visualizer',
      },
    };

    return normalizeStage({
      id: createId('stage'),
      kind,
      privacyStatus: 'private',
      publishImmediately: false,
      description: '',
      short: false,
      madeForKids: false,
      syntheticMedia: false,
      notifySubscribers: false,
      playlistIds: '',
      fileNames: [],
      sharedImageName: '',
      ...defaults[kind],
    }, index);
  }

  function createDefaultStages() {
    return [
      createDefaultStage('presave', 0),
      createDefaultStage('release', 1),
      createDefaultStage('postalbum', 2),
    ];
  }

  function normalizeTrack(track, index) {
    return {
      id: typeof track?.id === 'string' ? track.id : createId('track'),
      title: typeof track?.title === 'string' ? track.title : `Track ${String(index + 1).padStart(2, '0')}`,
    };
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  }

  function getRelativeOffsetParts(stage) {
    const migrated = relativePartsFromMinutes(stage.relativeOffsetMinutes);
    return {
      direction: stage.relativeOffsetDirection === 'before' || stage.relativeOffsetDirection === 'after'
        ? stage.relativeOffsetDirection
        : migrated.direction,
      months: normalizeNonNegativeInteger(stage.relativeOffsetMonths, migrated.months),
      days: normalizeNonNegativeInteger(stage.relativeOffsetDays, migrated.days),
      hours: normalizeNonNegativeInteger(stage.relativeOffsetHours, migrated.hours),
      minutes: normalizeNonNegativeInteger(stage.relativeOffsetUnitMinutes, migrated.minutes),
    };
  }

  function getSignedRelativeOffsetMinutes(stage) {
    const parts = getRelativeOffsetParts(stage);
    const total = (((parts.months * 30 + parts.days) * 24 + parts.hours) * 60) + parts.minutes;
    return parts.direction === 'before' ? -total : total;
  }

  function normalizeStage(stage, index = 0) {
    const fallback = {
      id: createId('stage'),
      kind: 'custom',
      name: `Stage ${index + 1}`,
      action: 'visualize-upload',
      resolution: '1920x1080',
      presetId: getDefaultPresetId(),
      publishAtLocal: defaultPublishAt(index),
      publishImmediately: false,
      scheduleMode: 'relative',
      relativeReference: index > 0 ? 'previous' : 'next',
      relativeOffsetDirection: 'after',
      relativeOffsetMonths: 0,
      relativeOffsetDays: 0,
      relativeOffsetHours: 0,
      relativeOffsetUnitMinutes: DEFAULT_RELATIVE_OFFSET_MINUTES,
      relativeOffsetMinutes: DEFAULT_RELATIVE_OFFSET_MINUTES,
      privacyStatus: 'private',
      description: '',
      tags: 'audio, visualizer',
      playlistIds: '',
      short: false,
      madeForKids: false,
      syntheticMedia: false,
      notifySubscribers: false,
      releaseType: 'single',
      tracks: [],
      sharedImageName: '',
      fileNames: [],
    };
    const normalized = { ...fallback, ...(stage || {}) };
    normalized.id = typeof normalized.id === 'string' ? normalized.id : createId('stage');
    normalized.fileNames = Array.isArray(normalized.fileNames)
      ? normalized.fileNames.filter(name => typeof name === 'string')
      : [];
    normalized.tracks = Array.isArray(normalized.tracks)
      ? normalized.tracks.map(normalizeTrack)
      : [];
    normalized.scheduleMode = normalized.scheduleMode === 'absolute' ? 'absolute' : 'relative';
    normalized.relativeReference = normalized.relativeReference === 'next' ? 'next' : 'previous';
    if (index === 0 && normalized.relativeReference === 'previous') {
      normalized.relativeReference = 'next';
    }
    const relativeParts = getRelativeOffsetParts(normalized);
    normalized.relativeOffsetDirection = relativeParts.direction;
    normalized.relativeOffsetMonths = relativeParts.months;
    normalized.relativeOffsetDays = relativeParts.days;
    normalized.relativeOffsetHours = relativeParts.hours;
    normalized.relativeOffsetUnitMinutes = relativeParts.minutes;
    normalized.relativeOffsetMinutes = getSignedRelativeOffsetMinutes(normalized);
    if (!getSavedPresetSettings(normalized.presetId) && getDefaultPresetId()) {
      normalized.presetId = getDefaultPresetId();
    }
    if (normalized.kind === 'release' && normalized.releaseType === 'album' && !normalized.tracks.length) {
      normalized.tracks = [createTrack('Track 01', 0), createTrack('Track 02', 1)];
    }
    return normalized;
  }

  function sanitizeStage(stage) {
    const clone = { ...stage };
    delete clone.files;
    return clone;
  }

  function loadStages() {
    try {
      const saved = localStorage.getItem(PIPELINE_STAGES_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(normalizeStage) : [];
      }
    } catch (error) {
      console.warn('Failed to load pipeline stages:', error);
    }
    return createDefaultStages();
  }

  function saveStages() {
    localStorage.setItem(PIPELINE_STAGES_KEY, JSON.stringify(stages.map(sanitizeStage)));
  }

  function getPlaylistIds(value) {
    return String(value || '')
      .split(/[\n,]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function loadSavedYouTubePlaylists() {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved
        .map(item => {
          if (typeof item === 'string') {
            return { id: item, title: item };
          }
          if (item && typeof item.id === 'string') {
            return { id: item.id, title: item.title || item.name || item.id };
          }
          return null;
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function saveYouTubePlaylist(playlist) {
    const trimmedId = String(playlist.id || '').trim();
    if (!trimmedId) return;
    const playlists = loadSavedYouTubePlaylists();
    const next = [
      ...playlists.filter(item => item.id !== trimmedId),
      { id: trimmedId, title: String(playlist.title || trimmedId).trim() || trimmedId },
    ];
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('audioRecorderYouTubePlaylistsChanged', {
      detail: { playlists: next },
    }));
  }

  function loadSavedPipelines() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_PIPELINES_KEY) || '[]');
      if (Array.isArray(saved)) {
        return saved.filter(item => item && typeof item.id === 'string');
      }
    } catch (error) {
      console.warn('Failed to load saved pipelines:', error);
    }
    return [];
  }

  function saveSavedPipelines() {
    localStorage.setItem(SAVED_PIPELINES_KEY, JSON.stringify(savedPipelines));
  }

  function loadResetOptions() {
    try {
      return {
        ...defaultResetOptions,
        ...JSON.parse(localStorage.getItem(RESET_OPTIONS_KEY) || '{}'),
      };
    } catch (error) {
      return { ...defaultResetOptions };
    }
  }

  function saveResetOptions(options = getResetOptionsFromModal()) {
    localStorage.setItem(RESET_OPTIONS_KEY, JSON.stringify({ ...defaultResetOptions, ...options }));
  }

  function getResetOptionsFromModal() {
    return Object.keys(resetCheckboxes).reduce((options, key) => {
      options[key] = resetCheckboxes[key].checked;
      return options;
    }, {});
  }

  function setResetOptionsInModal(options = loadResetOptions()) {
    Object.keys(resetCheckboxes).forEach(key => {
      resetCheckboxes[key].checked = Boolean(options[key]);
    });
  }

  function getBrowserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      return 'UTC';
    }
  }

  function updateTimezoneButton() {
    pipelineTimezoneBtn.textContent = `Timezone: ${pipelineTimezone || 'Set timezone'}`;
  }

  function updateStage(stageId, changes, shouldRender = false) {
    const affectsSchedule = [
      'publishAtLocal',
      'publishImmediately',
      'scheduleMode',
      'relativeReference',
      'relativeOffsetDirection',
      'relativeOffsetMonths',
      'relativeOffsetDays',
      'relativeOffsetHours',
      'relativeOffsetUnitMinutes',
    ].some(key => Object.prototype.hasOwnProperty.call(changes, key));
    stages = stages.map((stage, index) => (
      stage.id === stageId ? normalizeStage({ ...stage, ...changes }, index) : stage
    ));
    saveStages();
    if (shouldRender || affectsSchedule) {
      renderStages();
    } else {
      renderStageNav();
      updateRunState();
    }
  }

  function updateTrack(stageId, trackId, changes) {
    const stage = stages.find(item => item.id === stageId);
    if (!stage) return;
    const tracks = stage.tracks.map(track => (
      track.id === trackId ? { ...track, ...changes } : track
    ));
    updateStage(stageId, { tracks });
  }

  function moveTrack(stageId, sourceTrackId, targetTrackId) {
    const stage = stages.find(item => item.id === stageId);
    if (!stage || sourceTrackId === targetTrackId) return;
    const source = stage.tracks.find(track => track.id === sourceTrackId);
    if (!source) return;
    const withoutSource = stage.tracks.filter(track => track.id !== sourceTrackId);
    const targetIndex = withoutSource.findIndex(track => track.id === targetTrackId);
    const nextTracks = [
      ...withoutSource.slice(0, targetIndex),
      source,
      ...withoutSource.slice(targetIndex),
    ];
    updateStage(stageId, { tracks: nextTracks }, true);
  }

  function hasStageFiles(stage) {
    const selected = selectedFilesByStageId.get(stage.id);
    return Boolean(selected && selected.length);
  }

  function actionIncludesVisualization(action) {
    return action === 'visualize-upload' || action === 'visualize-only';
  }

  function actionIncludesUpload(action) {
    return action === 'visualize-upload' || action === 'upload-youtube';
  }

  function getStageActionLabel(action) {
    const labels = {
      'visualize-upload': 'Visualization + update',
      'upload-youtube': 'Update',
      'visualize-only': 'Visualization',
    };
    return labels[action] || 'Visualization + update';
  }

  function isAlbumStage(stage) {
    return stage.kind === 'release' && (stage.releaseType || 'album') === 'album';
  }

  function getTrackTitleFromFileName(fileName, index = 0) {
    const normalized = String(fileName || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || `Track ${String(index + 1).padStart(2, '0')}`;
  }

  function createTracksFromFiles(files = []) {
    return files.map((file, index) => createTrack(getTrackTitleFromFileName(file.name, index), index));
  }

  function validateStage(stage, index = 0, stageBaseDates = computeStageBaseDates()) {
    if (!hasStageFiles(stage)) {
      return 'Select files for every stage before running.';
    }
    if (!String(stage.name || '').trim()) {
      return 'Every stage needs a video name.';
    }
    if (actionIncludesVisualization(stage.action) && (!stage.resolution || !stage.presetId)) {
      return 'Visualization stages need a resolution and preset.';
    }
    if (actionIncludesVisualization(stage.action) && !getSavedPresetSettings(stage.presetId)) {
      return 'Save and choose a visualization preset before running visualization stages.';
    }
    if (!stage.publishImmediately && stage.scheduleMode === 'absolute' && !stage.publishAtLocal) {
      return 'Scheduled stages need a publication date.';
    }
    if (!stage.publishImmediately && stage.scheduleMode === 'relative' &&
      !Number.isFinite(stageBaseDates[index]?.getTime())) {
      return 'Relative stages need a valid reference and offset.';
    }
    if (stage.kind === 'release' && stage.releaseType === 'album' && !stage.tracks.length) {
      return 'Album release stages need at least one track.';
    }
    return '';
  }

  function validateUploadOrder(stageBaseDates = computeStageBaseDates()) {
    if (pipelineUploadOrder !== 'chronological') {
      return '';
    }

    let previousUpload = null;
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index];
      if (!actionIncludesUpload(stage.action)) {
        continue;
      }

      const currentDate = stageBaseDates[index];
      if (!currentDate) {
        continue;
      }

      if (previousUpload && currentDate.getTime() < previousUpload.date.getTime()) {
        return `Stage "${stage.name || index + 1}" is scheduled before previous upload stage "${previousUpload.name}".`;
      }

      previousUpload = {
        name: stage.name || `Stage ${index + 1}`,
        date: currentDate,
      };
    }

    return '';
  }

  function getPipelineValidationError() {
    const stageBaseDates = computeStageBaseDates();
    return stages.map((stage, index) => validateStage(stage, index, stageBaseDates)).find(Boolean) ||
      validateUploadOrder(stageBaseDates) ||
      '';
  }

  function updateRunState() {
    const stageBaseDates = computeStageBaseDates();
    const firstError = getPipelineValidationError();
    runPipelineBtn.disabled = isPipelineRunning || !stages.length || Boolean(firstError);
    validationStatus.textContent = firstError;
    resetPipelineFieldsBtn.style.display = hasPipelineRun ? 'inline-flex' : 'none';
    stagesContainer.querySelectorAll('.pipeline-stage').forEach(item => {
      const stage = stages.find(candidate => candidate.id === item.dataset.stageId);
      const index = stages.findIndex(candidate => candidate.id === item.dataset.stageId);
      item.classList.toggle('is-invalid', Boolean(stage && validateStage(stage, index, stageBaseDates)));
      item.classList.toggle('is-running', isPipelineRunning);
    });
  }

  function normalizeVisualizationPreset(preset) {
    if (!preset || typeof preset.id !== 'string') {
      return null;
    }
    if (preset.settings && typeof preset.settings === 'object') {
      return preset;
    }
    const { id, name, createdAt, sourcePath, ...settings } = preset;
    return Object.keys(settings).length
      ? { id, name, createdAt, sourcePath, settings }
      : null;
  }

  function loadSavedVisualizationPresets() {
    try {
      const app = window.AudioRecorderApp;
      const presets = app && typeof app.getSavedPresets === 'function'
        ? app.getSavedPresets()
        : JSON.parse(localStorage.getItem('audio-recorder-presets') || '[]');
      if (Array.isArray(presets)) {
        return presets
          .map(normalizeVisualizationPreset)
          .filter(Boolean);
      }
    } catch (error) {
      console.warn('Failed to read visualizer presets for pipeline:', error);
    }
    return [];
  }

  function getPresetChoices() {
    const choices = loadSavedVisualizationPresets().map(preset => [
      `preset:${preset.id}`,
      preset.name || 'Saved preset',
    ]);

    return choices.length ? choices : [['', 'No saved visualization presets']];
  }

  function setSelectOptions(select, options, value) {
    options.forEach(([optionValue, label]) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = value;
    if (select.value !== value && options.length) {
      select.value = options[0][0];
    }
  }

  function createField(labelText, className = 'span-4', tooltip = '') {
    const label = document.createElement('label');
    label.className = `pipeline-field ${className}`.trim();
    if (tooltip) {
      label.dataset.tooltip = tooltip;
      label.title = tooltip;
    }
    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;
    label.appendChild(labelSpan);
    return label;
  }

  function showDeleteModal(stageId) {
    const stage = stages.find(item => item.id === stageId);
    if (!stage) {
      return;
    }

    pendingDeleteStageId = stageId;
    deleteMessage.textContent = `Delete "${stage.name || 'this stage'}" from the pipeline?`;
    deleteModal.style.display = 'flex';
    confirmDeleteBtn.focus();
  }

  function hideDeleteModal() {
    pendingDeleteStageId = '';
    deleteModal.style.display = 'none';
  }

  function deletePendingStage() {
    if (!pendingDeleteStageId) {
      return;
    }

    selectedFilesByStageId.delete(pendingDeleteStageId);
    selectedCoversByStageId.delete(pendingDeleteStageId);
    stages = stages.filter(stage => stage.id !== pendingDeleteStageId);
    saveStages();
    renderStages();
    hideDeleteModal();
  }

  function requestStageUpload(stage) {
    const selectedFiles = selectedFilesByStageId.get(stage.id) || [];
    const selectedFile = selectedFiles[0];
    const fileName = `${(stage.name || 'pipeline-stage').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'pipeline-stage'}.webm`;
    window.dispatchEvent(new CustomEvent('audioRecorderYouTubeUploadRequested', {
      detail: {
        blob: selectedFile || new Blob(['pipeline-stage-preview'], { type: 'video/webm' }),
        fileName: selectedFile ? selectedFile.name : fileName,
        recordingNumber: stage.name,
        uploadFormStateKey: `pipeline-stage-${stage.id}`,
      },
    }));
  }

  function updateAppStatus(message, type = 'ready') {
    if (window.AudioRecorderApp && typeof window.AudioRecorderApp.updateStatus === 'function') {
      window.AudioRecorderApp.updateStatus(message, type);
    }
  }

  function getPipelineApp() {
    const app = window.AudioRecorderApp;
    if (!app || !app.converter || typeof app.converter.convertWithFallback !== 'function') {
      throw new Error('Audio converter is not ready.');
    }
    if (!app.canvas) {
      throw new Error('Visualizer canvas is not ready.');
    }
    return app;
  }

  function parseResolution(resolution) {
    const [width, height] = String(resolution || '1920x1080').split('x').map(value => parseInt(value, 10));
    return {
      width: Number.isFinite(width) && width > 0 ? width : 1920,
      height: Number.isFinite(height) && height > 0 ? height : 1080,
    };
  }

  function getPreviewAspectStyle(stage) {
    const dimensions = parseResolution(stage.resolution);
    return `${dimensions.width} / ${dimensions.height}`;
  }

  function getPreviewRenderSize(stage) {
    const dimensions = parseResolution(stage.resolution);
    if (dimensions.width >= dimensions.height) {
      return {
        width: PREVIEW_MAX_SIDE,
        height: Math.max(1, Math.round((PREVIEW_MAX_SIDE * dimensions.height) / dimensions.width)),
      };
    }

    return {
      width: Math.max(1, Math.round((PREVIEW_MAX_SIDE * dimensions.width) / dimensions.height)),
      height: PREVIEW_MAX_SIDE,
    };
  }

  function getPresetLabel(presetId) {
    const normalizedId = String(presetId || '').startsWith('preset:')
      ? String(presetId).slice('preset:'.length)
      : String(presetId || '');
    const preset = loadSavedVisualizationPresets().find(item => item.id === normalizedId);
    return preset ? preset.name || 'Saved preset' : 'Current settings';
  }

  function getPreviewLabel(stage, labelPrefix) {
    const dimensions = parseResolution(stage.resolution);
    return `${labelPrefix}: ${dimensions.width}x${dimensions.height}, ${getPresetLabel(stage.presetId)}`;
  }

  function getVisualizerClass(visualizerName) {
    const library = window.AudioRecorderVisualization || {};
    const visualizerExports = {
      waveform: 'WaveformVisualizer',
      bars: 'BarVisualizer',
      circular: 'CircularVisualizer',
      particles: 'ParticleVisualizer',
      'spectrum-gradient': 'SpectrumGradientVisualizer',
      'glow-waveform': 'GlowWaveformVisualizer',
      'vu-meter': 'VUMeterVisualizer',
      spectrogram: 'SpectrogramVisualizer',
      'spiral-waveform': 'SpiralWaveformVisualizer',
      'radial-bars': 'RadialBarsVisualizer',
      'frequency-rings': 'FrequencyRingsVisualizer',
    };
    return library[visualizerExports[visualizerName]] || library.BarVisualizer || null;
  }

  function clonePlainObject(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (error) {
      return { ...(value || {}) };
    }
  }

  function createPreviewFrequencyData(binCount = PREVIEW_FFT_SIZE / 2) {
    const data = new Uint8Array(binCount);
    const time = 1.35;
    for (let i = 0; i < binCount; i++) {
      const frequency = i / binCount;
      const bass = Math.exp(-frequency * 3) * 200;
      const mid = Math.exp(-Math.pow(frequency - 0.32, 2) * 10) * 150;
      const high = Math.exp(-Math.pow(frequency - 0.7, 2) * 15) * 100;
      const animation = Math.sin(time * 2 + i * 0.1) * 30 + 30;
      data[i] = Math.min(255, Math.max(0, bass + mid + high + animation));
    }
    return data;
  }

  function createPreviewTimeDomainData(length = PREVIEW_FFT_SIZE) {
    const data = new Uint8Array(length);
    const time = 1.35;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const wave1 = Math.sin(t * Math.PI * 4 + time * 2) * 40;
      const wave2 = Math.sin(t * Math.PI * 8 + time * 3) * 20;
      const wave3 = Math.sin(t * Math.PI * 16 + time * 5) * 10;
      data[i] = Math.min(255, Math.max(0, 128 + wave1 + wave2 + wave3));
    }
    return data;
  }

  function resolvePreviewRenderSettings(stage) {
    const app = window.AudioRecorderApp || {};
    const fallbackOptions = typeof app.getCurrentOptions === 'function' ? app.getCurrentOptions() : {};
    const fallbackVisualizer = app.elements?.visualizerSelect?.value || 'bars';
    const settings = getSavedPresetSettings(stage.presetId);

    if (settings) {
      return {
        visualizer: settings.visualizer || fallbackVisualizer,
        visualizerOptions: buildVisualizerOptionsFromSettings(settings, fallbackOptions),
      };
    }

    return {
      visualizer: fallbackVisualizer,
      visualizerOptions: fallbackOptions,
    };
  }

  function getPreviewCacheKey(stage) {
    const dimensions = parseResolution(stage.resolution);
    const settings = resolvePreviewRenderSettings(stage);
    return JSON.stringify({
      width: dimensions.width,
      height: dimensions.height,
      visualizer: settings.visualizer,
      visualizerOptions: settings.visualizerOptions,
    });
  }

  function drawFallbackPreviewFrame(ctx, width, height, visualizerOptions = {}) {
    const primary = visualizerOptions.primaryColor || '#00ff88';
    const secondary = visualizerOptions.secondaryColor || '#0088ff';
    const background = visualizerOptions.backgroundColor || '#05070a';
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(0.52, '#101827');
    gradient.addColorStop(1, '#05070a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const gridSize = Math.max(16, Math.round(Math.min(width, height) / 8));
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    const data = createPreviewFrequencyData(64);
    const barWidth = width / data.length;
    for (let i = 0; i < data.length; i++) {
      const value = data[i] / 255;
      const barHeight = Math.max(2, value * height * 0.55);
      const barGradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      barGradient.addColorStop(0, secondary);
      barGradient.addColorStop(1, primary);
      ctx.fillStyle = barGradient;
      ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth * 0.68), barHeight);
    }

    ctx.save();
    ctx.strokeStyle = primary;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) / 90));
    ctx.shadowColor = primary;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    const waveform = createPreviewTimeDomainData(160);
    waveform.forEach((value, index) => {
      const x = (index / (waveform.length - 1)) * width;
      const y = height * 0.48 + ((value - 128) / 128) * height * 0.18;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  async function createPipelinePreviewDataUrl(stage) {
    const cacheKey = getPreviewCacheKey(stage);
    if (pipelinePreviewCache.has(cacheKey)) {
      return pipelinePreviewCache.get(cacheKey);
    }

    const { width, height } = getPreviewRenderSize(stage);
    const renderSettings = resolvePreviewRenderSettings(stage);
    const promise = (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Preview canvas is not available.');
      }

      const VisualizerClass = getVisualizerClass(renderSettings.visualizer);
      if (!VisualizerClass) {
        drawFallbackPreviewFrame(ctx, width, height, renderSettings.visualizerOptions);
        return canvas.toDataURL('image/png');
      }

      try {
        const options = clonePlainObject(renderSettings.visualizerOptions);
        const visualizer = new VisualizerClass(options);
        await Promise.resolve(visualizer.init(canvas, options));
        visualizer.draw(ctx, {
          timeDomainData: createPreviewTimeDomainData(),
          frequencyData: createPreviewFrequencyData(),
          timestamp: 1350,
          width,
          height,
          sampleRate: 44100,
          fftSize: PREVIEW_FFT_SIZE,
        });
        return canvas.toDataURL('image/png');
      } catch (error) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = width;
        fallbackCanvas.height = height;
        const fallbackCtx = fallbackCanvas.getContext('2d');
        if (!fallbackCtx) {
          throw error;
        }
        drawFallbackPreviewFrame(fallbackCtx, width, height, renderSettings.visualizerOptions);
        return fallbackCanvas.toDataURL('image/png');
      }
    })();

    pipelinePreviewCache.set(cacheKey, promise);
    return promise;
  }

  function applyPipelinePreviewTooltip(element, stage, labelPrefix) {
    element.classList.add('pipeline-preview-trigger');
    element.dataset.tooltip = getPreviewLabel(stage, labelPrefix);
    element.dataset.previewState = 'loading';
    element.title = element.dataset.tooltip;
    element.tabIndex = 0;
    element.style.setProperty('--pipeline-preview-aspect', getPreviewAspectStyle(stage));
    element.setAttribute('aria-label', element.dataset.tooltip);

    createPipelinePreviewDataUrl(stage)
      .then(dataUrl => {
        if (!element.isConnected) return;
        element.style.setProperty('--pipeline-preview-image', `url("${dataUrl}")`);
        element.dataset.previewState = 'ready';
      })
      .catch(error => {
        console.warn('Failed to render pipeline preview:', error);
        if (element.isConnected) {
          element.dataset.previewState = 'error';
        }
      });
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addRelativeOffset(baseDate, stage) {
    const parts = getRelativeOffsetParts(stage);
    const sign = parts.direction === 'before' ? -1 : 1;
    const date = new Date(baseDate.getTime());

    if (parts.months) {
      date.setMonth(date.getMonth() + sign * parts.months);
    }
    if (parts.days) {
      date.setDate(date.getDate() + sign * parts.days);
    }
    if (parts.hours) {
      date.setHours(date.getHours() + sign * parts.hours);
    }
    if (parts.minutes) {
      date.setMinutes(date.getMinutes() + sign * parts.minutes);
    }

    return date;
  }

  function getPipelineAnchorDate() {
    const releaseStage = stages.find(stage => isAlbumStage(stage) && stage.publishAtLocal);
    const absoluteStage = stages.find(stage => stage.scheduleMode === 'absolute' && stage.publishAtLocal);
    return parseLocalDate((releaseStage || absoluteStage || {}).publishAtLocal) ||
      new Date(Date.now() + 15 * 60 * 1000);
  }

  function getRelativeReferenceIndex(stage, index) {
    if (stage.relativeReference === 'next' && index < stages.length - 1) {
      return index + 1;
    }
    if (stage.relativeReference !== 'next' && index > 0) {
      return index - 1;
    }
    if (index > 0) {
      return index - 1;
    }
    if (index < stages.length - 1) {
      return index + 1;
    }
    return -1;
  }

  function computeStageBaseDates(now = new Date()) {
    const dates = stages.map((stage) => {
      if (stage.publishImmediately) {
        return new Date(now.getTime());
      }
      if (stage.scheduleMode === 'absolute') {
        return parseLocalDate(stage.publishAtLocal);
      }
      return null;
    });
    const anchorDate = getPipelineAnchorDate();

    for (let pass = 0; pass < stages.length; pass++) {
      let changed = false;

      stages.forEach((stage, index) => {
        if (dates[index] || stage.publishImmediately || stage.scheduleMode === 'absolute') {
          return;
        }

        const referenceIndex = getRelativeReferenceIndex(stage, index);
        if (referenceIndex >= 0 && dates[referenceIndex]) {
          dates[index] = addRelativeOffset(dates[referenceIndex], stage);
          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }

    return dates.map((date, index) => (
      date || addRelativeOffset(anchorDate, stages[index])
    ));
  }

  function refreshRelativePublishDates() {
    const stageBaseDates = computeStageBaseDates();
    let changed = false;
    stages = stages.map((stage, index) => {
      if (stage.publishImmediately || stage.scheduleMode !== 'relative') {
        return stage;
      }
      const date = stageBaseDates[index];
      if (!date || !Number.isFinite(date.getTime())) {
        return stage;
      }
      const publishAtLocal = toDateTimeLocalValue(date);
      if (stage.publishAtLocal === publishAtLocal) {
        return stage;
      }
      changed = true;
      return { ...stage, publishAtLocal };
    });
    if (changed) {
      saveStages();
    }
    return stageBaseDates;
  }

  function getStageFiles(stage) {
    return selectedFilesByStageId.get(stage.id) || [];
  }

  function getTaskTitle(stage, file, index, totalFiles) {
    if (isAlbumStage(stage)) {
      return (stage.tracks[index] && stage.tracks[index].title) ||
        getTrackTitleFromFileName(file.name, index);
    }
    if (totalFiles > 1) {
      return `${stage.name || 'Pipeline stage'} ${index + 1}`;
    }
    return stage.name || getTrackTitleFromFileName(file.name, index);
  }

  function pluralRu(value, one, few, many) {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function formatDurationParts(parts) {
    const units = [
      ['months', 'мес', 'месяц', 'месяца', 'месяцев'],
      ['days', 'д', 'день', 'дня', 'дней'],
      ['hours', 'ч', 'час', 'часа', 'часов'],
      ['minutes', 'м', 'минута', 'минуты', 'минут'],
    ].filter(([key]) => parts[key] > 0);

    if (!units.length) {
      return '0м';
    }

    if (units.length === 1) {
      const [key, , one, few, many] = units[0];
      const value = parts[key];
      return `${value} ${pluralRu(value, one, few, many)}`;
    }

    return units.map(([key, shortLabel]) => `${parts[key]}${shortLabel}`).join(' ');
  }

  function formatDurationBetweenDates(a, b) {
    let remaining = Math.abs(Math.round((a.getTime() - b.getTime()) / 60000));
    const months = Math.floor(remaining / (30 * 24 * 60));
    remaining -= months * 30 * 24 * 60;
    const days = Math.floor(remaining / (24 * 60));
    remaining -= days * 24 * 60;
    const hours = Math.floor(remaining / 60);
    remaining -= hours * 60;
    return formatDurationParts({ months, days, hours, minutes: remaining });
  }

  function formatRelativeLabel(stageDate, referenceDate, referenceName) {
    const diff = stageDate.getTime() - referenceDate.getTime();
    if (Math.abs(diff) < 60000) {
      return `одновременно с ${referenceName}`;
    }
    const duration = formatDurationBetweenDates(stageDate, referenceDate);
    return diff < 0
      ? `за ${duration} перед ${referenceName}`
      : `через ${duration} после ${referenceName}`;
  }

  function buildPipelineTasks() {
    const stageBaseDates = computeStageBaseDates();
    const tasks = [];

    stages.forEach((stage, stageIndex) => {
      const files = getStageFiles(stage);
      const stageBaseDate = stage.publishImmediately
        ? null
        : stageBaseDates[stageIndex];

      files.forEach((file, fileIndex) => {
        const publishDate = stageBaseDate
          ? new Date(stageBaseDate.getTime() + fileIndex * 60000)
          : null;
        tasks.push({
          stage,
          stageIndex,
          file,
          fileIndex,
          totalFiles: files.length,
          title: getTaskTitle(stage, file, fileIndex, files.length),
          publishAt: publishDate ? publishDate.toISOString() : undefined,
        });
      });
    });

    return tasks;
  }

  function getStageDisplayDate(stage) {
    if (!actionIncludesUpload(stage.action)) {
      return '';
    }
    if (stage.publishImmediately) {
      return 'Immediately';
    }
    if (stage.scheduleMode === 'absolute' && stage.publishAtLocal) {
      return stage.publishAtLocal.replace('T', ' ');
    }
    const offset = Number(stage.relativeOffsetMinutes || 0);
    const sign = offset > 0 ? '+' : '';
    return `${sign}${offset} min`;
  }

  function setActiveStage(stageId) {
    activeStageId = stageId || '';
    if (!stageNav) {
      return;
    }
    stageNav.querySelectorAll('.pipeline-stage-nav-btn').forEach(button => {
      const isActive = button.dataset.stageId === activeStageId;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        button.setAttribute('aria-current', 'step');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }

  function refreshStageObserver() {
    if (stageObserver) {
      stageObserver.disconnect();
      stageObserver = null;
    }

    const stageItems = Array.from(stagesContainer.querySelectorAll('.pipeline-stage'));
    if (!stageItems.length || typeof IntersectionObserver !== 'function') {
      setActiveStage(stageItems[0]?.dataset.stageId || '');
      return;
    }

    stageObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) {
        setActiveStage(visible[0].target.dataset.stageId);
      }
    }, {
      root: null,
      rootMargin: '-18% 0px -55% 0px',
      threshold: [0, 0.2, 0.6],
    });

    stageItems.forEach(item => stageObserver.observe(item));
    setActiveStage(activeStageId && stageItems.some(item => item.dataset.stageId === activeStageId)
      ? activeStageId
      : stageItems[0].dataset.stageId);
  }

  function scrollToStage(stageId) {
    const stageElement = stagesContainer.querySelector(`[data-stage-id="${stageId}"]`);
    if (!stageElement) {
      return;
    }
    setActiveStage(stageId);
    const behavior = window.Cypress ? 'auto' : 'smooth';
    stageElement.scrollIntoView({ behavior, block: 'start' });
  }

  function renderStageNav() {
    if (!stageNav) {
      return;
    }
    stageNav.innerHTML = '';
    if (!stages.length) {
      stageNav.hidden = true;
      return;
    }

    stageNav.hidden = false;
    stages.forEach((stage, index) => {
      const button = document.createElement('button');
      const dateText = getStageDisplayDate(stage);
      button.type = 'button';
      button.className = 'pipeline-stage-nav-btn';
      button.dataset.stageId = stage.id;
      button.setAttribute('aria-label', `Go to stage ${index + 1}: ${stage.name || 'Untitled stage'}`);
      button.addEventListener('click', () => scrollToStage(stage.id));

      const number = document.createElement('span');
      number.className = 'pipeline-stage-nav-number';
      number.textContent = String(index + 1);

      const details = document.createElement('span');
      details.className = 'pipeline-stage-nav-details';

      const title = document.createElement('span');
      title.className = 'pipeline-stage-nav-title';
      title.textContent = stage.name || 'Untitled stage';

      const meta = document.createElement('span');
      meta.className = 'pipeline-stage-nav-meta';
      meta.textContent = [
        getStageActionLabel(stage.action),
        dateText,
      ].filter(Boolean).join(' · ');

      details.appendChild(title);
      details.appendChild(meta);
      button.appendChild(number);
      button.appendChild(details);
      stageNav.appendChild(button);
    });
    setActiveStage(activeStageId || stages[0].id);
  }

  function getSavedPresetSettings(presetId) {
    if (!presetId) {
      return null;
    }

    const id = String(presetId).startsWith('preset:')
      ? String(presetId).slice('preset:'.length)
      : String(presetId);
    const preset = loadSavedVisualizationPresets().find(item => item.id === id);
    return preset && preset.settings ? preset.settings : null;
  }

  function numberSetting(settings, key, fallback) {
    const value = Number(settings[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function buildVisualizerOptionsFromSettings(settings = {}, fallbackOptions = {}) {
    const useCustomColors = Boolean(settings.useCustomColors);
    const custom = {
      ...(fallbackOptions.custom || {}),
      useColorGradient: useCustomColors,
      useCustomColors,
      barShape: settings.barShape || fallbackOptions.custom?.barShape,
      particleShape: settings.particleShape || fallbackOptions.custom?.particleShape,
    };

    if (useCustomColors) {
      custom.colorScheme = 'custom';
      custom.fillStyle = 'custom';
    }

    const options = {
      ...fallbackOptions,
      primaryColor: settings.primaryColor || fallbackOptions.primaryColor,
      secondaryColor: settings.secondaryColor || fallbackOptions.secondaryColor,
      backgroundColor: settings.backgroundColor || fallbackOptions.backgroundColor,
      barCount: numberSetting(settings, 'barCount', fallbackOptions.barCount),
      frequencyWidth: numberSetting(settings, 'frequencyWidth', fallbackOptions.frequencyWidth),
      sensitivity: numberSetting(settings, 'sensitivity', fallbackOptions.sensitivity),
      adsrAttack: numberSetting(settings, 'adsrAttack', fallbackOptions.adsrAttack),
      adsrDecay: numberSetting(settings, 'adsrDecay', fallbackOptions.adsrDecay),
      adsrSustain: numberSetting(settings, 'adsrSustain', fallbackOptions.adsrSustain),
      adsrRelease: numberSetting(settings, 'adsrRelease', fallbackOptions.adsrRelease),
      mirror: settings.mirror !== undefined ? Boolean(settings.mirror) : fallbackOptions.mirror,
      mirrorHorizontal: settings.mirrorHorizontal !== undefined
        ? Boolean(settings.mirrorHorizontal)
        : fallbackOptions.mirrorHorizontal,
      visualizationAlpha: numberSetting(settings, 'visualizationAlpha', fallbackOptions.visualizationAlpha),
      offsetX: numberSetting(settings, 'offsetX', fallbackOptions.offsetX),
      offsetY: numberSetting(settings, 'offsetY', fallbackOptions.offsetY),
      scale: settings.visualizationScale !== undefined
        ? numberSetting(settings, 'visualizationScale', 100) / 100
        : fallbackOptions.scale,
      backgroundSizeMode: settings.backgroundSizeMode || fallbackOptions.backgroundSizeMode,
      layerEffect: settings.layerEffect || fallbackOptions.layerEffect,
      layerEffectIntensity: numberSetting(settings, 'layerEffectIntensity', fallbackOptions.layerEffectIntensity),
      custom,
    };

    if (settings.backgroundImage) {
      options.backgroundImage = settings.backgroundImage;
    }
    if (settings.backgroundSizeMode === 'custom') {
      options.backgroundWidth = numberSetting(settings, 'backgroundWidth', fallbackOptions.backgroundWidth);
      options.backgroundHeight = numberSetting(settings, 'backgroundHeight', fallbackOptions.backgroundHeight);
    }
    if (settings.centerImage) {
      options.custom.centerImage = settings.centerImage;
      options.custom.centerImageZoom = numberSetting(settings, 'centerImageZoom', 100) / 100;
      options.custom.centerImageOffsetX = numberSetting(settings, 'centerImageOffsetX', 0);
      options.custom.centerImageOffsetY = numberSetting(settings, 'centerImageOffsetY', 0);
    }
    if (settings.imageBlinkEnabled !== undefined) {
      options.imageBlinkEnabled = Boolean(settings.imageBlinkEnabled);
      options.imageBlinkFrequencyRange = {
        min: numberSetting(settings, 'imageBlinkFrequencyMin', 80),
        max: numberSetting(settings, 'imageBlinkFrequencyMax', 4000),
      };
      options.imageBlinkVolumeThreshold = numberSetting(settings, 'imageBlinkThreshold', 50);
      options.imageBlinkStyle = settings.imageBlinkStyle || 'pulse';
      options.imageBlinkIntensity = numberSetting(settings, 'imageBlinkIntensity', 50);
      options.imageBlinkTarget = settings.imageBlinkTarget || 'center';
      options.imageBlinkDuration = numberSetting(settings, 'imageBlinkDuration', 100);
    }

    return options;
  }

  function buildAudioEnhancementFromSettings(settings = {}, fallbackAudio = {}) {
    const minHz = numberSetting(settings, 'saturationMin', fallbackAudio.saturationFrequencyRange?.min || 80);
    const maxHz = numberSetting(settings, 'saturationMax', fallbackAudio.saturationFrequencyRange?.max || 12000);

    return {
      ...fallbackAudio,
      enabled: settings.audioEnhancementEnabled !== undefined
        ? Boolean(settings.audioEnhancementEnabled)
        : fallbackAudio.enabled,
      noiseReduction: numberSetting(settings, 'noiseReduction', fallbackAudio.noiseReduction),
      noiseProfile: settings.noiseProfile || fallbackAudio.noiseProfile,
      noiseProfileReduction: numberSetting(settings, 'noiseProfileReduction', fallbackAudio.noiseProfileReduction),
      noiseProfileVoiceProtection: numberSetting(settings, 'noiseProfileVoiceProtection', fallbackAudio.noiseProfileVoiceProtection),
      smartNormalization: numberSetting(settings, 'smartNormalization', fallbackAudio.smartNormalization),
      saturation: numberSetting(settings, 'saturation', fallbackAudio.saturation),
      saturationFrequencyRange: {
        min: Math.min(minHz, maxHz),
        max: Math.max(minHz, maxHz),
      },
      saturationMode: settings.saturationMode || fallbackAudio.saturationMode,
    };
  }

  function resolveRenderSettings(stage, app) {
    const fallbackOptions = typeof app.getCurrentOptions === 'function' ? app.getCurrentOptions() : {};
    const fallbackAudio = typeof app.getCurrentAudioEnhancement === 'function'
      ? app.getCurrentAudioEnhancement()
      : {};
    const fallbackVisualizer = app.elements?.visualizerSelect?.value || 'bars';
    let settings = null;

    settings = getSavedPresetSettings(stage.presetId);

    if (!settings) {
      throw new Error('Choose a saved visualization preset before rendering pipeline stages.');
    }

    return {
      visualizer: settings.visualizer || fallbackVisualizer,
      visualizerOptions: buildVisualizerOptionsFromSettings(settings, fallbackOptions),
      audioEnhancement: buildAudioEnhancementFromSettings(settings, fallbackAudio),
    };
  }

  function getRequestedVideoFormat(app) {
    return app.elements?.videoFormat?.value || 'webm';
  }

  async function renderTask(task, taskIndex, totalTasks) {
    const app = getPipelineApp();
    const dimensions = parseResolution(task.stage.resolution);
    const renderSettings = resolveRenderSettings(task.stage, app);

    updateAppStatus(`Pipeline rendering ${taskIndex + 1} of ${totalTasks}: ${task.title}`, 'recording');

    const result = await app.converter.convertWithFallback({
      audioSource: task.file,
      canvas: app.canvas,
      visualizer: renderSettings.visualizer,
      visualizerOptions: renderSettings.visualizerOptions,
      audioEnhancement: renderSettings.audioEnhancement,
      fps: 30,
      videoWidth: dimensions.width,
      videoHeight: dimensions.height,
      format: getRequestedVideoFormat(app),
      onProgress: progress => {
        const percent = Math.round(Number(progress?.percent || 0) * 100);
        updateAppStatus(
          `Pipeline rendering ${taskIndex + 1} of ${totalTasks}: ${task.title} (${percent}%)`,
          'recording'
        );
      },
    });

    if (typeof app.addRecording === 'function') {
      app.addRecording(result.blob, {
        sourceName: task.file.name,
        format: result.format,
      });
    }

    return result;
  }

  function collectTaskMetadata(task) {
    const stage = task.stage;
    return {
      title: task.title,
      description: stage.description || '',
      tags: stage.tags || '',
      playlistIds: stage.playlistIds || '',
      privacyStatus: stage.privacyStatus || 'private',
      publishAt: task.publishAt,
      selfDeclaredMadeForKids: Boolean(stage.madeForKids),
      containsSyntheticMedia: Boolean(stage.syntheticMedia),
      short: Boolean(stage.short),
    };
  }

  async function uploadTask(task, video, taskIndex, totalTasks) {
    const youtube = window.AudioRecorderYouTube;
    updateAppStatus(`Pipeline uploading ${taskIndex + 1} of ${totalTasks}: ${task.title}`, 'recording');

    return youtube.uploadDirect({
      video,
      thumbnail: selectedCoversByStageId.get(task.stage.id),
      metadata: collectTaskMetadata(task),
      notifySubscribers: Boolean(task.stage.notifySubscribers),
      onProgress: progress => {
        const percent = Math.round(Number(progress?.percent || 0) * 100);
        updateAppStatus(
          `Pipeline uploading ${taskIndex + 1} of ${totalTasks}: ${task.title} (${percent}%)`,
          'recording'
        );
      },
    });
  }

  function assertUploadReady(tasks) {
    if (!tasks.some(task => actionIncludesUpload(task.stage.action))) {
      return;
    }

    const youtube = window.AudioRecorderYouTube;
    if (!youtube || typeof youtube.uploadDirect !== 'function') {
      throw new Error('YouTube upload is not ready. Run npm run build before using upload pipeline stages.');
    }
    if (typeof youtube.hasValidAccessToken === 'function' && !youtube.hasValidAccessToken()) {
      throw new Error('Sign in to YouTube before running upload pipeline stages.');
    }
  }

  async function executePipelineTask(task, taskIndex, totalTasks) {
    if (task.stage.action === 'upload-youtube') {
      const result = await uploadTask(task, task.file, taskIndex, totalTasks);
      return createUploadReport(task, result);
    }

    const rendered = await renderTask(task, taskIndex, totalTasks);
    if (task.stage.action === 'visualize-upload') {
      const result = await uploadTask(task, rendered.blob, taskIndex, totalTasks);
      return createUploadReport(task, result);
    }
    return null;
  }

  function createUploadReport(task, result = {}) {
    const publishAt = task.publishAt || new Date().toISOString();
    return {
      title: task.title,
      id: result.id || '',
      url: result.url || (result.id ? `https://www.youtube.com/watch?v=${result.id}` : ''),
      publishAt,
      playlistIds: task.stage.playlistIds || '',
    };
  }

  function formatReportDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Immediately';
    }

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: pipelineTimezone || undefined,
      }).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  }

  function hidePipelineReport() {
    reportModal.style.display = 'none';
  }

  function showPipelineReport(uploadReports = [], totalTasks = 0) {
    reportSummary.textContent = uploadReports.length
      ? `Pipeline complete: ${totalTasks} task${totalTasks === 1 ? '' : 's'} finished, ${uploadReports.length} YouTube upload${uploadReports.length === 1 ? '' : 's'} scheduled.`
      : `Pipeline complete: ${totalTasks} task${totalTasks === 1 ? '' : 's'} finished.`;
    reportList.innerHTML = '';
    reportList.style.display = uploadReports.length ? '' : 'none';

    [...uploadReports]
      .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime())
      .forEach((report, index) => {
        const item = document.createElement('li');

        const titleLine = document.createElement('div');
        titleLine.className = 'pipeline-report-title';
        const indexSpan = document.createElement('span');
        indexSpan.textContent = `${index + 1}. `;
        const title = document.createElement('strong');
        title.textContent = report.title || `YouTube upload ${index + 1}`;
        titleLine.appendChild(indexSpan);
        titleLine.appendChild(title);

        if (report.url) {
          const link = document.createElement('a');
          link.href = report.url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = report.id || 'Open video';
          titleLine.appendChild(document.createTextNode(' '));
          titleLine.appendChild(link);
        }

        const dateLine = document.createElement('div');
        dateLine.className = 'pipeline-report-date';
        dateLine.textContent = `Publish date: ${formatReportDate(report.publishAt)}`;

        item.appendChild(titleLine);
        item.appendChild(dateLine);

        if (String(report.playlistIds || '').trim()) {
          const playlists = document.createElement('div');
          playlists.className = 'pipeline-report-playlists';
          playlists.textContent = `Playlists: ${report.playlistIds}`;
          item.appendChild(playlists);
        }

        reportList.appendChild(item);
      });

    reportModal.style.display = 'flex';
  }

  async function runPipeline() {
    if (isPipelineRunning) return;

    const firstError = getPipelineValidationError();
    if (firstError) {
      updateAppStatus(firstError, 'error');
      updateRunState();
      return;
    }

    const tasks = buildPipelineTasks();
    if (!tasks.length) {
      updateAppStatus('Select files before running the pipeline.', 'error');
      updateRunState();
      return;
    }

    hasPipelineRun = true;
    isPipelineRunning = true;
    updateRunState();

    try {
      assertUploadReady(tasks);
      const uploadReports = [];

      for (let index = 0; index < tasks.length; index++) {
        const report = await executePipelineTask(tasks[index], index, tasks.length);
        if (report) {
          uploadReports.push(report);
        }
      }

      updateAppStatus(
        `Pipeline complete: ${tasks.length} task${tasks.length === 1 ? '' : 's'} finished`,
        'ready'
      );
      showPipelineReport(uploadReports, tasks.length);
    } catch (error) {
      console.error('Pipeline failed:', error);
      updateAppStatus(`Pipeline failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      isPipelineRunning = false;
      updateRunState();
    }
  }

  function renderFileCell(stage) {
    const cell = document.createElement('div');
    cell.className = 'pipeline-file-cell';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pipeline-file-btn${hasStageFiles(stage) ? ' has-files' : ''}`;
    button.dataset.tooltip = 'Select one or more source files for this pipeline stage.';
    button.title = button.dataset.tooltip;
    const selected = selectedFilesByStageId.get(stage.id) || [];
    button.textContent = selected.length
      ? selected.map(file => file.name).join(', ')
      : 'УКАЖИТЕ ФАЙЛ/ФАЙЛЫ';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'audio/*,video/*';
    fileInput.className = 'pipeline-stage-file-input pipeline-file-input';
    fileInput.setAttribute('aria-label', `Select files for ${stage.name || 'pipeline stage'}`);
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      selectedFilesByStageId.set(stage.id, files);
      const changes = { fileNames: files.map(file => file.name) };
      if (isAlbumStage(stage) && files.length) {
        changes.tracks = createTracksFromFiles(files);
      }
      updateStage(stage.id, changes, true);
    });

    button.addEventListener('click', () => fileInput.click());

    const names = document.createElement('div');
    names.className = 'pipeline-file-names';
    names.textContent = selected.length
      ? `${selected.length} selected`
      : stage.fileNames.length ? `Last: ${stage.fileNames.join(', ')}` : '';

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn-secondary compact-btn pipeline-reset-files-btn';
    reset.textContent = 'Сбросить файлы';
    reset.disabled = !selected.length && !stage.fileNames.length;
    reset.dataset.tooltip = 'Clear files added to this stage.';
    reset.title = reset.dataset.tooltip;
    reset.addEventListener('click', () => {
      selectedFilesByStageId.delete(stage.id);
      if (isAlbumStage(stage)) {
        updateStage(stage.id, { fileNames: [], tracks: [] }, true);
      } else {
        updateStage(stage.id, { fileNames: [] }, true);
      }
    });

    cell.appendChild(button);
    cell.appendChild(reset);
    cell.appendChild(fileInput);
    cell.appendChild(names);
    return cell;
  }

  function renderAlbumEditor(stage) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pipeline-album-editor';

    const typeField = createField('Release type', 'span-4', 'Choose whether this release renders as one video or one video per album track.');
    const releaseType = document.createElement('select');
    setSelectOptions(releaseType, [
      ['album', 'Album'],
      ['single', 'Single'],
    ], stage.releaseType || 'album');
    releaseType.addEventListener('change', () => {
      updateStage(stage.id, { releaseType: releaseType.value }, true);
    });
    typeField.appendChild(releaseType);
    wrapper.appendChild(typeField);

    const imageField = createField('YouTube cover', 'span-4', 'Optional thumbnail used for YouTube uploads from this album stage.');
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/jpeg,image/png,image/webp';
    imageInput.addEventListener('change', () => {
      const image = imageInput.files && imageInput.files[0];
      if (image) {
        selectedCoversByStageId.set(stage.id, image);
      } else {
        selectedCoversByStageId.delete(stage.id);
      }
      updateStage(stage.id, { sharedImageName: image ? image.name : '' }, true);
    });
    imageField.appendChild(imageInput);
    wrapper.appendChild(imageField);

    const presetField = createField('Album preset', 'span-4', 'Visualizer preset used for album render tasks.');
    const presetSelect = document.createElement('select');
    setSelectOptions(presetSelect, getPresetChoices(), stage.presetId || 'current');
    presetSelect.addEventListener('change', () => {
      updateStage(stage.id, { presetId: presetSelect.value });
    });
    presetField.appendChild(presetSelect);
    wrapper.appendChild(presetField);

    if ((stage.releaseType || 'album') === 'album') {
      const tracks = document.createElement('div');
      tracks.className = 'pipeline-album-tracks';
      stage.tracks.forEach((track, index) => {
        const row = document.createElement('div');
        row.className = 'pipeline-album-track';
        row.draggable = true;
        row.dataset.trackId = track.id;

        const handle = document.createElement('span');
        handle.className = 'pipeline-track-handle';
        handle.textContent = String(index + 1);
        applyPipelinePreviewTooltip(handle, stage, `Track ${index + 1} preview`);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.title;
        input.className = 'pipeline-track-title';
        input.setAttribute('aria-label', `Album track ${index + 1} title`);
        input.title = 'Rendered video title for this album track.';
        input.addEventListener('input', () => updateTrack(stage.id, track.id, { title: input.value }));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-danger pipeline-track-remove';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove album track ${index + 1}`);
        remove.addEventListener('click', () => {
          updateStage(stage.id, { tracks: stage.tracks.filter(item => item.id !== track.id) }, true);
        });

        row.addEventListener('dragstart', event => {
          draggedTrack = { stageId: stage.id, trackId: track.id };
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', track.id);
        });
        row.addEventListener('dragover', event => {
          if (draggedTrack && draggedTrack.stageId === stage.id && draggedTrack.trackId !== track.id) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        });
        row.addEventListener('drop', event => {
          event.preventDefault();
          const sourceTrackId = event.dataTransfer.getData('text/plain') || draggedTrack?.trackId;
          moveTrack(stage.id, sourceTrackId, track.id);
          draggedTrack = null;
        });
        row.addEventListener('dragend', () => {
          draggedTrack = null;
        });

        row.appendChild(handle);
        row.appendChild(input);
        row.appendChild(remove);
        tracks.appendChild(row);
      });

      const addTrack = document.createElement('button');
      addTrack.type = 'button';
      addTrack.className = 'btn-secondary compact-btn';
      addTrack.textContent = '+ Track';
      addTrack.dataset.tooltip = 'Add one or more album track files.';
      addTrack.title = addTrack.dataset.tooltip;

      const addTrackInput = document.createElement('input');
      addTrackInput.type = 'file';
      addTrackInput.multiple = true;
      addTrackInput.accept = 'audio/*,video/*';
      addTrackInput.className = 'pipeline-add-track-input pipeline-file-input';
      addTrackInput.setAttribute('aria-label', `Add track files for ${stage.name || 'album stage'}`);
      addTrackInput.addEventListener('change', () => {
        const files = Array.from(addTrackInput.files || []);
        if (!files.length) {
          return;
        }

        const existingFiles = selectedFilesByStageId.get(stage.id) || [];
        const nextFiles = [...existingFiles, ...files];
        selectedFilesByStageId.set(stage.id, nextFiles);
        updateStage(stage.id, {
          fileNames: nextFiles.map(file => file.name),
          tracks: [
            ...stage.tracks,
            ...files.map((file, offset) => createTrack(getTrackTitleFromFileName(file.name, stage.tracks.length + offset), stage.tracks.length + offset)),
          ],
        }, true);
      });
      addTrack.addEventListener('click', () => {
        addTrackInput.click();
      });

      tracks.appendChild(addTrack);
      tracks.appendChild(addTrackInput);
      wrapper.appendChild(tracks);
    }

    return wrapper;
  }

  function renderYouTubeDetails(stage) {
    const details = document.createElement('details');
    details.className = 'pipeline-youtube-details';
    details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = 'YouTube details';
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'pipeline-youtube-grid';

    const descriptionField = createField('Description', 'span-12', 'YouTube description applied to uploads from this stage.');
    const description = document.createElement('textarea');
    description.rows = 2;
    description.value = stage.description || '';
    description.className = 'pipeline-stage-description';
    description.addEventListener('input', () => updateStage(stage.id, { description: description.value }));
    descriptionField.appendChild(description);
    grid.appendChild(descriptionField);

    const tagsField = createField('Tags', 'span-12', 'Comma-separated YouTube tags applied to uploads from this stage.');
    const tags = document.createElement('input');
    tags.type = 'text';
    tags.value = stage.tags || '';
    tags.className = 'pipeline-stage-tags';
    tags.addEventListener('input', () => updateStage(stage.id, { tags: tags.value }));
    tagsField.appendChild(tags);
    grid.appendChild(tagsField);

    const playlistField = createField('Playlists', 'span-12', 'Choose existing YouTube playlists or create a new playlist.');
    const playlistChooser = renderPlaylistChooser(stage, (playlistIds) => {
      updateStage(stage.id, { playlistIds }, true);
    });
    playlistField.appendChild(playlistChooser);
    grid.appendChild(playlistField);

    [
      ['short', 'Short (#shorts)', 'Mark this pipeline video as a YouTube Short', 'Adds #shorts to the description for portrait short-form uploads.'],
      ['madeForKids', 'Made for kids', 'Mark this pipeline video as made for kids', 'Sets YouTube self-declared made-for-kids status.'],
      ['syntheticMedia', 'Synthetic media', 'Mark this pipeline video as containing synthetic media', 'Sets YouTube synthetic-media disclosure metadata.'],
      ['notifySubscribers', 'Notify subscribers', 'Notify subscribers for this pipeline upload', 'Requests subscriber notifications when YouTube accepts them for the upload.'],
    ].forEach(([key, labelText, ariaLabel, tooltip]) => {
      const label = document.createElement('label');
      label.className = 'pipeline-field pipeline-inline-check span-4';
      label.dataset.tooltip = tooltip;
      label.title = tooltip;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(stage[key]);
      checkbox.setAttribute('aria-label', ariaLabel);
      checkbox.addEventListener('change', () => updateStage(stage.id, { [key]: checkbox.checked }));
      const text = document.createElement('span');
      text.className = 'pipeline-check-text';
      text.textContent = labelText;
      label.appendChild(checkbox);
      label.appendChild(text);
      grid.appendChild(label);
    });

    details.appendChild(grid);
    return details;
  }

  function renderPlaylistChooser(stage, onChange) {
    const selectedIds = getPlaylistIds(stage.playlistIds);
    const youtube = window.AudioRecorderYouTube;
    const known = youtube && typeof youtube.getSavedPlaylists === 'function'
      ? youtube.getSavedPlaylists()
      : loadSavedYouTubePlaylists();
    selectedIds.forEach(id => {
      if (!known.some(item => item.id === id)) {
        known.push({ id, title: id });
      }
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'youtube-playlist-selector pipeline-playlist-selector';

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.className = 'pipeline-stage-playlist-ids';
    hidden.value = selectedIds.join(', ');
    wrapper.appendChild(hidden);

    const list = document.createElement('div');
    list.className = 'youtube-playlist-list';
    const setSelectedIds = (ids) => {
      const nextIds = ids.filter((item, index, list) => list.indexOf(item) === index);
      hidden.value = nextIds.join(', ');
      onChange(nextIds.join(', '));
    };

    known.forEach(playlist => {
      const label = document.createElement('label');
      label.className = 'youtube-playlist-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIds.includes(playlist.id);
      checkbox.addEventListener('change', () => {
        const nextIds = checkbox.checked
          ? [...selectedIds, playlist.id]
          : selectedIds.filter(id => id !== playlist.id);
        setSelectedIds(nextIds);
      });
      const text = document.createElement('span');
      text.textContent = playlist.title || playlist.id;
      label.appendChild(checkbox);
      label.appendChild(text);
      list.appendChild(label);
    });

    if (!known.length) {
      const empty = document.createElement('div');
      empty.className = 'youtube-playlist-empty';
      empty.textContent = youtube && typeof youtube.hasValidAccessToken === 'function' && youtube.hasValidAccessToken()
        ? 'No playlists loaded yet'
        : 'Sign in to load YouTube playlists';
      list.appendChild(empty);
    }

    const actions = document.createElement('div');
    actions.className = 'youtube-playlist-actions';
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'btn-secondary compact-btn';
    refreshButton.textContent = 'Refresh';
    refreshButton.disabled = !youtube ||
      typeof youtube.refreshPlaylists !== 'function' ||
      (typeof youtube.hasValidAccessToken === 'function' && !youtube.hasValidAccessToken()) ||
      (typeof youtube.hasPlaylistScope === 'function' && !youtube.hasPlaylistScope());
    refreshButton.addEventListener('click', async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing...';
      try {
        await youtube.refreshPlaylists({ force: true });
        renderStages();
      } catch (error) {
        updateAppStatus(error.message || 'Unable to load YouTube playlists.', 'error');
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh';
      }
    });
    actions.appendChild(refreshButton);

    const createRow = document.createElement('div');
    createRow.className = 'youtube-playlist-create';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New playlist name';
    input.setAttribute('aria-label', 'New YouTube playlist name');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-secondary compact-btn';
    button.textContent = 'Create new';
    button.addEventListener('click', async () => {
      const title = input.value.trim();
      if (!title) {
        input.focus();
        return;
      }
      if (!youtube || typeof youtube.createPlaylist !== 'function') {
        updateAppStatus('Sign in to YouTube before creating playlists.', 'error');
        input.focus();
        return;
      }
      button.disabled = true;
      button.textContent = 'Creating...';
      try {
        const playlist = await youtube.createPlaylist(title);
        setSelectedIds([...selectedIds, playlist.id]);
      } catch (error) {
        updateAppStatus(error.message || 'Unable to create YouTube playlist.', 'error');
        input.focus();
      } finally {
        button.disabled = false;
        button.textContent = 'Create new';
      }
    });
    createRow.appendChild(input);
    createRow.appendChild(button);

    wrapper.appendChild(list);
    wrapper.appendChild(actions);
    wrapper.appendChild(createRow);
    return wrapper;
  }

  function renderStages() {
    stagesContainer.innerHTML = '';
    const stageBaseDates = refreshRelativePublishDates();

    if (!stages.length) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = 'No stages yet.';
      stagesContainer.appendChild(empty);
      renderStageNav();
      updateRunState();
      refreshStageObserver();
      return;
    }

    stages.forEach((stage, index) => {
      const item = document.createElement('div');
      const scheduleClass = stage.publishImmediately
        ? 'schedule-immediate'
        : stage.scheduleMode === 'absolute'
          ? 'schedule-absolute'
          : 'schedule-relative';
      item.className = `pipeline-stage ${scheduleClass}${validateStage(stage, index, stageBaseDates) ? ' is-invalid' : ''}`;
      item.dataset.stageId = stage.id;

      const fileCell = renderFileCell(stage);

      const number = document.createElement('span');
      number.className = 'pipeline-stage-number';
      number.textContent = String(index + 1);
      applyPipelinePreviewTooltip(number, stage, `Stage ${index + 1} preview`);

      const fields = document.createElement('div');
      fields.className = 'pipeline-stage-fields';

      const nameField = createField('Video name', 'span-4', 'Title used for rendered videos and YouTube uploads from this stage.');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = stage.name || '';
      nameInput.className = 'pipeline-stage-name';
      nameInput.setAttribute('aria-label', `Stage ${index + 1} video name`);
      nameInput.addEventListener('input', () => {
        updateStage(stage.id, { name: nameInput.value });
      });
      nameField.appendChild(nameInput);

      const actionField = createField('Action', 'span-4', 'Choose whether the stage renders visualization, uploads to YouTube, or does both.');
      const actionSelect = document.createElement('select');
      setSelectOptions(actionSelect, [
        ['visualize-upload', 'Visualization + upload'],
        ['upload-youtube', 'Upload to YouTube'],
        ['visualize-only', 'Visualization only'],
      ], stage.action || 'visualize-upload');
      actionSelect.addEventListener('change', () => {
        updateStage(stage.id, { action: actionSelect.value }, true);
      });
      actionField.appendChild(actionSelect);

      const isImmediate = Boolean(stage.publishImmediately);
      const isRelative = !isImmediate && stage.scheduleMode === 'relative';
      const isAbsolute = !isImmediate && stage.scheduleMode === 'absolute';

      const timingField = createField('Timing', 'span-4', 'Choose whether this stage publishes relative to another stage or on an exact date.');
      const scheduleMode = document.createElement('select');
      setSelectOptions(scheduleMode, [
        ['relative', 'Relative'],
        ['absolute', 'Absolute'],
      ], stage.scheduleMode || 'relative');
      scheduleMode.disabled = isImmediate;
      scheduleMode.addEventListener('change', () => {
        updateStage(stage.id, { scheduleMode: scheduleMode.value }, true);
      });
      timingField.appendChild(scheduleMode);

      const publishField = createField('Publish date', 'span-4', 'Absolute publication date, also used as the release date base when this stage is switched to absolute timing.');
      const publishAt = document.createElement('input');
      publishAt.type = 'datetime-local';
      publishAt.value = stage.scheduleMode === 'relative' && stageBaseDates[index]
        ? toDateTimeLocalValue(stageBaseDates[index])
        : stage.publishAtLocal || '';
      publishAt.className = 'pipeline-publish-at';
      publishAt.disabled = !isAbsolute;
      publishAt.addEventListener('focus', openTimezoneModalIfNeeded);
      publishAt.addEventListener('input', () => updateStage(stage.id, { publishAtLocal: publishAt.value }));
      publishField.appendChild(publishAt);

      const referenceField = createField('Relative to', 'span-2', 'Choose whether this relative date is calculated from the previous or next stage.');
      const relativeReference = document.createElement('select');
      const referenceOptions = [];
      if (index > 0) {
        referenceOptions.push(['previous', 'Previous']);
      }
      if (index < stages.length - 1) {
        referenceOptions.push(['next', 'Next']);
      }
      setSelectOptions(relativeReference, referenceOptions.length ? referenceOptions : [['previous', 'Previous']], stage.relativeReference || 'previous');
      relativeReference.disabled = !isRelative || referenceOptions.length < 2;
      relativeReference.className = 'pipeline-relative-reference';
      relativeReference.addEventListener('change', () => {
        updateStage(stage.id, { relativeReference: relativeReference.value }, true);
      });
      referenceField.appendChild(relativeReference);

      const directionField = createField('Position', 'span-2', 'Choose whether this stage publishes before or after its relative reference stage.');
      const relativeDirection = document.createElement('select');
      setSelectOptions(relativeDirection, [
        ['before', 'Before'],
        ['after', 'After'],
      ], stage.relativeOffsetDirection || 'after');
      relativeDirection.disabled = !isRelative;
      relativeDirection.className = 'pipeline-relative-direction';
      relativeDirection.addEventListener('change', () => {
        updateStage(stage.id, { relativeOffsetDirection: relativeDirection.value }, true);
      });
      directionField.appendChild(relativeDirection);

      const relativeParts = getRelativeOffsetParts(stage);
      const relativeInputs = [
        ['Months', 'relativeOffsetMonths', 'months', relativeParts.months],
        ['Days', 'relativeOffsetDays', 'days', relativeParts.days],
        ['Hours', 'relativeOffsetHours', 'hours', relativeParts.hours],
        ['Minutes', 'relativeOffsetUnitMinutes', 'minutes', relativeParts.minutes],
      ].map(([label, key, classSuffix, value]) => {
        const field = createField(label, 'span-2', `Relative publication offset ${label.toLowerCase()}.`);
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '1';
        input.value = String(value);
        input.disabled = !isRelative;
        input.className = `pipeline-relative-offset pipeline-relative-${classSuffix}`;
        input.addEventListener('input', () => {
          updateStage(stage.id, { [key]: input.value }, true);
        });
        field.appendChild(input);
        return field;
      });

      const relativeSummary = document.createElement('div');
      relativeSummary.className = 'pipeline-relative-summary';
      [
        index > 0 ? [index - 1, stages[index - 1]] : null,
        index < stages.length - 1 ? [index + 1, stages[index + 1]] : null,
      ].filter(Boolean).forEach(([neighborIndex, neighborStage]) => {
        const line = document.createElement('div');
        line.textContent = formatRelativeLabel(
          stageBaseDates[index],
          stageBaseDates[neighborIndex],
          neighborStage.name || `Stage ${neighborIndex + 1}`
        );
        relativeSummary.appendChild(line);
      });

      fields.appendChild(nameField);
      fields.appendChild(actionField);
      fields.appendChild(timingField);
      fields.appendChild(publishField);
      fields.appendChild(referenceField);
      fields.appendChild(directionField);
      relativeInputs.forEach(field => fields.appendChild(field));
      fields.appendChild(relativeSummary);

      if (actionIncludesVisualization(stage.action)) {
        const resolutionField = createField('Resolution', 'span-3', 'Video dimensions for visualization render tasks.');
        const resolution = document.createElement('select');
        setSelectOptions(resolution, [
          ['1920x1080', '1920x1080'],
          ['1080x1920', '1080x1920'],
          ['1080x1080', '1080x1080'],
          ['3840x2160', '3840x2160'],
        ], stage.resolution || '1920x1080');
        resolution.addEventListener('change', () => updateStage(stage.id, { resolution: resolution.value }));
        resolutionField.appendChild(resolution);
        fields.appendChild(resolutionField);

        const presetField = createField('Preset', 'span-3', 'Visualizer preset used while rendering this stage.');
        const preset = document.createElement('select');
        setSelectOptions(preset, getPresetChoices(), stage.presetId || 'current');
        preset.addEventListener('change', () => updateStage(stage.id, { presetId: preset.value }));
        presetField.appendChild(preset);
        fields.appendChild(presetField);
      }

      const immediateLabel = document.createElement('label');
      immediateLabel.className = 'pipeline-field pipeline-inline-check span-3';
      immediateLabel.dataset.tooltip = 'Publish immediately instead of sending a scheduled publish date to YouTube.';
      immediateLabel.title = immediateLabel.dataset.tooltip;
      const immediate = document.createElement('input');
      immediate.type = 'checkbox';
      immediate.checked = Boolean(stage.publishImmediately);
      immediate.setAttribute('aria-label', 'Publish this pipeline stage immediately');
      immediate.addEventListener('change', () => updateStage(stage.id, { publishImmediately: immediate.checked }, true));
      const immediateText = document.createElement('span');
      immediateText.className = 'pipeline-check-text';
      immediateText.textContent = 'Immediately';
      immediateLabel.appendChild(immediate);
      immediateLabel.appendChild(immediateText);
      fields.appendChild(immediateLabel);

      const privacyField = createField('Privacy', 'span-3', 'YouTube privacy setting. Scheduled uploads are sent as private until YouTube publishes them.');
      const privacy = document.createElement('select');
      setSelectOptions(privacy, [
        ['private', 'Private'],
        ['unlisted', 'Unlisted'],
        ['public', 'Public'],
      ], stage.privacyStatus || 'private');
      privacy.addEventListener('change', () => updateStage(stage.id, { privacyStatus: privacy.value }));
      privacyField.appendChild(privacy);
      fields.appendChild(privacyField);

      if (stage.kind === 'release') {
        fields.appendChild(renderAlbumEditor(stage));
      }

      fields.appendChild(renderYouTubeDetails(stage));

      const actions = document.createElement('div');
      actions.className = 'pipeline-stage-actions';

      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.className = 'btn-info';
      uploadBtn.textContent = 'YouTube';
      uploadBtn.dataset.tooltip = 'Open the stage-specific YouTube upload form.';
      uploadBtn.title = uploadBtn.dataset.tooltip;
      uploadBtn.addEventListener('click', () => requestStageUpload(stage));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-danger pipeline-stage-delete';
      deleteBtn.setAttribute('aria-label', `Delete ${stage.name || `stage ${index + 1}`}`);
      deleteBtn.dataset.tooltip = 'Delete this pipeline stage after confirmation.';
      deleteBtn.title = deleteBtn.dataset.tooltip;
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => showDeleteModal(stage.id));

      actions.appendChild(uploadBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(fileCell);
      item.appendChild(number);
      item.appendChild(fields);
      item.appendChild(actions);
      stagesContainer.appendChild(item);
    });
    renderStageNav();

    updateRunState();
    refreshStageObserver();
  }

  function getNextPipelineName() {
    let index = savedPipelines.length + 1;
    const names = new Set(savedPipelines.map(pipeline => pipeline.name));
    while (names.has(`Pipeline ${index}`)) {
      index++;
    }
    return `Pipeline ${index}`;
  }

  function saveCurrentPipeline() {
    const pipeline = {
      id: createId('pipeline'),
      name: getNextPipelineName(),
      createdAt: new Date().toISOString(),
      timezone: pipelineTimezone,
      uploadOrder: pipelineUploadOrder,
      stages: stages.map(sanitizeStage),
    };
    savedPipelines = [...savedPipelines, pipeline];
    activePipelineId = pipeline.id;
    localStorage.setItem(ACTIVE_PIPELINE_KEY, activePipelineId);
    saveSavedPipelines();
    renderPipelineList();
  }

  function loadPipeline(pipelineId) {
    const pipeline = savedPipelines.find(item => item.id === pipelineId);
    if (!pipeline) return;
    selectedFilesByStageId.clear();
    selectedCoversByStageId.clear();
    stages = Array.isArray(pipeline.stages) ? pipeline.stages.map(normalizeStage) : [];
    pipelineTimezone = pipeline.timezone || pipelineTimezone;
    pipelineUploadOrder = pipeline.uploadOrder === 'manual' ? 'manual' : 'chronological';
    activePipelineId = pipeline.id;
    localStorage.setItem(ACTIVE_PIPELINE_KEY, activePipelineId);
    if (pipelineTimezone) {
      localStorage.setItem(PIPELINE_TIMEZONE_KEY, pipelineTimezone);
    }
    localStorage.setItem(PIPELINE_UPLOAD_ORDER_KEY, pipelineUploadOrder);
    saveStages();
    updateTimezoneButton();
    renderStages();
    renderPipelineList();
  }

  function renderPipelineList() {
    pipelineList.innerHTML = '';
    savedPipelines.forEach((pipeline, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-icon-btn pipeline-load-btn';
      if (pipeline.id === activePipelineId) {
        button.classList.add('is-active');
        button.setAttribute('aria-current', 'true');
      }
      button.textContent = pipeline.name || String(index + 1);
      button.setAttribute('aria-label', `Load pipeline ${pipeline.name || index + 1}`);
      button.addEventListener('click', () => loadPipeline(pipeline.id));
      pipelineList.appendChild(button);
    });
  }

  function syncPipelineSidebar() {
    const isPipelineActive = pipelineTab.classList.contains('active');
    pipelineSidebar.classList.toggle('is-open', isPipelineActive);
    if (stageNav) {
      stageNav.classList.toggle('is-open', isPipelineActive && stages.length > 0);
    }
    document.body.classList.toggle('pipeline-mode-active', isPipelineActive);
    if (isPipelineActive) {
      refreshStageObserver();
    }
  }

  function openResetModal() {
    setResetOptionsInModal();
    resetModal.style.display = 'flex';
  }

  function closeResetModal() {
    resetModal.style.display = 'none';
    cancelResetHold();
  }

  function resetSelectedFields() {
    const options = getResetOptionsFromModal();
    saveResetOptions(options);
    const defaults = createDefaultStages();

    stages = stages.map((stage, index) => {
      const template = defaults[index] || createDefaultStage(stage.kind || 'custom', index);
      const changes = {};
      if (options.names) changes.name = template.name;
      if (options.files) {
        selectedFilesByStageId.delete(stage.id);
        selectedCoversByStageId.delete(stage.id);
        changes.fileNames = [];
      }
      if (options.descriptions) {
        changes.description = template.description;
        changes.tags = template.tags;
        changes.playlistIds = template.playlistIds;
      }
      if (options.dates) {
        changes.publishAtLocal = template.publishAtLocal;
        changes.publishImmediately = template.publishImmediately;
        changes.scheduleMode = template.scheduleMode;
        changes.relativeReference = template.relativeReference;
        changes.relativeOffsetDirection = template.relativeOffsetDirection;
        changes.relativeOffsetMonths = template.relativeOffsetMonths;
        changes.relativeOffsetDays = template.relativeOffsetDays;
        changes.relativeOffsetHours = template.relativeOffsetHours;
        changes.relativeOffsetUnitMinutes = template.relativeOffsetUnitMinutes;
        changes.relativeOffsetMinutes = template.relativeOffsetMinutes;
      }
      if (options.presets) {
        changes.resolution = template.resolution;
        changes.presetId = template.presetId;
      }
      if (options.actions) {
        changes.action = template.action;
      }
      if (options.privacy) {
        changes.privacyStatus = template.privacyStatus;
      }
      if (options.youtubeFlags) {
        changes.short = template.short;
        changes.madeForKids = template.madeForKids;
        changes.syntheticMedia = template.syntheticMedia;
        changes.notifySubscribers = template.notifySubscribers;
      }
      if (options.album && stage.kind === 'release') {
        changes.releaseType = template.releaseType;
        changes.tracks = template.tracks;
        changes.sharedImageName = template.sharedImageName;
      }
      return normalizeStage({ ...stage, ...changes }, index);
    });

    hasPipelineRun = false;
    saveStages();
    closeResetModal();
    renderStages();
  }

  function beginResetHold(event) {
    event.preventDefault();
    cancelResetHold();
    resetHoldCompleted = false;
    confirmResetHoldBtn.classList.add('is-holding');
    resetHoldTimer = window.setTimeout(() => {
      resetHoldCompleted = true;
      confirmResetHoldBtn.classList.remove('is-holding');
      resetSelectedFields();
    }, HOLD_TO_RESET_MS);
  }

  function cancelResetHold() {
    if (resetHoldTimer) {
      window.clearTimeout(resetHoldTimer);
      resetHoldTimer = 0;
    }
    if (!resetHoldCompleted) {
      confirmResetHoldBtn.classList.remove('is-holding');
    }
  }

  function openTimezoneModal() {
    const currentTimezone = pipelineTimezone || getBrowserTimezone();
    if (!Array.from(timezoneSelect.options).some(option => option.value === currentTimezone)) {
      const option = document.createElement('option');
      option.value = currentTimezone;
      option.textContent = currentTimezone;
      timezoneSelect.insertBefore(option, timezoneSelect.firstChild);
    }
    timezoneSelect.value = currentTimezone;
    uploadOrderSelect.value = pipelineUploadOrder;
    timezoneModal.style.display = 'flex';
  }

  function openTimezoneModalIfNeeded() {
    if (!pipelineTimezone) {
      openTimezoneModal();
    }
  }

  function closeTimezoneModal() {
    timezoneModal.style.display = 'none';
  }

  function saveTimezone() {
    pipelineTimezone = timezoneSelect.value || getBrowserTimezone();
    pipelineUploadOrder = uploadOrderSelect.value === 'manual' ? 'manual' : 'chronological';
    localStorage.setItem(PIPELINE_TIMEZONE_KEY, pipelineTimezone);
    localStorage.setItem(PIPELINE_UPLOAD_ORDER_KEY, pipelineUploadOrder);
    updateTimezoneButton();
    closeTimezoneModal();
    updateRunState();
  }

  addStageBtn.addEventListener('click', () => {
    stages.push(createDefaultStage('custom', stages.length));
    saveStages();
    renderStages();
  });

  clearPipelineBtn.addEventListener('click', () => {
    selectedFilesByStageId.clear();
    selectedCoversByStageId.clear();
    stages = [];
    hasPipelineRun = false;
    saveStages();
    renderStages();
  });

  runPipelineBtn.addEventListener('click', () => {
    if (runPipelineBtn.disabled) return;
    runPipeline();
  });

  resetPipelineFieldsBtn.addEventListener('click', openResetModal);
  cancelResetBtn.addEventListener('click', closeResetModal);
  cancelResetXBtn.addEventListener('click', closeResetModal);
  confirmResetHoldBtn.addEventListener('pointerdown', beginResetHold);
  confirmResetHoldBtn.addEventListener('pointerup', cancelResetHold);
  confirmResetHoldBtn.addEventListener('pointerleave', cancelResetHold);
  confirmResetHoldBtn.addEventListener('pointercancel', cancelResetHold);
  Object.values(resetCheckboxes).forEach(checkbox => {
    checkbox.addEventListener('change', () => saveResetOptions());
  });

  pipelineTimezoneBtn.addEventListener('click', openTimezoneModal);
  pipelineSettingsBtn.addEventListener('click', openTimezoneModal);
  cancelTimezoneBtn.addEventListener('click', closeTimezoneModal);
  cancelTimezoneXBtn.addEventListener('click', closeTimezoneModal);
  confirmTimezoneBtn.addEventListener('click', saveTimezone);
  closeReportBtn.addEventListener('click', hidePipelineReport);
  closeReportXBtn.addEventListener('click', hidePipelineReport);

  savePipelineBtn.addEventListener('click', saveCurrentPipeline);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => window.setTimeout(syncPipelineSidebar, 0));
  });

  cancelDeleteBtn.addEventListener('click', hideDeleteModal);
  cancelDeleteXBtn.addEventListener('click', hideDeleteModal);
  confirmDeleteBtn.addEventListener('click', deletePendingStage);
  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) {
      hideDeleteModal();
    }
  });
  resetModal.addEventListener('click', (event) => {
    if (event.target === resetModal) {
      closeResetModal();
    }
  });
  timezoneModal.addEventListener('click', (event) => {
    if (event.target === timezoneModal) {
      closeTimezoneModal();
    }
  });
  reportModal.addEventListener('click', (event) => {
    if (event.target === reportModal) {
      hidePipelineReport();
    }
  });
  window.addEventListener('audioRecorderPresetsChanged', () => {
    stages = stages.map(normalizeStage);
    saveStages();
    renderStages();
  });
  window.addEventListener('audioRecorderYouTubePlaylistsChanged', () => {
    renderStages();
  });

  window.AudioRecorderPipeline = {
    addStage(stage = createDefaultStage('custom', stages.length)) {
      stages.push(normalizeStage(stage, stages.length));
      saveStages();
      renderStages();
    },
    replaceStages(nextStages) {
      selectedFilesByStageId.clear();
      selectedCoversByStageId.clear();
      stages = Array.isArray(nextStages) ? nextStages.map(normalizeStage) : [];
      saveStages();
      renderStages();
    },
    getStages() {
      return stages.map(sanitizeStage);
    },
    runPipeline,
    saveCurrentPipeline,
  };

  updateTimezoneButton();
  renderPipelineList();
  renderStages();
  syncPipelineSidebar();
})();
