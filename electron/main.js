const { app, BrowserWindow, ipcMain, shell, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

// Keep a global reference of the window objects to prevent garbage collection
let mainWindow = null;
let presentationWindow = null;
let appServer = null;
let appServerUrl = null;

const APP_SERVER_HOST = 'localhost';
const APP_SERVER_PORT = 8080;
const OAUTH_LOOPBACK_HOST = '127.0.0.1';
const OAUTH_FLOW_TIMEOUT_MS = 180000;
const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const GOOGLE_CLIENT_ID_PATTERN = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;
const YOUTUBE_AUTH_STORE_FILE = 'youtube-auth.json';
let activeYouTubeOAuthCleanup = null;

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

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.wasm': 'application/wasm',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

function sendStaticFile(response, rootDir, urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const filePath = path.join(rootDir, requestedPath);
  const relativePath = path.relative(rootDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function createAppServer(examplesDir, distDir) {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${APP_SERVER_HOST}`);

    if (requestUrl.pathname.startsWith('/dist/')) {
      sendStaticFile(response, distDir, requestUrl.pathname.slice('/dist'.length));
      return;
    }

    sendStaticFile(response, examplesDir, requestUrl.pathname);
  });
}

function listenHttpServer(server, port, host) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off('error', handleError);
      server.off('listening', handleListening);
    };
    const handleError = (error) => {
      cleanup();
      reject(error);
    };
    const handleListening = () => {
      cleanup();
      resolve(server.address());
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, host);
  });
}

function getYouTubeAuthStorePath() {
  return path.join(app.getPath('userData'), YOUTUBE_AUTH_STORE_FILE);
}

function readStoredYouTubeAuth() {
  try {
    const filePath = getYouTubeAuthStorePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('Failed to read stored YouTube authorization:', error);
    return null;
  }
}

function writeStoredYouTubeAuth(authState) {
  try {
    fs.mkdirSync(path.dirname(getYouTubeAuthStorePath()), { recursive: true });
    fs.writeFileSync(getYouTubeAuthStorePath(), JSON.stringify(authState, null, 2));
  } catch (error) {
    console.warn('Failed to store YouTube authorization:', error);
  }
}

function clearStoredYouTubeAuth() {
  try {
    const filePath = getYouTubeAuthStorePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('Failed to clear stored YouTube authorization:', error);
  }
}

function listenAppServer(server, port) {
  return listenHttpServer(server, port, APP_SERVER_HOST);
}

async function startAppServer() {
  if (appServerUrl) {
    return Promise.resolve(appServerUrl);
  }

  const examplesDir = path.join(__dirname, '..', 'examples');
  const distDir = path.join(__dirname, '..', 'dist');

  try {
    appServer = createAppServer(examplesDir, distDir);
    const address = await listenAppServer(appServer, APP_SERVER_PORT);
    appServerUrl = `http://${APP_SERVER_HOST}:${address.port}`;
    return appServerUrl;
  } catch (error) {
    if (!error || error.code !== 'EADDRINUSE') {
      appServer = null;
      throw error;
    }
  }

  appServer = createAppServer(examplesDir, distDir);
  const address = await listenAppServer(appServer, 0);
  appServerUrl = `http://${APP_SERVER_HOST}:${address.port}`;
  return appServerUrl;
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createRandomBase64Url(byteLength = 32) {
  return base64UrlEncode(crypto.randomBytes(byteLength));
}

function createCodeChallenge(codeVerifier) {
  return base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendOAuthCallbackPage(response, title, message) {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #1f2937; }
    main { max-width: 560px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`);
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close(() => resolve());
  });
}

function waitForYouTubeOAuthCode(server, expectedState) {
  let finish = null;
  const promise = new Promise((resolve, reject) => {
    let finished = false;
    let timeout = null;

    finish = (error, code) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      server.off('request', handleRequest);

      if (error) {
        reject(error);
      } else {
        resolve(code);
      }
    };

    const handleRequest = (request, response) => {
      const requestUrl = new URL(request.url, `http://${OAUTH_LOOPBACK_HOST}`);
      const state = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');
      const errorDescription = requestUrl.searchParams.get('error_description');

      if (!state && !code && !error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      if (state !== expectedState) {
        sendOAuthCallbackPage(response, 'Google Sign In Failed', 'The authorization response did not match this app session. Return to the app and try again.');
        finish(new Error('Google sign-in failed because the authorization state did not match this app session.'));
        return;
      }

      if (error) {
        const message = errorDescription || error;
        sendOAuthCallbackPage(response, 'Google Sign In Failed', message);
        finish(new Error(message));
        return;
      }

      if (!code) {
        sendOAuthCallbackPage(response, 'Google Sign In Failed', 'Google did not return an authorization code.');
        finish(new Error('Google did not return an authorization code.'));
        return;
      }

      sendOAuthCallbackPage(response, 'Google Sign In Complete', 'You can close this browser tab and return to Audio Recorder with Visualization.');
      finish(null, code);
    };

    timeout = setTimeout(() => {
      finish(new Error('Google sign-in timed out. Try again and complete authorization in the browser window.'));
    }, OAUTH_FLOW_TIMEOUT_MS);
    server.on('request', handleRequest);
  });

  return {
    promise,
    cancel(message = 'Google sign-in was cancelled.') {
      if (finish) {
        finish(new Error(message));
      }
    },
  };
}

function getOAuthTokenErrorMessage(details, status) {
  const errorCode = details && typeof details.error === 'string' ? details.error : '';
  const description = details && typeof details.error_description === 'string' ? details.error_description : '';
  const detailText = description || errorCode;

  if (errorCode === 'invalid_client' || /invalid_client/i.test(detailText)) {
    return 'Google rejected this Desktop OAuth Client ID. Create a Desktop app OAuth Client ID in Google Cloud Console for a project with YouTube Data API v3 enabled, paste that Client ID here, and paste the Desktop Client Secret too if Google generated one.';
  }

  if (errorCode === 'redirect_uri_mismatch' || /redirect_uri_mismatch/i.test(detailText)) {
    return 'Google rejected the loopback redirect URI. Use a Desktop app OAuth Client ID for the packaged Electron app; Web application client IDs are only for browser localhost usage.';
  }

  return detailText || `Google token exchange failed with status ${status}.`;
}

async function exchangeYouTubeOAuthCode({ clientId, clientSecret, code, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await response.text();
  let details = null;

  if (text) {
    try {
      details = JSON.parse(text);
    } catch {
      details = { error_description: text };
    }
  }

  if (!response.ok) {
    throw new Error(getOAuthTokenErrorMessage(details, response.status));
  }

  if (!details || typeof details.access_token !== 'string') {
    throw new Error('Google token exchange did not return an access token.');
  }

  return {
    accessToken: details.access_token,
    expiresIn: Number(details.expires_in || 3600),
    refreshToken: typeof details.refresh_token === 'string' ? details.refresh_token : '',
    scope: typeof details.scope === 'string' ? details.scope : YOUTUBE_UPLOAD_SCOPE,
  };
}

async function refreshYouTubeAccessToken(authState) {
  if (!authState || !authState.clientId || !authState.refreshToken) {
    throw new Error('Stored Google authorization is incomplete.');
  }

  const body = new URLSearchParams({
    client_id: authState.clientId,
    grant_type: 'refresh_token',
    refresh_token: authState.refreshToken,
  });

  if (authState.clientSecret) {
    body.set('client_secret', authState.clientSecret);
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await response.text();
  let details = null;

  if (text) {
    try {
      details = JSON.parse(text);
    } catch {
      details = { error_description: text };
    }
  }

  if (!response.ok) {
    clearStoredYouTubeAuth();
    throw new Error(getOAuthTokenErrorMessage(details, response.status));
  }

  if (!details || typeof details.access_token !== 'string') {
    throw new Error('Google token refresh did not return an access token.');
  }

  return {
    accessToken: details.access_token,
    expiresIn: Number(details.expires_in || 3600),
    scope: typeof details.scope === 'string' ? details.scope : YOUTUBE_UPLOAD_SCOPE,
  };
}

async function authorizeYouTubeWithDesktopOAuth(clientId, clientSecret = '') {
  const trimmedClientId = String(clientId || '').trim();
  const trimmedClientSecret = String(clientSecret || '').trim();

  if (!GOOGLE_CLIENT_ID_PATTERN.test(trimmedClientId)) {
    throw new Error('Use a Google OAuth Client ID ending in .apps.googleusercontent.com.');
  }

  const storedAuth = readStoredYouTubeAuth();
  if (
    storedAuth &&
    storedAuth.clientId === trimmedClientId &&
    storedAuth.clientSecret === trimmedClientSecret &&
    storedAuth.refreshToken
  ) {
    return refreshYouTubeAccessToken(storedAuth);
  }

  if (activeYouTubeOAuthCleanup) {
    throw new Error('A Google sign-in flow is already in progress.');
  }

  const server = http.createServer();
  let codeWaiter = null;
  activeYouTubeOAuthCleanup = () => {
    if (codeWaiter) {
      codeWaiter.cancel();
    }
    return closeServer(server);
  };

  try {
    const address = await listenHttpServer(server, 0, OAUTH_LOOPBACK_HOST);
    const redirectUri = `http://${OAUTH_LOOPBACK_HOST}:${address.port}/`;
    const state = createRandomBase64Url();
    const codeVerifier = createRandomBase64Url(64);
    const codeChallenge = createCodeChallenge(codeVerifier);
    codeWaiter = waitForYouTubeOAuthCode(server, state);
    const authUrl = new URL(GOOGLE_OAUTH_AUTH_URL);

    authUrl.searchParams.set('client_id', trimmedClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', YOUTUBE_UPLOAD_SCOPE);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    await shell.openExternal(authUrl.toString());
    const code = await codeWaiter.promise;

    const tokenResult = await exchangeYouTubeOAuthCode({
      clientId: trimmedClientId,
      clientSecret: trimmedClientSecret,
      code,
      redirectUri,
      codeVerifier,
    });

    if (tokenResult.refreshToken) {
      writeStoredYouTubeAuth({
        clientId: trimmedClientId,
        clientSecret: trimmedClientSecret,
        refreshToken: tokenResult.refreshToken,
      });
    }

    return tokenResult;
  } finally {
    if (codeWaiter) {
      codeWaiter.cancel();
      await codeWaiter.promise.catch(() => {});
    }
    await closeServer(server);
    if (activeYouTubeOAuthCleanup) {
      activeYouTubeOAuthCleanup = null;
    }
  }
}

async function createWindow() {
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

  // Load through localhost so browser APIs and static assets use an HTTP origin.
  const serverUrl = await startAppServer();
  mainWindow.loadURL(`${serverUrl}/index.html`);

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

  if (appServerUrl) {
    presentationWindow.loadURL(`${appServerUrl}/presentation.html`);
  } else {
    presentationWindow.loadURL(pathToFileURL(path.join(__dirname, '..', 'examples', 'presentation.html')).toString());
  }

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
app.whenReady().then(async () => {
  await createWindow();

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
  if (appServer) {
    appServer.close();
  }
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

ipcMain.handle('youtube-authorize', async (event, credentials) => {
  try {
    return await authorizeYouTubeWithDesktopOAuth(
      credentials && credentials.clientId,
      credentials && credentials.clientSecret
    );
  } catch (error) {
    console.error('Error authorizing YouTube upload:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('youtube-clear-authorization', async () => {
  clearStoredYouTubeAuth();
  return { success: true };
});

ipcMain.handle('preset-choose-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    console.error('Error choosing preset folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('preset-save-file', async (event, folderPath, preset) => {
  try {
    if (!folderPath) {
      return { success: false, error: 'Preset folder is not configured' };
    }

    fs.mkdirSync(folderPath, { recursive: true });
    const safeName = String(preset.name || 'preset')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/^\.+$/, 'preset')
      .slice(0, 80);
    const filePath = path.join(folderPath, `${safeName}-${preset.id || Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(preset, null, 2), 'utf8');

    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving preset file:', error);
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
