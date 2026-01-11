const { app, BrowserWindow, ipcMain, shell, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window objects to prevent garbage collection
let mainWindow = null;
let presentationWindow = null;

// Presentation window settings
let presentationSettings = {
  enabled: false,
  windowMode: 'normal', // 'normal', 'alwaysOnBottom', 'alwaysOnTop'
  windowType: 'frameless', // 'frameless', 'fullscreen', 'custom'
  width: 800,
  height: 600,
  x: null, // null = auto-center, otherwise use saved position
  y: null,
  backgroundOpacity: 0, // 0 = fully transparent
  visualizationOpacity: 1, // 1 = fully opaque
  clickThrough: true,
};

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Audio Recorder with Visualization',
    backgroundColor: '#1a1a2e',
  });

  // Load the examples/index.html file
  mainWindow.loadFile(path.join(__dirname, '..', 'examples', 'index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close - also close presentation window
  mainWindow.on('closed', () => {
    if (presentationWindow && !presentationWindow.isDestroyed()) {
      presentationWindow.destroy();
    }
    presentationWindow = null;
    mainWindow = null;
  });
}

function createPresentationWindow(settings) {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.destroy();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Determine window size based on settings
  let windowWidth = settings.width || 800;
  let windowHeight = settings.height || 600;
  let isFullScreen = false;

  if (settings.windowType === 'fullscreen') {
    windowWidth = screenWidth;
    windowHeight = screenHeight;
    isFullScreen = true;
  }

  const windowOptions = {
    width: windowWidth,
    height: windowHeight,
    frame: false, // Always frameless for presentation
    transparent: true, // Enable transparent background
    backgroundColor: '#00000000', // Fully transparent background
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-presentation.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Presentation Mode',
    skipTaskbar: true, // Don't show in taskbar
    resizable: settings.windowType === 'custom',
    fullscreen: isFullScreen,
    // Click-through when enabled
    focusable: !settings.clickThrough,
  };

  // Set window position based on mode
  if (settings.windowMode === 'alwaysOnTop') {
    windowOptions.alwaysOnTop = true;
  } else if (settings.windowMode === 'alwaysOnBottom') {
    windowOptions.alwaysOnTop = false;
  }

  // Set window position if saved, otherwise will be centered after creation
  if (settings.x !== null && settings.x !== undefined &&
      settings.y !== null && settings.y !== undefined) {
    windowOptions.x = settings.x;
    windowOptions.y = settings.y;
  }

  presentationWindow = new BrowserWindow(windowOptions);

  // Center window only if no saved position
  if (!isFullScreen && (settings.x === null || settings.x === undefined ||
      settings.y === null || settings.y === undefined)) {
    presentationWindow.center();
  }

  // Enable click-through (mouse events pass through)
  if (settings.clickThrough) {
    presentationWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  // Set window level for always on bottom (Windows only workaround)
  if (settings.windowMode === 'alwaysOnBottom' && process.platform === 'win32') {
    // On Windows, use a workaround for "always on bottom"
    // The window will stay at the back
    presentationWindow.setAlwaysOnTop(false);
  }

  // Load the presentation page
  presentationWindow.loadFile(path.join(__dirname, '..', 'examples', 'presentation.html'));

  // Prevent closing with Alt+F4 by intercepting the close event
  presentationWindow.on('close', (event) => {
    // Only allow close from main window or Alt+Q
    if (!presentationWindow._allowClose) {
      event.preventDefault();
      return false;
    }
  });

  // Handle window destroyed
  presentationWindow.on('closed', () => {
    presentationWindow = null;
    // Notify main window that presentation is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presentation-closed');
    }
  });

  // Send initial settings after window loads
  presentationWindow.webContents.on('did-finish-load', () => {
    presentationWindow.webContents.send('presentation-settings', settings);
  });

  return presentationWindow;
}

// Close presentation window properly (called by Alt+Q or main window control)
function closePresentationWindow() {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow._allowClose = true;
    presentationWindow.close();
  }
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // Register global shortcut Alt+Q to close presentation window
  globalShortcut.register('Alt+Q', () => {
    if (presentationWindow && !presentationWindow.isDestroyed()) {
      closePresentationWindow();
    }
  });

  // On macOS, re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Unregister shortcuts when app is about to quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Quit when all windows are closed (except on macOS)
// Modified: only quit when main window is closed, not presentation window
app.on('window-all-closed', () => {
  // Only quit if main window is closed (presentation window closing shouldn't quit app)
  if (!mainWindow) {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

// Handle permission requests for media (microphone)
app.on('web-contents-created', (event, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow microphone access for audio recording
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });
});

// IPC handler for saving file and showing in folder
ipcMain.handle('save-video-and-show', async (event, blob, fileName) => {
  try {
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName,
      filters: [
        { name: 'Video Files', extensions: ['webm', 'mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // Write the blob to the selected file
    const buffer = Buffer.from(blob);
    fs.writeFileSync(result.filePath, buffer);

    // Show the file in folder
    shell.showItemInFolder(result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// ==================== PRESENTATION MODE IPC HANDLERS ====================

// Start/toggle presentation mode
ipcMain.handle('presentation-start', async (event, settings) => {
  try {
    presentationSettings = { ...presentationSettings, ...settings };
    createPresentationWindow(presentationSettings);
    return { success: true };
  } catch (error) {
    console.error('Error starting presentation mode:', error);
    return { success: false, error: error.message };
  }
});

// Stop presentation mode
ipcMain.handle('presentation-stop', async () => {
  try {
    closePresentationWindow();
    return { success: true };
  } catch (error) {
    console.error('Error stopping presentation mode:', error);
    return { success: false, error: error.message };
  }
});

// Update presentation window settings in real-time
ipcMain.handle('presentation-update', async (event, settings) => {
  try {
    presentationSettings = { ...presentationSettings, ...settings };

    if (presentationWindow && !presentationWindow.isDestroyed()) {
      // Update window mode (alwaysOnTop)
      if (settings.windowMode !== undefined) {
        if (settings.windowMode === 'alwaysOnTop') {
          presentationWindow.setAlwaysOnTop(true);
        } else {
          presentationWindow.setAlwaysOnTop(false);
        }
      }

      // Update window size
      if (settings.windowType !== undefined || settings.width !== undefined || settings.height !== undefined) {
        if (settings.windowType === 'fullscreen') {
          presentationWindow.setFullScreen(true);
        } else {
          presentationWindow.setFullScreen(false);
          if (settings.width && settings.height) {
            presentationWindow.setSize(settings.width, settings.height);
            presentationWindow.center();
          }
        }
      }

      // Update click-through
      if (settings.clickThrough !== undefined) {
        presentationWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
        presentationWindow.setFocusable(!settings.clickThrough);
      }

      // Forward settings to presentation window renderer
      presentationWindow.webContents.send('presentation-settings', presentationSettings);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating presentation mode:', error);
    return { success: false, error: error.message };
  }
});

// Check if presentation mode is active
ipcMain.handle('presentation-status', async () => {
  return {
    active: presentationWindow !== null && !presentationWindow.isDestroyed(),
    settings: presentationSettings,
  };
});

// Send visualization data to presentation window
ipcMain.on('presentation-frame', (event, frameData) => {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.webContents.send('presentation-frame', frameData);
  }
});

// Send visualizer options to presentation window
ipcMain.on('presentation-visualizer-options', (event, options) => {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.webContents.send('presentation-visualizer-options', options);
  }
});

// Send visualizer type change to presentation window
ipcMain.on('presentation-visualizer-type', (event, type) => {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.webContents.send('presentation-visualizer-type', type);
  }
});

// Handle window movement for Alt+MMB dragging
ipcMain.on('presentation-move-window', (event, { deltaX, deltaY }) => {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    const [currentX, currentY] = presentationWindow.getPosition();
    presentationWindow.setPosition(currentX + deltaX, currentY + deltaY);
  }
});

// Report current window position to main window (for saving to settings)
ipcMain.on('presentation-report-position', () => {
  if (presentationWindow && !presentationWindow.isDestroyed() && mainWindow && !mainWindow.isDestroyed()) {
    const [x, y] = presentationWindow.getPosition();
    // Update internal settings
    presentationSettings.x = x;
    presentationSettings.y = y;
    // Notify main window to save position
    mainWindow.webContents.send('presentation-position-changed', { x, y });
  }
});

// Toggle click-through when Alt key state changes
ipcMain.on('presentation-set-click-through', (event, clickThrough) => {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
  }
});
