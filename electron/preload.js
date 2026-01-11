const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  saveVideoAndShow: async (blob, fileName) => {
    // Convert Blob to ArrayBuffer for IPC transfer
    // Use Uint8Array directly instead of converting to Array to avoid
    // "Invalid array length" error with large files (200MB+)
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return ipcRenderer.invoke('save-video-and-show', uint8Array, fileName);
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
