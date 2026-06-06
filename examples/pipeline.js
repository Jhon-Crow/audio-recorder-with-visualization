/**
 * Audio Recorder with Visualization - Pipeline mode
 */

(function() {
  'use strict';

  const PIPELINE_STAGES_KEY = 'audio-recorder-pipeline-stages';
  const SAVED_PIPELINES_KEY = 'audio-recorder-pipelines';
  const ACTIVE_PIPELINE_KEY = 'audio-recorder-active-pipeline-id';
  const PIPELINE_TIMEZONE_KEY = 'audio-recorder-pipeline-timezone';
  const RESET_OPTIONS_KEY = 'audio-recorder-pipeline-reset-options';
  const HOLD_TO_RESET_MS = 600;

  const addStageBtn = document.getElementById('addPipelineStageBtn');
  const clearPipelineBtn = document.getElementById('clearPipelineBtn');
  const runPipelineBtn = document.getElementById('runPipelineBtn');
  const resetPipelineFieldsBtn = document.getElementById('resetPipelineFieldsBtn');
  const pipelineTimezoneBtn = document.getElementById('pipelineTimezoneBtn');
  const validationStatus = document.getElementById('pipelineValidationStatus');
  const stagesContainer = document.getElementById('pipelineStages');
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
  const cancelTimezoneBtn = document.getElementById('cancelPipelineTimezoneBtn');
  const cancelTimezoneXBtn = document.getElementById('cancelPipelineTimezoneXBtn');
  const confirmTimezoneBtn = document.getElementById('confirmPipelineTimezoneBtn');

  const requiredElements = [
    addStageBtn, clearPipelineBtn, runPipelineBtn, resetPipelineFieldsBtn, pipelineTimezoneBtn,
    validationStatus, stagesContainer, pipelineTab, pipelineSidebar, savePipelineBtn, pipelineList,
    pipelineSettingsBtn, deleteModal, deleteMessage, cancelDeleteBtn, cancelDeleteXBtn,
    confirmDeleteBtn, resetModal, cancelResetBtn, cancelResetXBtn, confirmResetHoldBtn,
    timezoneModal, timezoneSelect, cancelTimezoneBtn, cancelTimezoneXBtn, confirmTimezoneBtn,
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
  let stages = loadStages();
  let savedPipelines = loadSavedPipelines();
  let activePipelineId = localStorage.getItem(ACTIVE_PIPELINE_KEY) || '';
  let pipelineTimezone = localStorage.getItem(PIPELINE_TIMEZONE_KEY) || '';
  let pendingDeleteStageId = '';
  let hasPipelineRun = false;
  let resetHoldTimer = 0;
  let resetHoldCompleted = false;
  let draggedTrack = null;

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

  function createDefaultStage(kind = 'custom', index = stages.length) {
    const defaults = {
      presave: {
        name: 'Pre-save short',
        action: 'visualize-upload',
        resolution: '1080x1920',
        presetId: 'current',
        publishAtLocal: defaultPublishAt(0),
        tags: 'shorts, pre-save, audio',
      },
      release: {
        name: 'Release',
        action: 'visualize-upload',
        resolution: '1920x1080',
        presetId: 'current',
        publishAtLocal: defaultPublishAt(1),
        tags: 'release, audio, visualizer',
        releaseType: 'album',
        tracks: [createTrack('Track 01', 0), createTrack('Track 02', 1)],
      },
      postalbum: {
        name: 'Post-album short',
        action: 'visualize-upload',
        resolution: '1080x1920',
        presetId: 'current',
        publishAtLocal: defaultPublishAt(2),
        tags: 'shorts, album, audio',
      },
      custom: {
        name: `Stage ${index + 1}`,
        action: 'visualize-upload',
        resolution: '1920x1080',
        presetId: 'current',
        publishAtLocal: defaultPublishAt(index),
        tags: 'audio, visualizer',
      },
    };

    return normalizeStage({
      id: createId('stage'),
      kind,
      privacyStatus: 'private',
      publishImmediately: false,
      description: '',
      madeForKids: false,
      syntheticMedia: false,
      notifySubscribers: false,
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

  function normalizeStage(stage, index = 0) {
    const fallback = {
      id: createId('stage'),
      kind: 'custom',
      name: `Stage ${index + 1}`,
      action: 'visualize-upload',
      resolution: '1920x1080',
      presetId: 'current',
      publishAtLocal: defaultPublishAt(index),
      publishImmediately: false,
      privacyStatus: 'private',
      description: '',
      tags: 'audio, visualizer',
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
    stages = stages.map((stage, index) => (
      stage.id === stageId ? normalizeStage({ ...stage, ...changes }, index) : stage
    ));
    saveStages();
    if (shouldRender) {
      renderStages();
    } else {
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

  function validateStage(stage) {
    if (!hasStageFiles(stage)) {
      return 'Select files for every stage before running.';
    }
    if (!String(stage.name || '').trim()) {
      return 'Every stage needs a video name.';
    }
    if (actionIncludesVisualization(stage.action) && (!stage.resolution || !stage.presetId)) {
      return 'Visualization stages need a resolution and preset.';
    }
    if (!stage.publishImmediately && !stage.publishAtLocal) {
      return 'Scheduled stages need a publication date.';
    }
    if (stage.kind === 'release' && stage.releaseType === 'album' && !stage.tracks.length) {
      return 'Album release stages need at least one track.';
    }
    return '';
  }

  function updateRunState() {
    const firstError = stages.map(validateStage).find(Boolean) || '';
    runPipelineBtn.disabled = !stages.length || Boolean(firstError);
    validationStatus.textContent = firstError;
    resetPipelineFieldsBtn.style.display = hasPipelineRun ? 'inline-flex' : 'none';
    stagesContainer.querySelectorAll('.pipeline-stage').forEach(item => {
      const stage = stages.find(candidate => candidate.id === item.dataset.stageId);
      item.classList.toggle('is-invalid', Boolean(stage && validateStage(stage)));
    });
  }

  function getPresetChoices() {
    const choices = [
      ['current', 'Current settings'],
      ['short-pulse', 'Short pulse'],
      ['album-bars', 'Album bars'],
    ];
    try {
      const presets = JSON.parse(localStorage.getItem('audio-recorder-presets') || '[]');
      if (Array.isArray(presets)) {
        presets.forEach(preset => {
          if (preset && preset.id) {
            choices.push([`preset:${preset.id}`, preset.name || 'Saved preset']);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to read visualizer presets for pipeline:', error);
    }
    return choices;
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

  function createField(labelText, className = 'span-4') {
    const label = document.createElement('label');
    label.className = `pipeline-field ${className}`.trim();
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

  function renderFileCell(stage) {
    const cell = document.createElement('div');
    cell.className = 'pipeline-file-cell';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pipeline-file-btn${hasStageFiles(stage) ? ' has-files' : ''}`;
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
      updateStage(stage.id, { fileNames: files.map(file => file.name) }, true);
    });

    button.addEventListener('click', () => fileInput.click());

    const names = document.createElement('div');
    names.className = 'pipeline-file-names';
    names.textContent = selected.length
      ? `${selected.length} selected`
      : stage.fileNames.length ? `Last: ${stage.fileNames.join(', ')}` : '';

    cell.appendChild(button);
    cell.appendChild(fileInput);
    cell.appendChild(names);
    return cell;
  }

  function renderAlbumEditor(stage) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pipeline-album-editor';

    const typeField = createField('Release type', 'span-4');
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

    const imageField = createField('YouTube cover', 'span-4');
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/jpeg,image/png,image/webp';
    imageInput.addEventListener('change', () => {
      const image = imageInput.files && imageInput.files[0];
      updateStage(stage.id, { sharedImageName: image ? image.name : '' }, true);
    });
    imageField.appendChild(imageInput);
    wrapper.appendChild(imageField);

    const presetField = createField('Album preset', 'span-4');
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

        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.title;
        input.className = 'pipeline-track-title';
        input.setAttribute('aria-label', `Album track ${index + 1} title`);
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
      addTrack.addEventListener('click', () => {
        const tracksNext = [...stage.tracks, createTrack('', stage.tracks.length)];
        updateStage(stage.id, { tracks: tracksNext }, true);
      });

      tracks.appendChild(addTrack);
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

    const descriptionField = createField('Description', 'span-12');
    const description = document.createElement('textarea');
    description.rows = 2;
    description.value = stage.description || '';
    description.className = 'pipeline-stage-description';
    description.addEventListener('input', () => updateStage(stage.id, { description: description.value }));
    descriptionField.appendChild(description);
    grid.appendChild(descriptionField);

    const tagsField = createField('Tags', 'span-12');
    const tags = document.createElement('input');
    tags.type = 'text';
    tags.value = stage.tags || '';
    tags.className = 'pipeline-stage-tags';
    tags.addEventListener('input', () => updateStage(stage.id, { tags: tags.value }));
    tagsField.appendChild(tags);
    grid.appendChild(tagsField);

    [
      ['madeForKids', 'Made for kids'],
      ['syntheticMedia', 'Synthetic media'],
      ['notifySubscribers', 'Notify subscribers'],
    ].forEach(([key, labelText]) => {
      const label = document.createElement('label');
      label.className = 'pipeline-field pipeline-inline-check span-4';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(stage[key]);
      checkbox.addEventListener('change', () => updateStage(stage.id, { [key]: checkbox.checked }));
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(labelText));
      grid.appendChild(label);
    });

    details.appendChild(grid);
    return details;
  }

  function renderStages() {
    stagesContainer.innerHTML = '';

    if (!stages.length) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = 'No stages yet.';
      stagesContainer.appendChild(empty);
      updateRunState();
      return;
    }

    stages.forEach((stage, index) => {
      const item = document.createElement('div');
      item.className = `pipeline-stage${validateStage(stage) ? ' is-invalid' : ''}`;
      item.dataset.stageId = stage.id;

      const fileCell = renderFileCell(stage);

      const number = document.createElement('span');
      number.className = 'pipeline-stage-number';
      number.textContent = String(index + 1);

      const fields = document.createElement('div');
      fields.className = 'pipeline-stage-fields';

      const nameField = createField('Video name', 'span-4');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = stage.name || '';
      nameInput.className = 'pipeline-stage-name';
      nameInput.setAttribute('aria-label', `Stage ${index + 1} video name`);
      nameInput.addEventListener('input', () => {
        updateStage(stage.id, { name: nameInput.value });
      });
      nameField.appendChild(nameInput);

      const actionField = createField('Action', 'span-4');
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

      const publishField = createField('Publish date', 'span-4');
      const publishAt = document.createElement('input');
      publishAt.type = 'datetime-local';
      publishAt.value = stage.publishAtLocal || '';
      publishAt.className = 'pipeline-publish-at';
      publishAt.addEventListener('focus', openTimezoneModalIfNeeded);
      publishAt.addEventListener('input', () => updateStage(stage.id, { publishAtLocal: publishAt.value }));
      publishField.appendChild(publishAt);

      fields.appendChild(nameField);
      fields.appendChild(actionField);
      fields.appendChild(publishField);

      if (actionIncludesVisualization(stage.action)) {
        const resolutionField = createField('Resolution', 'span-3');
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

        const presetField = createField('Preset', 'span-3');
        const preset = document.createElement('select');
        setSelectOptions(preset, getPresetChoices(), stage.presetId || 'current');
        preset.addEventListener('change', () => updateStage(stage.id, { presetId: preset.value }));
        presetField.appendChild(preset);
        fields.appendChild(presetField);
      }

      const immediateLabel = document.createElement('label');
      immediateLabel.className = 'pipeline-field pipeline-inline-check span-3';
      const immediate = document.createElement('input');
      immediate.type = 'checkbox';
      immediate.checked = Boolean(stage.publishImmediately);
      immediate.addEventListener('change', () => updateStage(stage.id, { publishImmediately: immediate.checked }));
      immediateLabel.appendChild(immediate);
      immediateLabel.appendChild(document.createTextNode('Immediately'));
      fields.appendChild(immediateLabel);

      const privacyField = createField('Privacy', 'span-3');
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
      uploadBtn.addEventListener('click', () => requestStageUpload(stage));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-danger pipeline-stage-delete';
      deleteBtn.setAttribute('aria-label', `Delete ${stage.name || `stage ${index + 1}`}`);
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

    updateRunState();
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
    stages = Array.isArray(pipeline.stages) ? pipeline.stages.map(normalizeStage) : [];
    pipelineTimezone = pipeline.timezone || pipelineTimezone;
    activePipelineId = pipeline.id;
    localStorage.setItem(ACTIVE_PIPELINE_KEY, activePipelineId);
    if (pipelineTimezone) {
      localStorage.setItem(PIPELINE_TIMEZONE_KEY, pipelineTimezone);
    }
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
    document.body.classList.toggle('pipeline-mode-active', isPipelineActive);
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
        changes.fileNames = [];
      }
      if (options.descriptions) {
        changes.description = template.description;
        changes.tags = template.tags;
      }
      if (options.dates) {
        changes.publishAtLocal = template.publishAtLocal;
        changes.publishImmediately = template.publishImmediately;
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
    localStorage.setItem(PIPELINE_TIMEZONE_KEY, pipelineTimezone);
    updateTimezoneButton();
    closeTimezoneModal();
  }

  addStageBtn.addEventListener('click', () => {
    stages.push(createDefaultStage('custom', stages.length));
    saveStages();
    renderStages();
  });

  clearPipelineBtn.addEventListener('click', () => {
    selectedFilesByStageId.clear();
    stages = [];
    hasPipelineRun = false;
    saveStages();
    renderStages();
  });

  runPipelineBtn.addEventListener('click', () => {
    if (runPipelineBtn.disabled) return;
    hasPipelineRun = true;
    updateRunState();
    if (window.AudioRecorderApp && typeof window.AudioRecorderApp.updateStatus === 'function') {
      window.AudioRecorderApp.updateStatus('Pipeline ready for sequential execution', 'ready');
    }
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

  window.AudioRecorderPipeline = {
    addStage(stage = createDefaultStage('custom', stages.length)) {
      stages.push(normalizeStage(stage, stages.length));
      saveStages();
      renderStages();
    },
    replaceStages(nextStages) {
      selectedFilesByStageId.clear();
      stages = Array.isArray(nextStages) ? nextStages.map(normalizeStage) : [];
      saveStages();
      renderStages();
    },
    getStages() {
      return stages.map(sanitizeStage);
    },
    saveCurrentPipeline,
  };

  updateTimezoneButton();
  renderPipelineList();
  renderStages();
  syncPipelineSidebar();
})();
