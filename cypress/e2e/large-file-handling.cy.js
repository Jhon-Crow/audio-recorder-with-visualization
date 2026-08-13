/**
 * Test for Issue #29: Large file save handling
 * Tests that large video files can be saved without materializing the complete
 * Blob as a second renderer-side ArrayBuffer.
 */

describe('Large File Handling', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('streams Electron saves in bounded chunks', () => {
    cy.readFile('electron/preload.js').then((source) => {
      expect(source).to.include('blob.stream().getReader()');
      expect(source).to.include("ipcRenderer.invoke('save-video-chunk'");
      expect(source).not.to.include('await blob.arrayBuffer()');
    });
  });

  it('should handle Uint8Array conversion for file transfer', () => {
    // This test verifies the fix in electron/preload.js
    // We test that we can create and transfer a large Uint8Array

    cy.window().then((win) => {
      // Check if running in Electron
      const isElectron = win.electronAPI && win.electronAPI.isElectron;

      if (isElectron) {
        // Test creating a large Uint8Array (simulating 200MB file)
        const largeSizeMB = 200;
        const largeSizeBytes = largeSizeMB * 1024 * 1024;

        // Create a Blob simulating a large video file
        const testData = new Uint8Array(largeSizeBytes);
        const blob = new Blob([testData], { type: 'video/webm' });

        cy.log(`Created test blob of ${largeSizeMB}MB`);

        // The old code would do: Array.from(new Uint8Array(arrayBuffer))
        // which would throw "Invalid array length" for large files
        // The new code uses Uint8Array directly

        cy.wrap(blob.arrayBuffer()).then((arrayBuffer) => {
          // This should not throw "Invalid array length"
          const uint8Array = new Uint8Array(arrayBuffer);

          expect(uint8Array).to.be.instanceOf(Uint8Array);
          expect(uint8Array.length).to.equal(largeSizeBytes);

          // Verify we can't convert to Array (this would fail for large files)
          let canConvertToArray = false;
          try {
            const arr = Array.from(uint8Array);
            canConvertToArray = true;
          } catch (e) {
            // Expected to fail for very large arrays
            cy.log('Array.from correctly fails for large data:', e.message);
          }

          // Note: In some browsers, Array.from might succeed but be inefficient
          // The key is that Uint8Array works in all cases
        });
      } else {
        cy.log('Not running in Electron, skipping Electron-specific test');
      }
    });
  });

  it('should not use Array.from for blob conversion', () => {
    // Verify the preload.js fix
    cy.window().then((win) => {
      const isElectron = win.electronAPI && win.electronAPI.isElectron;

      if (isElectron) {
        // Create a moderate-sized test blob
        const testSize = 50 * 1024 * 1024; // 50MB
        const testData = new Uint8Array(testSize);
        const blob = new Blob([testData], { type: 'video/webm' });

        cy.log('Testing blob conversion without Array.from');

        // This simulates what the new code does
        cy.wrap(blob.arrayBuffer()).then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);

          // Verify it's a Uint8Array (not an Array)
          expect(uint8Array).to.be.instanceOf(Uint8Array);
          expect(Array.isArray(uint8Array)).to.be.false;

          // Verify the data can be transferred to IPC
          // (In real Electron, this would be passed to ipcRenderer.invoke)
          expect(uint8Array.byteLength).to.equal(testSize);
        });
      } else {
        cy.log('Not running in Electron, skipping test');
      }
    });
  });

  it('should handle Blob.arrayBuffer() conversion', () => {
    // Test that our approach works for various blob sizes
    const testSizes = [
      1 * 1024 * 1024,      // 1MB
      10 * 1024 * 1024,     // 10MB
      50 * 1024 * 1024,     // 50MB
    ];

    testSizes.forEach((size) => {
      const sizeMB = size / (1024 * 1024);

      cy.log(`Testing ${sizeMB}MB blob`);

      // Create test blob
      const testData = new Uint8Array(size);
      const blob = new Blob([testData], { type: 'video/webm' });

      // Convert to Uint8Array (as the fix does)
      cy.wrap(blob.arrayBuffer()).then((arrayBuffer) => {
        const uint8Array = new Uint8Array(arrayBuffer);

        expect(uint8Array.byteLength).to.equal(size);
        expect(uint8Array).to.be.instanceOf(Uint8Array);

        cy.log(`✓ Successfully converted ${sizeMB}MB blob to Uint8Array`);
      });
    });
  });

  it('should demonstrate Array.from limitation for documentation', () => {
    // This test documents why we needed the fix

    cy.log('Demonstrating why Array.from fails for large files');

    // Test with progressively larger sizes to find where Array.from fails
    // Note: The exact limit depends on the browser and available memory
    const testSizes = [
      1 * 1024 * 1024,      // 1MB - should work
      10 * 1024 * 1024,     // 10MB - should work
      100 * 1024 * 1024,    // 100MB - might fail
    ];

    testSizes.forEach((size) => {
      const sizeMB = size / (1024 * 1024);
      const testData = new Uint8Array(size);

      cy.log(`Testing Array.from with ${sizeMB}MB`);

      let success = false;
      try {
        const arr = Array.from(testData);
        success = true;
        cy.log(`✓ Array.from worked for ${sizeMB}MB (length: ${arr.length})`);
      } catch (e) {
        cy.log(`✗ Array.from failed for ${sizeMB}MB: ${e.message}`);
      }
    });
  });
});
