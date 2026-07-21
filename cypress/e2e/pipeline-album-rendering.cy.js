describe('Pipeline album rendering', () => {
  const savedVisualizationPresets = [
    {
      id: 'album-render-preset',
      name: 'Album render preset',
      settings: {
        visualizer: 'bars',
        primaryColor: '#00ff88',
        secondaryColor: '#00d4ff',
        backgroundColor: '#071923',
      },
    },
  ];

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          'audio-recorder-presets',
          JSON.stringify(savedVisualizationPresets)
        );
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          kind: 'release',
          name: 'Regression album',
          action: 'visualize-only',
          releaseType: 'album-with-full',
          resolution: '1920x1080',
          presetId: 'preset:album-render-preset',
          publishImmediately: true,
        },
      ]);
    });

    cy.get('.pipeline-stage-file-input').selectFile([
      {
        contents: Cypress.Buffer.from('track-one-audio'),
        fileName: 'track-one.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        contents: Cypress.Buffer.from('track-two-audio'),
        fileName: 'track-two.mp3',
        mimeType: 'audio/mpeg',
      },
    ], { force: true });
  });

  it('pauses the preview loop and stitches the two completed track videos', () => {
    cy.window().then((win) => {
      const app = win.AudioRecorderApp;
      Object.defineProperty(app.recorder, 'isVisualizationActive', {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(app.recorder, 'sourceType', {
        configurable: true,
        get: () => 'file',
      });

      cy.stub(app.recorder, 'stopVisualization').as('stopPipelinePreview');
      cy.stub(app.recorder, 'resumeVisualization').as('resumePipelinePreview');
      cy.stub(app.converter, 'convertWithFallback')
        .callsFake(({ audioSource, onProgress }) => {
          onProgress?.(0.5);
          onProgress?.(1);
          return Promise.resolve({
            blob: new win.Blob([`rendered:${audioSource.name}`], { type: 'video/webm' }),
            format: 'webm',
            usedFallback: false,
          });
        })
        .as('renderPipelineTrack');

      const concatenateVideosWithFallback = cy.stub()
        .callsFake(({ videoSources, onProgress }) => {
          onProgress?.(0.5);
          onProgress?.(1);
          return Promise.resolve({
            blob: new win.Blob(['valid-full-album'], { type: 'video/webm' }),
            format: 'webm',
            usedFallback: false,
            sourceCount: videoSources.length,
          });
        });
      app.converter.concatenateVideosWithFallback = concatenateVideosWithFallback;
      cy.wrap(concatenateVideosWithFallback).as('stitchPipelineAlbum');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    cy.get('#status').should('contain.text', 'Pipeline complete: 3 tasks finished');

    cy.get('@renderPipelineTrack').should('have.callCount', 2);
    cy.get('@renderPipelineTrack').then((renderTrack) => {
      expect(renderTrack.getCalls().map(call => call.args[0].audioSource.name)).to.deep.equal([
        'track-one.mp3',
        'track-two.mp3',
      ]);
    });
    cy.get('@stitchPipelineAlbum').should('have.been.calledOnce');
    cy.get('@stitchPipelineAlbum').then((stitchAlbum) => {
      const config = stitchAlbum.firstCall.args[0];
      expect(config.videoSources).to.have.length(2);
      expect(config.videoSources.every(source => source.type === 'video/webm')).to.equal(true);
      expect(config.canvas).to.equal(Cypress.$('#visualizer')[0]);
      expect(config.videoWidth).to.equal(1920);
      expect(config.videoHeight).to.equal(1080);
      expect(config.format).to.equal('webm');
    });
    cy.get('@stopPipelinePreview').should('have.been.calledOnce');
    cy.get('@resumePipelinePreview').should('have.been.calledOnce');
    cy.get('#recordingsList').should('contain.text', 'Regression album (full album).webm');
  });
});
