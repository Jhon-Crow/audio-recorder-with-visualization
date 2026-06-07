/**
 * Audio Recorder with Visualization - YouTube upload workflow
 */

(function() {
  'use strict';

  const library = window.AudioRecorderVisualization || {};
  const {
    YouTubeUploader,
    YOUTUBE_PLAYLIST_SCOPE,
    YOUTUBE_UPLOAD_AND_PLAYLIST_SCOPE,
    YOUTUBE_UPLOAD_SCOPE,
  } = library;

  if (!YouTubeUploader) {
    console.warn('YouTubeUploader is not available. Run npm run build before using YouTube upload.');
    return;
  }

  const CLIENT_ID_KEY = 'audio-recorder-youtube-client-id';
  const UPLOAD_FORM_STATE_KEY = 'audio-recorder-youtube-upload-form-state';
  const TOKEN_STATE_KEY = 'audio-recorder-youtube-token-state';
  const TOKEN_EXPIRY_SKEW_MS = 60000;
  const LOCALHOST_EXAMPLE_ORIGIN = 'http://localhost:8080';
  const UNSUPPORTED_ORIGIN_MESSAGE = 'Google sign-in requires a localhost or HTTPS URL. Open the app with npm run serve or Electron, then use the localhost page.';
  const GOOGLE_CLIENT_ID_PATTERN = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

  const authModal = document.getElementById('youtubeAuthModal');
  const closeAuthBtn = document.getElementById('closeYouTubeAuthBtn');
  const cancelAuthBtn = document.getElementById('cancelYouTubeAuthBtn');
  const openGoogleCloudOAuthBtn = document.getElementById('openGoogleCloudOAuthBtn');
  const authorizeBtn = document.getElementById('authorizeYouTubeBtn');
  const clientIdInput = document.getElementById('youtubeClientId');
  const clientSecretField = document.getElementById('youtubeClientSecretField');
  const clientSecretInput = document.getElementById('youtubeClientSecret');
  const authSettingsStatus = document.getElementById('youtubeAuthSettingsStatus');
  const signOutBtn = document.getElementById('youtubeSignOutBtn');
  const signInSettingsBtn = document.getElementById('youtubeSignInSettingsBtn');
  const authStatus = document.getElementById('youtubeAuthStatus');

  const uploadModal = document.getElementById('youtubeUploadModal');
  const closeUploadBtn = document.getElementById('closeYouTubeUploadBtn');
  const uploadForm = document.getElementById('youtubeUploadForm');
  const titleInput = document.getElementById('youtubeTitle');
  const descriptionInput = document.getElementById('youtubeDescription');
  const tagsInput = document.getElementById('youtubeTags');
  const playlistIdsInput = document.getElementById('youtubePlaylistIds');
  const thumbnailInput = document.getElementById('youtubeThumbnail');
  const categorySelect = document.getElementById('youtubeCategory');
  const privacySelect = document.getElementById('youtubePrivacy');
  const publishAtInput = document.getElementById('youtubePublishAt');
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
    authModal, closeAuthBtn, cancelAuthBtn, openGoogleCloudOAuthBtn, authorizeBtn,
    clientIdInput, clientSecretField, clientSecretInput, authSettingsStatus, signOutBtn, signInSettingsBtn, authStatus,
    uploadModal, closeUploadBtn, uploadForm, titleInput, descriptionInput, tagsInput, playlistIdsInput, thumbnailInput,
    categorySelect, privacySelect, publishAtInput, shortCheckbox, madeForKidsCheckbox, syntheticMediaCheckbox,
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
  let tokenScope = '';
  let googleIdentityPromise = null;
  let activeUploadController = null;

  clientIdInput.value = localStorage.getItem(CLIENT_ID_KEY) || '';
  restoreStoredTokenState();

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

  function isElectronYouTubeOAuthAvailable() {
    return Boolean(
      window.electronAPI &&
      window.electronAPI.isElectron &&
      typeof window.electronAPI.authorizeYouTube === 'function'
    );
  }

  function updateAuthModeFields() {
    if (isElectronYouTubeOAuthAvailable()) {
      clientSecretField.style.display = '';
      openGoogleCloudOAuthBtn.textContent = 'OAuth Setup';
      return;
    }

    clientSecretField.style.display = 'none';
    clientSecretInput.value = '';
    openGoogleCloudOAuthBtn.textContent = 'OAuth Setup';
  }

  function hasValidAccessToken() {
    return Boolean(accessToken) && Date.now() < accessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS;
  }

  function getRequiredYouTubeScope() {
    return YOUTUBE_UPLOAD_AND_PLAYLIST_SCOPE || YOUTUBE_UPLOAD_SCOPE;
  }

  function hasGrantedScope(scope) {
    if (!scope) {
      return true;
    }

    const granted = new Set(String(tokenScope || '').split(/\s+/).filter(Boolean));
    return String(scope).split(/\s+/).filter(Boolean).every(item => granted.has(item));
  }

  function hasPlaylistScope() {
    return hasGrantedScope(YOUTUBE_PLAYLIST_SCOPE);
  }

  function saveTokenState() {
    try {
      if (accessToken && accessTokenExpiresAt) {
        localStorage.setItem(TOKEN_STATE_KEY, JSON.stringify({ accessToken, accessTokenExpiresAt, tokenScope }));
      } else {
        localStorage.removeItem(TOKEN_STATE_KEY);
      }
    } catch (error) {
      console.warn('Failed to save YouTube token state:', error);
    }
    updateAuthSettingsStatus();
  }

  function restoreStoredTokenState() {
    try {
      const saved = localStorage.getItem(TOKEN_STATE_KEY);
      if (!saved) {
        return;
      }
      const state = JSON.parse(saved);
      if (state && typeof state.accessToken === 'string' && Number.isFinite(Number(state.accessTokenExpiresAt))) {
        accessToken = state.accessToken;
        accessTokenExpiresAt = Number(state.accessTokenExpiresAt);
        tokenScope = typeof state.tokenScope === 'string'
          ? state.tokenScope
          : typeof state.scope === 'string'
            ? state.scope
            : '';
      }
    } catch (error) {
      console.warn('Failed to load YouTube token state:', error);
    }
  }

  function clearYouTubeAuth() {
    accessToken = '';
    accessTokenExpiresAt = 0;
    tokenScope = '';
    saveTokenState();

    if (isElectronYouTubeOAuthAvailable() && typeof window.electronAPI.clearYouTubeAuthorization === 'function') {
      window.electronAPI.clearYouTubeAuthorization().catch((error) => {
        console.warn('Failed to clear Electron YouTube authorization:', error);
      });
    }
  }

  function updateAuthSettingsStatus() {
    const signedIn = hasValidAccessToken();
    authSettingsStatus.textContent = signedIn ? 'Signed in' : 'Not signed in';
    signOutBtn.style.display = signedIn ? '' : 'none';
    signInSettingsBtn.style.display = signedIn ? 'none' : '';
  }

  function isSupportedGoogleSignInOrigin() {
    const origin = window.__audioRecorderYouTubeOrigin || window.location;
    return origin.protocol === 'https:' ||
      origin.hostname === 'localhost' ||
      origin.hostname === '127.0.0.1';
  }

  function getCurrentOriginText() {
    const origin = window.__audioRecorderYouTubeOrigin || window.location;
    if (origin.origin && origin.origin !== 'null') {
      return origin.origin;
    }
    return `${origin.protocol}//${origin.host || origin.hostname || ''}`;
  }

  function getOAuthClientSetupMessage(clientId) {
    const origin = getCurrentOriginText();
    const details = isElectronYouTubeOAuthAvailable()
      ? 'Create a Desktop app OAuth Client ID in Google Cloud Console, enable YouTube Data API v3 for the same project, paste the Desktop Client ID here, and paste the Desktop Client Secret too if Google generated one. Browser mode uses a Web application client instead.'
      : `Create a Web application OAuth Client ID in Google Cloud Console, enable YouTube Data API v3, and add exactly ${origin} to Authorized JavaScript origins, without a path or trailing slash. Electron uses a Desktop app OAuth Client ID and system-browser loopback sign-in.`;

    if (!GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
      return `This does not look like a Google OAuth Client ID. Use a value ending in .apps.googleusercontent.com. ${details}`;
    }

    return details;
  }

  async function copyOriginToClipboard() {
    const origin = getCurrentOriginText();
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return false;
    }

    try {
      await navigator.clipboard.writeText(origin);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function openGoogleCloudOAuthSetup() {
    const origin = getCurrentOriginText();
    const isElectronOAuth = isElectronYouTubeOAuthAvailable();
    const copied = isElectronOAuth ? false : await copyOriginToClipboard();
    const copyStatus = copied ? ` Copied ${origin} to clipboard.` : ` Add exactly ${origin}.`;
    const setupMessage = isElectronOAuth
      ? 'Opening Google Cloud OAuth clients. Create or edit a Desktop app OAuth Client ID and enable YouTube Data API v3 for the same project. Paste the Desktop Client ID here, and paste the Desktop Client Secret too if Google generated one.'
      : `Opening Google Cloud OAuth clients. Create or edit a Web application OAuth Client ID, enable YouTube Data API v3, and add the Authorized JavaScript origin without a path or trailing slash.${copyStatus}`;

    setStatus(
      authStatus,
      setupMessage,
      ''
    );

    window.open('https://console.cloud.google.com/apis/credentials/oauthclient', '_blank', 'noopener');
  }

  function getLocalhostExampleUrl() {
    const origin = window.__audioRecorderYouTubeOrigin || window.location;
    if (origin.protocol !== 'file:') {
      return '';
    }

    return `${LOCALHOST_EXAMPLE_ORIGIN}/index.html`;
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

  function getUploadFormStateKey() {
    if (pendingUpload && pendingUpload.uploadFormStateKey) {
      return `${UPLOAD_FORM_STATE_KEY}:${pendingUpload.uploadFormStateKey}`;
    }
    return UPLOAD_FORM_STATE_KEY;
  }

  function getDefaultUploadFormState() {
    return {
      description: '',
      tags: 'audio, visualizer',
      playlistIds: '',
      categoryId: '10',
      privacyStatus: 'private',
      short: shouldDefaultToShort(),
      madeForKids: false,
      syntheticMedia: false,
      notifySubscribers: false,
    };
  }

  function loadUploadFormState() {
    const defaults = getDefaultUploadFormState();
    const savedState = localStorage.getItem(getUploadFormStateKey());

    if (!savedState) {
      return defaults;
    }

    try {
      return {
        ...defaults,
        ...JSON.parse(savedState),
      };
    } catch (error) {
      return defaults;
    }
  }

  function saveUploadFormState() {
    const state = {
      description: descriptionInput.value,
      tags: tagsInput.value,
      playlistIds: playlistIdsInput.value,
      categoryId: categorySelect.value,
      privacyStatus: privacySelect.value,
      short: shortCheckbox.checked,
      madeForKids: madeForKidsCheckbox.checked,
      syntheticMedia: syntheticMediaCheckbox.checked,
      notifySubscribers: notifySubscribersCheckbox.checked,
    };

    localStorage.setItem(getUploadFormStateKey(), JSON.stringify(state));
  }

  function resetProgress() {
    progressBar.style.display = 'none';
    progressBar.setAttribute('aria-valuenow', '0');
    progressFill.style.width = '0%';
  }

  function setMinimumPublishAt() {
    const minimumDate = new Date(Date.now() + 15 * 60 * 1000);
    publishAtInput.min = toDateTimeLocalValue(minimumDate);
  }

  function toDateTimeLocalValue(date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function getScheduledPublishAt() {
    if (!publishAtInput.value) {
      return undefined;
    }

    return new Date(publishAtInput.value).toISOString();
  }

  function updateScheduleState() {
    const hasSchedule = Boolean(publishAtInput.value);
    privacySelect.disabled = hasSchedule;
    if (hasSchedule) {
      privacySelect.value = 'private';
    }
  }

  function updateProgress(progress) {
    const percentage = Math.round(progress.percent * 100);
    progressBar.style.display = 'block';
    progressBar.setAttribute('aria-valuenow', String(percentage));
    progressFill.style.width = `${percentage}%`;
    setStatus(uploadStatus, `Uploading... ${percentage}%`);
  }

  function openAuthModal() {
    updateAuthModeFields();
    updateAuthSettingsStatus();
    authorizeBtn.textContent = 'Sign in with Google';
    showModal(authModal);
    clientIdInput.focus();

    if (isElectronYouTubeOAuthAvailable()) {
      setStatus(authStatus, 'Electron sign-in opens Google in your default browser. Use a Desktop app OAuth Client ID.');
      authorizeBtn.disabled = false;
      return;
    }

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

    const savedState = loadUploadFormState();

    titleInput.value = getDefaultTitle(pendingUpload.fileName);
    descriptionInput.value = savedState.description;
    tagsInput.value = savedState.tags;
    playlistIdsInput.value = savedState.playlistIds || '';
    thumbnailInput.value = '';
    categorySelect.value = savedState.categoryId;
    privacySelect.value = savedState.privacyStatus;
    privacySelect.disabled = false;
    publishAtInput.value = '';
    setMinimumPublishAt();
    shortCheckbox.checked = savedState.short;
    madeForKidsCheckbox.checked = savedState.madeForKids;
    syntheticMediaCheckbox.checked = savedState.syntheticMedia;
    notifySubscribersCheckbox.checked = savedState.notifySubscribers;
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
    if (isElectronYouTubeOAuthAvailable()) {
      const result = await window.electronAPI.authorizeYouTube(clientId, clientSecretInput.value.trim());

      if (!result || result.success === false) {
        throw new Error(result && result.error ? result.error : 'Google authorization failed.');
      }

      if (!result.accessToken) {
        throw new Error('Google authorization did not return an access token.');
      }

      accessToken = result.accessToken;
      accessTokenExpiresAt = Date.now() + Number(result.expiresIn || 3600) * 1000;
      tokenScope = result.scope || getRequiredYouTubeScope();
      saveTokenState();
      return accessToken;
    }

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
        scope: getRequiredYouTubeScope(),
        callback: (response) => {
          if (!response || response.error) {
            const errorCode = response && response.error ? response.error : '';
            const errorDescription = response && response.error_description ? response.error_description : '';

            if (errorCode === 'invalid_client' || /invalid_client/i.test(errorDescription)) {
              reject(new Error(`Google rejected this OAuth Client ID. ${getOAuthClientSetupMessage(clientId)}`));
              return;
            }

            reject(new Error(errorDescription || 'Google authorization failed'));
            return;
          }

          accessToken = response.access_token;
          accessTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
          tokenScope = response.scope || getRequiredYouTubeScope();
          saveTokenState();
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

    if (!GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
      setStatus(authStatus, getOAuthClientSetupMessage(clientId), 'error');
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
      playlistIds: playlistIdsInput.value,
      categoryId: categorySelect.value,
      privacyStatus: privacySelect.value,
      publishAt: getScheduledPublishAt(),
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

    if (playlistIdsInput.value.trim() && !hasPlaylistScope()) {
      clearYouTubeAuth();
      hideModal(uploadModal);
      openAuthModal();
      setStatus(authStatus, 'Sign in again to grant YouTube playlist access.');
      return;
    }

    saveUploadFormState();
    activeUploadController = new AbortController();
    submitUploadBtn.disabled = true;
    submitUploadBtn.textContent = 'Uploading...';
    cancelUploadBtn.textContent = 'Cancel Upload';
    updateAppStatus('Uploading to YouTube...', 'recording');

    try {
      const result = await uploader.upload({
        video: pendingUpload.blob,
        thumbnail: thumbnailInput.files && thumbnailInput.files[0] ? thumbnailInput.files[0] : undefined,
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
          clearYouTubeAuth();
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

  async function uploadDirect(options = {}) {
    if (!hasValidAccessToken()) {
      throw new Error('Sign in to YouTube before running upload pipeline stages.');
    }

    const video = options.video || options.blob;
    if (!video) {
      throw new Error('No video selected for YouTube upload.');
    }

    const metadata = options.metadata || {};
    if ((metadata.playlistId || metadata.playlistIds) && !hasPlaylistScope()) {
      clearYouTubeAuth();
      throw new Error('Sign in to YouTube again to grant playlist access before adding videos to playlists.');
    }

    try {
      return await uploader.upload({
        video,
        thumbnail: options.thumbnail,
        accessToken,
        metadata,
        notifySubscribers: options.notifySubscribers,
        signal: options.signal,
        onProgress: options.onProgress,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearYouTubeAuth();
      }
      throw error;
    }
  }

  window.AudioRecorderYouTube = {
    hasValidAccessToken,
    uploadDirect,
  };

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
  openGoogleCloudOAuthBtn.addEventListener('click', openGoogleCloudOAuthSetup);
  authorizeBtn.addEventListener('click', authorizeYouTube);
  signOutBtn.addEventListener('click', () => {
    clearYouTubeAuth();
    setStatus(authStatus, 'Signed out of Google.');
  });
  signInSettingsBtn.addEventListener('click', authorizeYouTube);

  closeUploadBtn.addEventListener('click', closeUploadModal);
  cancelUploadBtn.addEventListener('click', () => {
    if (activeUploadController) {
      activeUploadController.abort();
    } else {
      closeUploadModal();
    }
  });
  uploadForm.addEventListener('submit', submitUpload);
  publishAtInput.addEventListener('input', updateScheduleState);
  publishAtInput.addEventListener('change', updateScheduleState);
  updateAuthSettingsStatus();

  authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });
})();
