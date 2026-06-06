/**
 * Test for Issue #29: Background size mode preservation after reload
 * Tests that background size modes (cover, contain, etc.) are correctly
 * preserved and applied after page reload
 */

describe('Background Size Mode Preservation', () => {
  beforeEach(() => {
    // Clear any previous settings and visit the page
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('should load with default background size mode (cover)', () => {
    cy.get('#bgSizeMode').should('have.value', 'cover');
  });

  it('should persist background size mode to localStorage when changed', () => {
    // Change to contain mode
    cy.get('#bgSizeMode').select('contain');

    // Wait for settings to be saved (should happen automatically on change)
    cy.wait(500);

    // Verify localStorage has the correct value
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem('audio-recorder-settings'));
      expect(saved).to.not.be.null;
      expect(saved.backgroundSizeMode).to.equal('contain');
    });
  });

  it('should restore background size mode after page reload', () => {
    const modes = ['contain', 'stretch', 'tile', 'center'];

    modes.forEach((mode) => {
      // Clear and start fresh
      cy.clearLocalStorage();
      cy.reload();
      cy.waitForVisualization();

      // Set the mode
      cy.get('#bgSizeMode').select(mode);
      cy.wait(500);

      // Reload the page
      cy.reload();
      cy.waitForVisualization();

      // Verify the mode is restored
      cy.get('#bgSizeMode').should('have.value', mode);

      // Verify the visualizer also has the correct mode
      cy.getVisualizerOptions().then((options) => {
        expect(options).to.not.be.null;
        expect(options.backgroundSizeMode).to.equal(mode);
      });
    });
  });

  it('should apply background size mode correctly with a background image', () => {
    cy.fixture('test-image.json').then((testImage) => {
      const modes = ['cover', 'contain', 'stretch', 'center'];

      modes.forEach((mode) => {
        // Load a test background image
        cy.window().then(async (win) => {
          const recorder = win.AudioRecorderApp && win.AudioRecorderApp.recorder;
          if (recorder) {
            await recorder.setVisualizerOptions({
              backgroundImage: testImage.dataUrl,
              backgroundSizeMode: mode
            });
            recorder.showDemoVisualization(500);
          }
        });

        cy.wait(600);

        // Verify the mode is set correctly
        cy.getVisualizerOptions().then((options) => {
          expect(options.backgroundSizeMode).to.equal(mode);
        });

        // Take a screenshot for visual verification
        cy.screenshot(`background-mode-${mode}`, { overwrite: true });
      });
    });
  });

  it('should preserve background size mode with background image after reload', () => {
    cy.fixture('test-image.json').then((testImage) => {
      // Set background image and mode
      cy.window().then(async (win) => {
        const app = win.AudioRecorderApp;
        const recorder = app && app.recorder;
        if (recorder) {
          await recorder.setVisualizerOptions({
            backgroundImage: testImage.dataUrl,
            backgroundSizeMode: 'contain'
          });
          recorder.showDemoVisualization(500);
        }
        // Manually inject the image into app state before saving through the UI.
        if (app) {
          app.currentBackgroundImageUrl = testImage.dataUrl;
        }
      });

      // Set the dropdown value
      cy.get('#bgSizeMode').select('contain');
      cy.wait(500);

      // Verify settings are saved
      cy.window().then((win) => {
        const saved = JSON.parse(win.localStorage.getItem('audio-recorder-settings'));
        expect(saved.backgroundSizeMode).to.equal('contain');
        expect(saved.backgroundImage).to.equal(testImage.dataUrl);
      });

      // Reload the page
      cy.reload();
      cy.waitForVisualization();

      // Verify mode is restored
      cy.get('#bgSizeMode').should('have.value', 'contain');

      // Verify visualizer has the correct settings
      cy.getVisualizerOptions().then((options) => {
        expect(options.backgroundSizeMode).to.equal('contain');
        expect(options.backgroundImage).to.exist;
      });

      // Visual verification
      cy.screenshot('background-contain-after-reload', { overwrite: true });
    });
  });

  it('should show custom size controls when custom mode is selected', () => {
    // Custom size controls should be hidden initially
    cy.get('#customSizeControls').should('not.be.visible');

    // Select custom mode
    cy.get('#bgSizeMode').select('custom');
    cy.wait(100);

    // Custom size controls should now be visible
    cy.get('#customSizeControls').should('be.visible');

    // Reload and verify it persists
    cy.reload();
    cy.waitForVisualization();

    cy.get('#bgSizeMode').should('have.value', 'custom');
    cy.get('#customSizeControls').should('be.visible');
  });
});
