describe('Pipeline album rendering', () => {
  function createShortVideo(win, color) {
    return new Cypress.Promise((resolve, reject) => {
      const canvas = win.document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(15);
      const mimeType = win.MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
      const recorder = new win.MediaRecorder(stream, { mimeType });
      const chunks = [];
      let frame = 0;
      const drawFrame = () => {
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.fillRect(frame % canvas.width, 0, 2, 2);
        frame += 1;
      };
      const frameTimer = win.setInterval(drawFrame, 30);

      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = event => {
        win.clearInterval(frameTimer);
        stream.getTracks().forEach(track => track.stop());
        reject(event.error || new Error('Failed to create source video'));
      };
      recorder.onstop = () => {
        win.clearInterval(frameTimer);
        stream.getTracks().forEach(track => track.stop());
        resolve(new win.Blob(chunks, { type: recorder.mimeType }));
      };

      drawFrame();
      recorder.start(50);
      win.setTimeout(() => recorder.stop(), 300);
    });
  }

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

  it('reuses completed track and full-album renders after switching to upload only', () => {
    cy.window().then((win) => {
      const app = win.AudioRecorderApp;
      cy.stub(app.converter, 'convertWithFallback')
        .callsFake(({ audioSource }) => Promise.resolve({
          blob: new win.Blob([`rendered:${audioSource.name}`], { type: 'video/webm' }),
          format: 'webm',
          usedFallback: false,
        }))
        .as('renderPipelineTrack');
      cy.stub(app.converter, 'concatenateVideosWithFallback')
        .resolves({
          blob: new win.Blob(['rendered:full-album'], { type: 'video/webm' }),
          format: 'webm',
          usedFallback: false,
          sourceCount: 2,
        })
        .as('stitchPipelineAlbum');
    });

    cy.get('#runPipelineBtn').click();
    cy.get('#status').should('contain.text', 'Pipeline complete: 3 tasks finished');

    cy.window().then((win) => {
      const stage = win.AudioRecorderPipeline.getStages()[0];
      win.localStorage.setItem('audio-recorder-pipeline-stages', JSON.stringify([{
        ...stage,
        action: 'upload-youtube',
        publishImmediately: true,
      }]));
    });
    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
    cy.get('.pipeline-file-names').should('contain.text', '2 selected');
    cy.window().then((win) => {
      win.AudioRecorderYouTube = {
        hasValidAccessToken: () => true,
        ensureAuthorized: () => Promise.resolve(),
        uploadDirect: cy.stub().callsFake(({ video, title }) => video.text().then(body => ({
            id: title,
            url: body,
            warnings: [],
          }))),
      };
      cy.wrap(win.AudioRecorderYouTube.uploadDirect).as('uploadRenderedVideo');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    cy.get('#status').should('contain.text', 'Pipeline complete: 3 tasks finished');
    cy.get('@renderPipelineTrack').should('have.callCount', 2);
    cy.get('@stitchPipelineAlbum').should('have.been.calledOnce');
    cy.get('@uploadRenderedVideo').should('have.callCount', 3).then((upload) => {
      expect(upload.getCalls().map(call => call.returnValue)).to.have.length(3);
      return Cypress.Promise.all(upload.getCalls().map(call => call.returnValue));
    }).then((results) => {
      expect(results.map(result => result.url)).to.deep.equal([
        'rendered:track-one.mp3',
        'rendered:track-two.mp3',
        'rendered:full-album',
      ]);
    });
  });

  it('creates a playable container from completed browser-recorded videos', () => {
    cy.window().then(async (win) => {
      const sources = [
        await createShortVideo(win, '#d7263d'),
        await createShortVideo(win, '#1b998b'),
      ];
      const progress = [];
      const result = await win.AudioRecorderApp.converter.concatenateVideosWithFallback({
        videoSources: sources,
        canvas: win.AudioRecorderApp.canvas,
        fps: 15,
        videoWidth: 320,
        videoHeight: 180,
        format: 'webm',
        onProgress: value => progress.push(value),
      });

      expect(result.format).to.equal('webm');
      expect(result.usedFallback).to.equal(false);
      expect(result.blob.type).to.include('video/webm');
      expect(result.blob.size).to.be.greaterThan(0);
      expect(progress[0]).to.equal(0);
      expect(progress.at(-1)).to.equal(1);
      expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).to.equal(true);

      const outputUrl = win.URL.createObjectURL(result.blob);
      const outputVideo = win.document.createElement('video');
      outputVideo.muted = true;
      outputVideo.src = outputUrl;
      try {
        await new Cypress.Promise((resolve, reject) => {
          outputVideo.addEventListener('loadeddata', resolve, { once: true });
          outputVideo.addEventListener('error', () => reject(new Error('Joined output is not playable')), {
            once: true,
          });
          outputVideo.load();
        });
        expect(outputVideo.videoWidth).to.equal(320);
        expect(outputVideo.videoHeight).to.equal(180);

        const sampleCanvas = win.document.createElement('canvas');
        sampleCanvas.width = 1;
        sampleCanvas.height = 1;
        const sampleContext = sampleCanvas.getContext('2d');
        const observedColors = [];
        await new Cypress.Promise((resolve, reject) => {
          let frameCallbackHandle = null;
          let fallbackTimer = null;
          const sampleFrame = () => {
            sampleContext.drawImage(outputVideo, 0, 0, 1, 1);
            observedColors.push([...sampleContext.getImageData(0, 0, 1, 1).data]);
          };
          const collectFrame = () => {
            sampleFrame();
            if (!outputVideo.ended) {
              if (outputVideo.requestVideoFrameCallback) {
                frameCallbackHandle = outputVideo.requestVideoFrameCallback(collectFrame);
              } else {
                fallbackTimer = win.setTimeout(collectFrame, 30);
              }
            }
          };
          const cleanup = () => {
            if (frameCallbackHandle !== null && outputVideo.cancelVideoFrameCallback) {
              outputVideo.cancelVideoFrameCallback(frameCallbackHandle);
            }
            if (fallbackTimer !== null) win.clearTimeout(fallbackTimer);
          };

          outputVideo.addEventListener('ended', () => {
            cleanup();
            sampleFrame();
            resolve();
          }, { once: true });
          outputVideo.addEventListener('error', () => {
            cleanup();
            reject(new Error('Joined output failed during playback'));
          }, { once: true });
          collectFrame();
          outputVideo.play().catch(reject);
        });

        expect(observedColors.some(([red, green]) => red > green * 2)).to.equal(true);
        expect(observedColors.some(([red, green]) => green > red * 2)).to.equal(true);
      } finally {
        outputVideo.removeAttribute('src');
        outputVideo.load();
        win.URL.revokeObjectURL(outputUrl);
      }
    });
  });
});
