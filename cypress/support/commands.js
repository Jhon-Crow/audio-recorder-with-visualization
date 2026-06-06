// ***********************************************
// Custom commands for the audio recorder app
// ***********************************************

/**
 * Wait for the canvas to be drawn with visualization
 */
Cypress.Commands.add('waitForVisualization', (timeout = 3000) => {
  cy.get('#visualizer', { timeout }).should('be.visible');
  // Wait a bit for the visualization to actually render
  cy.wait(500);
});

/**
 * Clear localStorage and reload the page
 */
Cypress.Commands.add('clearStorageAndReload', () => {
  cy.clearLocalStorage();
  cy.reload();
});

/**
 * Load a test image as background
 */
Cypress.Commands.add('loadTestBackgroundImage', () => {
  // Create a small test image (1x1 red pixel PNG data URL)
  const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  cy.window().then((win) => {
    // Simulate loading the background image by setting it directly
    win.eval(`
      (async () => {
        const app = window.AudioRecorderApp;
        const recorder = app && app.recorder;
        if (recorder) {
          await recorder.setVisualizerOptions({
            backgroundImage: '${testImageDataUrl}'
          });
        }
        if (app) {
          app.currentBackgroundImageUrl = '${testImageDataUrl}';
        }
      })();
    `);
  });
});

/**
 * Get the current visualizer options from the recorder
 */
Cypress.Commands.add('getVisualizerOptions', () => {
  return cy.window().then((win) => {
    const recorder = win.AudioRecorderApp && win.AudioRecorderApp.recorder;
    if (recorder && recorder.visualizer) {
      return recorder.visualizer.options;
    }
    return null;
  });
});

/**
 * Save current settings to localStorage via the app's save function
 */
Cypress.Commands.add('saveAppSettings', () => {
  cy.window().then((win) => {
    const app = win.AudioRecorderApp;
    if (app && typeof app.getCurrentSettings === 'function' && typeof app.saveSettings === 'function') {
      const settings = app.getCurrentSettings();
      app.saveSettings(settings);
    }
  });
});
