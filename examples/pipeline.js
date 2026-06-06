/**
 * Audio Recorder with Visualization - Pipeline mode
 */

(function() {
  'use strict';

  const PIPELINE_STAGES_KEY = 'audio-recorder-pipeline-stages';

  const addStageBtn = document.getElementById('addPipelineStageBtn');
  const clearPipelineBtn = document.getElementById('clearPipelineBtn');
  const stagesContainer = document.getElementById('pipelineStages');
  const deleteModal = document.getElementById('pipelineDeleteModal');
  const deleteMessage = document.getElementById('pipelineDeleteMessage');
  const cancelDeleteBtn = document.getElementById('cancelPipelineDeleteBtn');
  const cancelDeleteXBtn = document.getElementById('cancelPipelineDeleteXBtn');
  const confirmDeleteBtn = document.getElementById('confirmPipelineDeleteBtn');

  const requiredElements = [
    addStageBtn, clearPipelineBtn, stagesContainer, deleteModal, deleteMessage,
    cancelDeleteBtn, cancelDeleteXBtn, confirmDeleteBtn,
  ];

  if (requiredElements.some(element => !element)) {
    console.warn('Pipeline UI is incomplete.');
    return;
  }

  let stages = loadStages();
  let pendingDeleteStageId = '';

  function createStage() {
    const number = stages.length + 1;
    return {
      id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Stage ${number}`,
      action: 'render-upload',
    };
  }

  function loadStages() {
    try {
      const saved = JSON.parse(localStorage.getItem(PIPELINE_STAGES_KEY) || '[]');
      if (Array.isArray(saved)) {
        return saved.filter(stage => stage && typeof stage.id === 'string');
      }
    } catch (error) {
      console.warn('Failed to load pipeline stages:', error);
    }
    return [];
  }

  function saveStages() {
    localStorage.setItem(PIPELINE_STAGES_KEY, JSON.stringify(stages));
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

  function updateStage(stageId, changes) {
    stages = stages.map(stage => stage.id === stageId ? { ...stage, ...changes } : stage);
    saveStages();
  }

  function deletePendingStage() {
    if (!pendingDeleteStageId) {
      return;
    }

    stages = stages.filter(stage => stage.id !== pendingDeleteStageId);
    saveStages();
    renderStages();
    hideDeleteModal();
  }

  function requestStageUpload(stage) {
    const fileName = `${(stage.name || 'pipeline-stage').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'pipeline-stage'}.webm`;
    window.dispatchEvent(new CustomEvent('audioRecorderYouTubeUploadRequested', {
      detail: {
        blob: new Blob(['pipeline-stage-preview'], { type: 'video/webm' }),
        fileName,
        recordingNumber: stage.name,
        uploadFormStateKey: `pipeline-stage-${stage.id}`,
      },
    }));
  }

  function renderStages() {
    stagesContainer.innerHTML = '';

    if (!stages.length) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = 'No stages yet.';
      stagesContainer.appendChild(empty);
      return;
    }

    stages.forEach((stage, index) => {
      const item = document.createElement('div');
      item.className = 'pipeline-stage';
      item.dataset.stageId = stage.id;

      const number = document.createElement('span');
      number.className = 'pipeline-stage-number';
      number.textContent = String(index + 1);

      const fields = document.createElement('div');
      fields.className = 'pipeline-stage-fields';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = stage.name || '';
      nameInput.setAttribute('aria-label', `Stage ${index + 1} name`);
      nameInput.addEventListener('input', () => {
        updateStage(stage.id, { name: nameInput.value });
      });

      const actionSelect = document.createElement('select');
      actionSelect.setAttribute('aria-label', `Stage ${index + 1} action`);
      [
        ['render-upload', 'Render and upload'],
        ['render-only', 'Render only'],
        ['upload-only', 'Upload only'],
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        actionSelect.appendChild(option);
      });
      actionSelect.value = stage.action || 'render-upload';
      actionSelect.addEventListener('change', () => {
        updateStage(stage.id, { action: actionSelect.value });
      });

      fields.appendChild(nameInput);
      fields.appendChild(actionSelect);

      const actions = document.createElement('div');
      actions.className = 'recording-actions';

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

      item.appendChild(number);
      item.appendChild(fields);
      item.appendChild(actions);
      stagesContainer.appendChild(item);
    });
  }

  addStageBtn.addEventListener('click', () => {
    stages.push(createStage());
    saveStages();
    renderStages();
  });

  clearPipelineBtn.addEventListener('click', () => {
    stages = [];
    saveStages();
    renderStages();
  });

  cancelDeleteBtn.addEventListener('click', hideDeleteModal);
  cancelDeleteXBtn.addEventListener('click', hideDeleteModal);
  confirmDeleteBtn.addEventListener('click', deletePendingStage);
  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) {
      hideDeleteModal();
    }
  });

  window.AudioRecorderPipeline = {
    addStage(stage = createStage()) {
      stages.push(stage);
      saveStages();
      renderStages();
    },
    getStages() {
      return stages.slice();
    },
  };

  renderStages();
})();
