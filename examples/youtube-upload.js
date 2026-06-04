/**
 * Audio Recorder with Visualization - YouTube upload workflow
 */

(function() {
  'use strict';

  const library = window.AudioRecorderVisualization || {};
  const {
    YouTubeUploader,
    YOUTUBE_UPLOAD_SCOPE,
  } = library;

  if (!YouTubeUploader) {
    console.warn('YouTubeUploader is not available. Run npm run build before using YouTube upload.');
    return;
  }

  const CLIENT_ID_KEY = 'audio-recorder-youtube-client-id';
  const TOKEN_EXPIRY_SKEW_MS = 60000;
  const UNSUPPORTED_ORIGIN_MESSAGE = 'Google sign-in requires a localhost or HTTPS URL. Open the app with npm run serve, then use the localhost page.';

  const authModal = document.getElementById('youtubeAuthModal');
  const closeAuthBtn = document.getElementById('closeYouTubeAuthBtn');
  const cancelAuthBtn = document.getElementById('cancelYouTubeAuthBtn');
  const authorizeBtn = document.getElementById('authorizeYouTubeBtn');
  const clientIdInput = document.getElementById('youtubeClientId');
  const authStatus = document.getElementById('youtubeAuthStatus');

  const uploadModal = document.getElementById('youtubeUploadModal');
  const closeUploadBtn = document.getElementById('closeYouTubeUploadBtn');
  const uploadForm = document.getElementById('youtubeUploadForm');
  const titleInput = document.getElementById('youtubeTitle');
  const descriptionInput = document.getElementById('youtubeDescription');
  const tagsInput = document.getElementById('youtubeTags');
  const categorySelect = document.getElementById('youtubeCategory');
  const privacySelect = document.getElementById('youtubePrivacy');
  const shortCheckbox = document.getElementById('youtubeShort');
  const madeForKidsCheckbox = document.getElementById('youtubeMadeForKids');
  const syntheticMediaCheckbox = document.getElementById('youtubeSyntheticMedia');
  const notifySubscribersCheckbox = document.getElementById('youtubeNotifySubscribers');
  const progressBar = document.getElementById('youtubeUploadProgress');
  const progressFill = document.getElementById('youtubeUploadProgressFill');
  const uploadStatus = document.getElementById('youtubeUploadStatus');
  const cancelUploadBtn = document.getElementById('cancelYouTubeUploadBtn');
  const submitUploadBtn = document.getElementById('submitYouTubeUploadBtn');

  const requiredElements = [
    authModal, closeAuthBtn, cancelAuthBtn, authorizeBtn, clientIdInput, authStatus,
    uploadModal, closeUploadBtn, uploadForm, titleInput, descriptionInput, tagsInput,
    categorySelect, privacySelect, shortCheckbox, madeForKidsCheckbox, syntheticMediaCheckbox,
    notifySubscribersCheckbox, progressBar, progressFill, uploadStatus, cancelUploadBtn,
    submitUploadBtn,
  ];

  if (requiredElements.some(element => !element)) {
    console.warn('YouTube upload UI is incomplete.');
    return;
  }

  const uploader = new YouTubeUploader();
  let pendingUpload = null;
  let accessToken = '';
  let accessTokenExpiresAt = 0;
  let googleIdentityPromise = null;
  let activeUploadController = null;

  clientIdInput.value = localStorage.getItem(CLIENT_ID_KEY) || '';

  function showModal(modal) {
    modal.style.display = 'flex';
  }

  function hideModal(modal) {
    modal.style.display = 'none';
  }

  function setStatus(element, message, type = '') {
    element.textContent = message;
    element.className = `youtube-modal-status${type ? ` ${type}` : ''}`;
  }

  function setUploadSuccess(result) {
    uploadStatus.textContent = 'Uploaded: ';
    uploadStatus.className = 'youtube-modal-status success';
    const link = document.createElement('a');
    link.href = result.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = result.id;
    uploadStatus.appendChild(link);
  }

  function updateAppStatus(message, type = 'ready') {
    const app = window.AudioRecorderApp;
    if (app && typeof app.updateStatus === 'function') {
      app.updateStatus(message, type);
    }
  }

  function hasValidAccessToken() {
    return Boolean(accessToken) && Date.now() < accessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS;
  }

  function isSupportedGoogleSignInOrigin() {
    const origin = window.__audioRecorderYouTubeOrigin || window.location;
    return origin.protocol === 'https:' ||
      origin.hostname === 'localhost' ||
      origin.hostname === '127.0.0.1';
  }

  function getLocalhostExampleUrl() {
    const origin = window.__audioRecorderYouTubeOrigin || window.location;
    if (origin.protocol !== 'file:') {
      return '';
    }

    return 'http://localhost:8080/index.html';
  }

  function getDefaultTitle(fileName) {
    return (fileName || 'recording')
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'recording';
  }

  function shouldDefaultToShort() {
    const app = window.AudioRecorderApp;
    if (!app || typeof app.getVideoDimensions !== 'function') {
      return false;
    }

    const dimensions = app.getVideoDimensions();
    return dimensions.height > dimensions.width;
  }

  function resetProgress() {
    progressBar.style.display = 'none';
    progressBar.setAttribute('aria-valuenow', '0');
    progressFill.style.width = '0%';
  }

  function updateProgress(progress) {
    const percentage = Math.round(progress.percent * 100);
    progressBar.style.display = 'block';
    progressBar.setAttribute('aria-valuenow', String(percentage));
    progressFill.style.width = `${percentage}%`;
    setStatus(uploadStatus, `Uploading... ${percentage}%`);
  }

  function openAuthModal() {
    authorizeBtn.textContent = 'Sign in with Google';
    showModal(authModal);
    clientIdInput.focus();

    if (!isSupportedGoogleSignInOrigin()) {
      const localUrl = getLocalhostExampleUrl();
      setStatus(authStatus, localUrl ? `${UNSUPPORTED_ORIGIN_MESSAGE} Opening ${localUrl}...` : UNSUPPORTED_ORIGIN_MESSAGE, 'error');
      authorizeBtn.disabled = false;
      authorizeBtn.textContent = 'Open localhost';
      return;
    }

    setStatus(authStatus, 'Loading Google sign-in...');
    authorizeBtn.disabled = true;

    loadGoogleIdentityServices()
      .then(() => {
        setStatus(authStatus, '');
        authorizeBtn.disabled = false;
      })
      .catch((error) => {
        setStatus(authStatus, error.message || 'Unable to load Google sign-in.', 'error');
        authorizeBtn.disabled = false;
      });
  }

  function closeAuthModal() {
    hideModal(authModal);
    setStatus(authStatus, '');
  }

  function openUploadModal() {
    if (!pendingUpload) {
      return;
    }

    titleInput.value = getDefaultTitle(pendingUpload.fileName);
    descriptionInput.value = '';
    tagsInput.value = 'audio, visualizer';
    categorySelect.value = '10';
    privacySelect.value = 'private';
    shortCheckbox.checked = shouldDefaultToShort();
    madeForKidsCheckbox.checked = false;
    syntheticMediaCheckbox.checked = false;
    notifySubscribersCheckbox.checked = false;
    submitUploadBtn.disabled = false;
    submitUploadBtn.textContent = 'Upload';
    cancelUploadBtn.textContent = 'Cancel';
    resetProgress();
    setStatus(uploadStatus, '');
    showModal(uploadModal);
    titleInput.focus();
  }

  function closeUploadModal() {
    if (activeUploadController) {
      activeUploadController.abort();
    }
    hideModal(uploadModal);
    resetProgress();
    setStatus(uploadStatus, '');
  }

  function loadGoogleIdentityServices() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }

    if (googleIdentityPromise) {
      return googleIdentityPromise;
    }

    googleIdentityPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentityServices = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load Google sign-in'));
      document.head.appendChild(script);
    });

    return googleIdentityPromise;
  }

  async function requestAccessToken(clientId) {
    if (!isSupportedGoogleSignInOrigin()) {
      throw new Error(UNSUPPORTED_ORIGIN_MESSAGE);
    }

    await loadGoogleIdentityServices();

    const oauth = window.google && window.google.accounts && window.google.accounts.oauth2;
    if (!oauth || typeof oauth.initTokenClient !== 'function') {
      throw new Error('Google sign-in is unavailable');
    }

    return new Promise((resolve, reject) => {
      const tokenClient = oauth.initTokenClient({
        client_id: clientId,
        scope: YOUTUBE_UPLOAD_SCOPE,
        callback: (response) => {
          if (!response || response.error) {
            reject(new Error(response && response.error_description ? response.error_description : 'Google authorization failed'));
            return;
          }

          accessToken = response.access_token;
          accessTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
          resolve(accessToken);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async function authorizeYouTube() {
    const localUrl = getLocalhostExampleUrl();
    if (localUrl && !isSupportedGoogleSignInOrigin()) {
      window.location.href = localUrl;
      return;
    }

    const clientId = clientIdInput.value.trim();
    if (!clientId) {
      setStatus(authStatus, 'OAuth Client ID is required.', 'error');
      return;
    }

    localStorage.setItem(CLIENT_ID_KEY, clientId);
    authorizeBtn.disabled = true;
    authorizeBtn.textContent = 'Signing in...';
    setStatus(authStatus, 'Waiting for Google sign-in...');

    try {
      await requestAccessToken(clientId);
      closeAuthModal();
      openUploadModal();
    } catch (error) {
      setStatus(authStatus, error.message || 'Google authorization failed.', 'error');
    } finally {
      authorizeBtn.disabled = false;
      authorizeBtn.textContent = 'Sign in with Google';
    }
  }

  function collectMetadata() {
    return {
      title: titleInput.value,
      description: descriptionInput.value,
      tags: tagsInput.value,
      categoryId: categorySelect.value,
      privacyStatus: privacySelect.value,
      selfDeclaredMadeForKids: madeForKidsCheckbox.checked,
      containsSyntheticMedia: syntheticMediaCheckbox.checked,
      short: shortCheckbox.checked,
    };
  }

  async function submitUpload(event) {
    event.preventDefault();

    if (!pendingUpload) {
      setStatus(uploadStatus, 'No recording selected.', 'error');
      return;
    }

    if (!hasValidAccessToken()) {
      hideModal(uploadModal);
      openAuthModal();
      return;
    }

    activeUploadController = new AbortController();
    submitUploadBtn.disabled = true;
    submitUploadBtn.textContent = 'Uploading...';
    cancelUploadBtn.textContent = 'Cancel Upload';
    updateAppStatus('Uploading to YouTube...', 'recording');

    try {
      const result = await uploader.upload({
        video: pendingUpload.blob,
        accessToken,
        metadata: collectMetadata(),
        notifySubscribers: notifySubscribersCheckbox.checked,
        signal: activeUploadController.signal,
        onProgress: updateProgress,
      });

      setUploadSuccess(result);
      updateAppStatus('YouTube upload complete', 'ready');
    } catch (error) {
      if (error.name === 'AbortError') {
        setStatus(uploadStatus, 'Upload cancelled.', 'error');
        updateAppStatus('YouTube upload cancelled', 'ready');
      } else {
        if (error.status === 401 || error.status === 403) {
          accessToken = '';
          accessTokenExpiresAt = 0;
        }
        setStatus(uploadStatus, error.message || 'YouTube upload failed.', 'error');
        updateAppStatus('YouTube upload failed', 'error');
      }
      submitUploadBtn.disabled = false;
      submitUploadBtn.textContent = 'Upload';
    } finally {
      activeUploadController = null;
      cancelUploadBtn.textContent = 'Cancel';
    }
  }

  window.addEventListener('audioRecorderYouTubeUploadRequested', (event) => {
    pendingUpload = event.detail;

    if (hasValidAccessToken()) {
      openUploadModal();
    } else {
      openAuthModal();
    }
  });

  closeAuthBtn.addEventListener('click', closeAuthModal);
  cancelAuthBtn.addEventListener('click', closeAuthModal);
  authorizeBtn.addEventListener('click', authorizeYouTube);

  closeUploadBtn.addEventListener('click', closeUploadModal);
  cancelUploadBtn.addEventListener('click', () => {
    if (activeUploadController) {
      activeUploadController.abort();
    } else {
      closeUploadModal();
    }
  });
  uploadForm.addEventListener('submit', submitUpload);

  [authModal, uploadModal].forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        if (modal === authModal) {
          closeAuthModal();
        } else {
          closeUploadModal();
        }
      }
    });
  });
})();
