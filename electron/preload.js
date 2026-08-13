const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  saveVideoAndShow: async (blob, fileName) => {
    const saveSession = await ipcRenderer.invoke('save-video-start', fileName);
    if (!saveSession.success) {
      return saveSession;
    }

    try {
      const reader = blob.stream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await ipcRenderer.invoke('save-video-chunk', saveSession.saveId, value);
      }
      return await ipcRenderer.invoke('save-video-finish', saveSession.saveId);
    } catch (error) {
      await ipcRenderer.invoke('save-video-cancel', saveSession.saveId);
      throw error;
    }
  },
  saveAllVideosAndShow: async (recordings) => {
    const serializedRecordings = await Promise.all(recordings.map(async (recording) => {
      const arrayBuffer = await recording.blob.arrayBuffer();
      return {
        blob: new Uint8Array(arrayBuffer),
        fileName: recording.fileName
      };
    }));
    return ipcRenderer.invoke('save-all-videos-and-show', serializedRecordings);
  },
  authorizeYouTube: async (clientId, clientSecret) => {
    return ipcRenderer.invoke('youtube-authorize', { clientId, clientSecret });
  },
  clearYouTubeAuthorization: async () => {
    return ipcRenderer.invoke('youtube-clear-authorization');
  },
  choosePresetFolder: async () => {
    return ipcRenderer.invoke('preset-choose-folder');
  },
  savePresetFile: async (folderPath, preset) => {
    return ipcRenderer.invoke('preset-save-file', folderPath, preset);
  },
  loadPresetFiles: async (folderPath) => {
    return ipcRenderer.invoke('preset-load-files', folderPath);
  },
  updatePresetFile: async (filePath, preset) => {
    return ipcRenderer.invoke('preset-update-file', filePath, preset);
  },
  deletePresetFile: async (filePath) => {
    return ipcRenderer.invoke('preset-delete-file', filePath);
  },
  isElectron: true,

  // ==================== PRESENTATION MODE APIs ====================

  // Start presentation mode with given settings
  presentationStart: async (settings) => {
    return ipcRenderer.invoke('presentation-start', settings);
  },

  // Stop presentation mode
  presentationStop: async () => {
    return ipcRenderer.invoke('presentation-stop');
  },

  // Update presentation settings in real-time
  presentationUpdate: async (settings) => {
    return ipcRenderer.invoke('presentation-update', settings);
  },

  // Check presentation status
  presentationStatus: async () => {
    return ipcRenderer.invoke('presentation-status');
  },

  // Send visualization frame data to presentation window
  presentationSendFrame: (frameData) => {
    ipcRenderer.send('presentation-frame', frameData);
  },

  // Send visualizer options to presentation window
  presentationSendVisualizerOptions: (options) => {
    ipcRenderer.send('presentation-visualizer-options', options);
  },

  // Send visualizer type change to presentation window
  presentationSendVisualizerType: (type) => {
    ipcRenderer.send('presentation-visualizer-type', type);
  },

  // Listen for presentation closed event
  onPresentationClosed: (callback) => {
    ipcRenderer.on('presentation-closed', callback);
    return () => ipcRenderer.removeListener('presentation-closed', callback);
  },

  // Listen for presentation window position changes (for saving to settings)
  onPresentationPositionChanged: (callback) => {
    ipcRenderer.on('presentation-position-changed', (event, position) => callback(position));
    return () => ipcRenderer.removeListener('presentation-position-changed', callback);
  },
});
