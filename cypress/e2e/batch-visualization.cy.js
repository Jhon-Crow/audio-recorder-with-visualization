describe('Batch Visualization Mode', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.get('[data-tab="convert"]').click();
  });

  it('allows selecting multiple audio files for conversion', () => {
    cy.get('#audioFile').should('have.attr', 'multiple');

    cy.get('#audioFile')
      .selectFile([
        {
          contents: Cypress.Buffer.from('audio-one'),
          fileName: 'first-track.mp3',
          mimeType: 'audio/mpeg',
        },
        {
          contents: Cypress.Buffer.from('audio-two'),
          fileName: 'second-track.wav',
          mimeType: 'audio/wav',
        },
      ], { force: true });

    cy.get('#convertBtn').should('not.be.disabled');
    cy.get('#previewBtn').should('not.be.disabled');
  });

  it('shows a disabled Save All button until recordings exist', () => {
    cy.get('#saveAllRecordings')
      .should('be.visible')
      .and('be.disabled')
      .and('contain.text', 'Save Selected');
  });

  it('uses one Electron batch save request for Save All', () => {
    cy.window().then((win) => {
      const calls = [];
      win.electronAPI = {
        isElectron: true,
        saveVideoAndShow: cy.stub().as('singleSave'),
        saveAllVideosAndShow: cy.stub().callsFake((recordings) => {
          calls.push(recordings);
          return Promise.resolve({ success: true });
        }).as('batchSave'),
      };

      win.AudioRecorderApp.addRecording(
        new win.Blob(['one'], { type: 'video/webm' }),
        { sourceName: 'first-track.mp3', format: 'webm' }
      );
      win.AudioRecorderApp.addRecording(
        new win.Blob(['two'], { type: 'video/webm' }),
        { sourceName: 'second-track.wav', format: 'webm' }
      );
    });

    cy.get('#saveAllRecordings').click({ force: true });

    cy.get('@batchSave').should('have.been.calledOnce');
    cy.get('@singleSave').should('not.have.been.called');
    cy.get('@batchSave').then((stub) => {
      const recordings = stub.firstCall.args[0];
      expect(recordings).to.have.length(2);
      expect(recordings[0].fileName).to.equal('first-track.webm');
      expect(recordings[1].fileName).to.equal('second-track.webm');
    });
  });

  it('saves only checked recordings from the completed visualizations list', () => {
    cy.window().then((win) => {
      win.electronAPI = {
        isElectron: true,
        saveVideoAndShow: cy.stub(),
        saveAllVideosAndShow: cy.stub().resolves({ success: true }).as('batchSave'),
      };

      win.AudioRecorderApp.addRecording(
        new win.Blob(['one'], { type: 'video/webm' }),
        { sourceName: 'first-track.mp3', format: 'webm' }
      );
      win.AudioRecorderApp.addRecording(
        new win.Blob(['two'], { type: 'video/webm' }),
        { sourceName: 'second-track.wav', format: 'webm' }
      );
    });

    cy.get('.recording-select-checkbox').should('have.length', 2).and('be.checked');
    cy.get('.recording-select-checkbox').first().uncheck({ force: true });
    cy.get('#saveAllRecordings').should('contain.text', 'Save Selected').click({ force: true });

    cy.get('@batchSave').should('have.been.calledOnce');
    cy.get('@batchSave').then((stub) => {
      const recordings = stub.firstCall.args[0];
      expect(recordings).to.have.length(1);
      expect(recordings[0].fileName).to.equal('second-track.webm');
    });
  });

  it('disables bulk saving when no completed visualization is checked', () => {
    cy.window().then((win) => {
      win.AudioRecorderApp.addRecording(
        new win.Blob(['one'], { type: 'video/webm' }),
        { sourceName: 'first-track.mp3', format: 'webm' }
      );
    });

    cy.get('.recording-select-checkbox').should('be.checked').uncheck({ force: true });
    cy.get('#saveAllRecordings').should('be.disabled');
  });

  it('names every MP4 batch recording from the actual rendered blob type', () => {
    cy.window().then((win) => {
      win.AudioRecorderApp.addRecording(
        new win.Blob(['one'], { type: 'video/mp4' }),
        { sourceName: 'first-track.mp3', format: 'webm' }
      );
      win.AudioRecorderApp.addRecording(
        new win.Blob(['two'], { type: 'video/mp4' }),
        { sourceName: 'second-track.wav', format: 'webm' }
      );
    });

    cy.get('#recordingsList').should('contain.text', 'first-track.mp4');
    cy.get('#recordingsList').should('contain.text', 'second-track.mp4');
    cy.get('#recordingsList a[download="first-track.mp4"]').should('exist');
    cy.get('#recordingsList a[download="second-track.mp4"]').should('exist');
  });

  it('names a single MP4 visualization from the actual rendered blob type', () => {
    cy.window().then((win) => {
      win.AudioRecorderApp.addRecording(
        new win.Blob(['one'], { type: 'video/mp4' }),
        { sourceName: 'single-track.mp3', format: 'webm' }
      );
    });

    cy.get('#recordingsList').should('contain.text', 'single-track.mp4');
    cy.get('#recordingsList').should('not.contain.text', 'single-track.webm');
    cy.get('#recordingsList a[download="single-track.mp4"]').should('exist');
    cy.get('#recordingsList a[download="single-track.webm"]').should('not.exist');
  });

  it('uses the selected output format for every file in a batch', () => {
    cy.readFile('examples/app-interactions.js').then((source) => {
      expect(source).to.include('const requestedFormat = el.videoFormat.value;');
      expect(source).to.include('format: requestedFormat,');
      expect(source).not.to.include('format: el.videoFormat.value,');
    });
  });
});
