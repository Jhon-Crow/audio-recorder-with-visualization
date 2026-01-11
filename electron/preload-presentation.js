const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the presentation window
contextBridge.exposeInMainWorld('presentationAPI', {
  // Listen for settings updates
  onSettings: (callback) => {
    ipcRenderer.on('presentation-settings', (event, settings) => callback(settings));
    return () => ipcRenderer.removeListener('presentation-settings', callback);
  },

  // Listen for visualization frame data
  onFrame: (callback) => {
    ipcRenderer.on('presentation-frame', (event, frameData) => callback(frameData));
    return () => ipcRenderer.removeListener('presentation-frame', callback);
  },

  // Listen for visualizer options changes
  onVisualizerOptions: (callback) => {
    ipcRenderer.on('presentation-visualizer-options', (event, options) => callback(options));
    return () => ipcRenderer.removeListener('presentation-visualizer-options', callback);
  },

  // Listen for visualizer type changes
  onVisualizerType: (callback) => {
    ipcRenderer.on('presentation-visualizer-type', (event, type) => callback(type));
    return () => ipcRenderer.removeListener('presentation-visualizer-type', callback);
  },

  // Move window by delta (for dragging with Alt+MMB)
  moveWindow: (deltaX, deltaY) => {
    ipcRenderer.send('presentation-move-window', { deltaX, deltaY });
  },

  // Report current window position (call when drag ends to persist position)
  reportPosition: () => {
    ipcRenderer.send('presentation-report-position');
  },

  // Toggle click-through mode
  setClickThrough: (clickThrough) => {
    ipcRenderer.send('presentation-set-click-through', clickThrough);
  },

  isPresentationWindow: true,
});
