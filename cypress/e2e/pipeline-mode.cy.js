describe('Pipeline Mode', () => {
  const savedVisualizationPresets = [
    {
      id: 'preset-cypress-bars',
      name: 'Cypress Bars',
      settings: {
        visualizer: 'bars',
        primaryColor: '#00ff88',
        secondaryColor: '#00d4ff',
      },
    },
    {
      id: 'preset-cypress-waveform',
      name: 'Cypress Waveform',
      settings: {
        visualizer: 'waveform',
        primaryColor: '#ffdd57',
        secondaryColor: '#ff5a5a',
      },
    },
  ];

  const combinedYouTubeScope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ].join(' ');

  function seedSavedVisualizationPresets(win) {
    win.localStorage.setItem('audio-recorder-presets', JSON.stringify(savedVisualizationPresets));
  }

  function seedFlatVisualizationPresets(win) {
    win.localStorage.setItem('audio-recorder-presets', JSON.stringify([
      {
        id: 'flat-preset',
        name: 'Flat Saved Preset',
        visualizer: 'bars',
        primaryColor: '#ffffff',
      },
    ]));
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html', { onBeforeLoad: seedSavedVisualizationPresets });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
  });

  function selectFilesForEveryStage() {
    cy.get('.pipeline-stage-file-input').then(($inputs) => {
      Cypress._.times($inputs.length, (index) => {
        cy.get('.pipeline-stage-file-input').eq(index).selectFile({
          contents: Cypress.Buffer.from(`audio-${index}`),
          fileName: `track-${index + 1}.mp3`,
          mimeType: 'audio/mpeg',
        }, { force: true });
      });
    });
  }

  it('seeds and persists the default release pipeline with a right sidebar', () => {
    cy.get('#pipelineSidebar').should('be.visible');
    cy.get('.pipeline-stage').should('have.length', 3);
    cy.get('.pipeline-stage').eq(0).find('.pipeline-stage-name').should('have.value', 'Pre-save short');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-name').should('have.value', 'Release');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-album-track').should('have.length', 2);
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name').should('have.value', 'Post-album short');
    cy.get('#runPipelineBtn').should('be.disabled');
    cy.get('.pipeline-file-btn').first().should('contain.text', 'УКАЖИТЕ ФАЙЛ/ФАЙЛЫ');

    cy.get('#savePipelineBtn').click();
    cy.get('#pipelineList .pipeline-load-btn').should('have.length', 1).and('contain.text', 'Pipeline 1');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').clear().type('Edited short');

    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').should('have.value', 'Edited short');
    cy.get('#pipelineList .pipeline-load-btn').should('have.length', 1).and('contain.text', 'Pipeline 1');
  });

  it('requires files before running and resets selected fields with a hold action', () => {
    selectFilesForEveryStage();
    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    cy.get('#resetPipelineFieldsBtn').should('be.visible');

    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').clear().type('Mutated title');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-description').type('description to reset');

    cy.get('#resetPipelineFieldsBtn').click();
    cy.get('#pipelineResetModal').should('be.visible');
    cy.get('#resetPipelineNames').should('be.checked');
    cy.get('#resetPipelineFiles').should('be.checked');
    cy.get('#confirmPipelineResetHoldBtn')
      .trigger('pointerdown')
      .wait(700);

    cy.get('#pipelineResetModal').should('not.be.visible');
    cy.get('#runPipelineBtn').should('be.disabled');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').should('have.value', 'Pre-save short');
    cy.get('.pipeline-file-btn').first().should('contain.text', 'УКАЖИТЕ ФАЙЛ/ФАЙЛЫ');
    cy.window().then((win) => {
      const options = JSON.parse(win.localStorage.getItem('audio-recorder-pipeline-reset-options'));
      expect(options.names).to.equal(true);
      expect(options.files).to.equal(true);
    });
  });

  it('asks for and persists a timezone when delayed publishing is first used', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('audio-recorder-pipeline-timezone');
    });
    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').eq(1).find('.pipeline-publish-at').focus();
    cy.get('#pipelineTimezoneModal').should('be.visible');
    cy.get('#pipelineTimezoneSelect').select('Europe/Moscow');
    cy.get('#confirmPipelineTimezoneBtn').click();

    cy.get('#pipelineTimezoneModal').should('not.be.visible');
    cy.get('#pipelineTimezoneBtn').should('contain.text', 'Europe/Moscow');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('audio-recorder-pipeline-timezone')).to.equal('Europe/Moscow');
    });

    cy.get('#pipelineSettingsBtn').click();
    cy.get('#pipelineTimezoneSelect').should('have.value', 'Europe/Moscow');
  });

  it('uses saved visualization presets and disables inactive timing fields', () => {
    cy.get('.pipeline-stage').first().should('have.class', 'schedule-relative').within(() => {
      cy.contains('label', 'Preset').find('select').then(($select) => {
        const labels = [...$select[0].options].map((option) => option.textContent);
        const values = [...$select[0].options].map((option) => option.value);
        expect(labels).to.deep.equal(['Cypress Bars', 'Cypress Waveform']);
        expect(values).to.deep.equal(['preset:preset-cypress-bars', 'preset:preset-cypress-waveform']);
      });
      cy.get('.pipeline-publish-at').should('be.disabled');
      cy.get('.pipeline-relative-days').should('not.be.disabled').and('have.value', '2');
      cy.get('.pipeline-relative-summary').should('contain.text', 'за 2 дня перед Release');
    });

    cy.get('.pipeline-stage').eq(1).should('have.class', 'schedule-absolute').within(() => {
      cy.get('.pipeline-publish-at').should('not.be.disabled');
      cy.get('.pipeline-relative-offset').should('be.disabled');
      cy.get('.pipeline-relative-summary div').should('have.length', 2);
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Immediately').find('input').check();
    });
    cy.get('.pipeline-stage').first().should('have.class', 'schedule-immediate').within(() => {
      cy.get('.pipeline-publish-at').should('be.disabled');
      cy.get('.pipeline-relative-offset').should('be.disabled');
      cy.get('.pipeline-relative-reference').should('be.disabled');
    });
  });

  it('keeps relative publish dates current when the reference date changes', () => {
    cy.get('.pipeline-stage').first().find('.pipeline-publish-at').then(($input) => {
      expect($input.val()).to.not.equal('');
    });

    cy.get('.pipeline-stage').eq(1).find('.pipeline-publish-at').then(($input) => {
      $input[0].value = '2026-08-10T18:00';
      $input[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    cy.get('.pipeline-stage').first().find('.pipeline-publish-at')
      .should('be.disabled')
      .and('have.value', '2026-08-08T18:00');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-publish-at')
      .should('be.disabled')
      .and('have.value', '2026-08-11T18:00');
  });

  it('loads sidebar presets stored as flat setting objects', () => {
    cy.visit('/examples/index.html', { onBeforeLoad: seedFlatVisualizationPresets });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'Flat Saved Preset')
        .and('have.value', 'preset:flat-preset');
    });
  });

  it('blocks out-of-order YouTube uploads by default and allows manual order from settings', () => {
    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          name: 'First upload',
          action: 'upload-youtube',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-07-02T12:00',
          publishImmediately: false,
        },
        {
          name: 'Second upload',
          action: 'upload-youtube',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-07-01T12:00',
          publishImmediately: false,
        },
      ]);
    });

    selectFilesForEveryStage();
    cy.get('#pipelineValidationStatus')
      .should('contain.text', 'Second upload')
      .and('contain.text', 'previous upload stage');
    cy.get('#runPipelineBtn').should('be.disabled');

    cy.get('#pipelineSettingsBtn').click();
    cy.get('#pipelineUploadOrderSelect').select('manual');
    cy.get('#confirmPipelineTimezoneBtn').click();

    cy.get('#pipelineTimezoneModal').should('not.be.visible');
    cy.get('#pipelineValidationStatus').should('have.text', '');
    cy.get('#runPipelineBtn').should('not.be.disabled');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('audio-recorder-pipeline-upload-order')).to.equal('manual');
    });
  });

  it('deletes a stage only after confirmation', () => {
    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('.pipeline-stage').should('have.length', 2);

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-stage-delete').should('be.visible').click();
    });

    cy.get('#pipelineDeleteModal').should('be.visible');
    cy.get('#cancelPipelineDeleteBtn').click();
    cy.get('#pipelineDeleteModal').should('not.be.visible');
    cy.get('.pipeline-stage').should('have.length', 2);

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-stage-delete').click();
    });
    cy.get('#confirmPipelineDeleteBtn').click();

    cy.get('#pipelineDeleteModal').should('not.be.visible');
    cy.get('.pipeline-stage').should('have.length', 1);
    cy.window().then((win) => {
      const stages = JSON.parse(win.localStorage.getItem('audio-recorder-pipeline-stages'));
      expect(stages).to.have.length(1);
      expect(stages[0].name).to.equal('Stage 2');
    });
  });

  it('keeps YouTube upload options separate for each stage', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', {
      statusCode: 200,
      headers: { Location: 'https://upload.example/session' },
      body: '',
    }).as('startYouTubeUpload');

    cy.intercept('PUT', 'https://upload.example/session', {
      statusCode: 201,
      body: { id: 'pipeline-video' },
    }).as('finishYouTubeUpload');

    cy.reload();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: Date.now() + 3600 * 1000,
        }));
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('#addPipelineStageBtn').click();

    cy.get('.pipeline-stage').first().contains('button', 'YouTube').click();
    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeTags').clear().type('stage one');
    cy.get('#youtubeShort').check();
    cy.get('#submitYouTubeUploadBtn').click();
    cy.wait('@startYouTubeUpload');
    cy.wait('@finishYouTubeUpload');
    cy.get('#closeYouTubeUploadBtn').click();

    cy.get('.pipeline-stage').eq(1).contains('button', 'YouTube').click();
    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeTags').should('have.value', 'audio, visualizer');
    cy.get('#youtubeShort').should('not.be.checked');
    cy.get('#youtubeTags').clear().type('stage two');
    cy.get('#submitYouTubeUploadBtn').click();
    cy.wait('@startYouTubeUpload');
    cy.wait('@finishYouTubeUpload');
    cy.get('#closeYouTubeUploadBtn').click();

    cy.get('.pipeline-stage').first().contains('button', 'YouTube').click();
    cy.get('#youtubeTags').should('have.value', 'stage one');
    cy.get('#youtubeShort').should('be.checked');
  });

  it('turns selected album files into ordered editable tracks', () => {
    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-file-input').selectFile([
      {
        contents: Cypress.Buffer.from('album-one'),
        fileName: '01 first song.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        contents: Cypress.Buffer.from('album-two'),
        fileName: '02_second_song.wav',
        mimeType: 'audio/wav',
      },
      {
        contents: Cypress.Buffer.from('album-three'),
        fileName: '03-third-song.flac',
        mimeType: 'audio/flac',
      },
    ], { force: true });

    cy.get('.pipeline-stage').eq(1).find('.pipeline-album-track').should('have.length', 3);
    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-title').eq(0).should('have.value', '01 first song');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-title').eq(1).should('have.value', '02 second song');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-title').eq(2).should('have.value', '03 third song');

    cy.get('.pipeline-stage').eq(1).find('.pipeline-add-track-input').selectFile({
      contents: Cypress.Buffer.from('album-four'),
      fileName: '04 bonus take.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.get('.pipeline-stage').eq(1).find('.pipeline-album-track').should('have.length', 4);
    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-title').eq(3).should('have.value', '04 bonus take');
  });

  it('resets added files from a stage without opening the full reset modal', () => {
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-audio'),
      fileName: 'reset-me.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-file-btn').should('contain.text', 'reset-me.mp3');
      cy.get('.pipeline-reset-files-btn').should('not.be.disabled').click();
      cy.get('.pipeline-file-btn').should('contain.text', 'УКАЖИТЕ ФАЙЛ/ФАЙЛЫ');
    });
  });

  it('labels pipeline YouTube checkboxes and generated controls with tooltips', () => {
    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-file-btn')
        .should('have.attr', 'data-tooltip')
        .and('contain', 'Select one or more source files');
      cy.get('.pipeline-field[data-tooltip]').should('have.length.greaterThan', 8);
      cy.get('.pipeline-youtube-details .pipeline-inline-check[data-tooltip]').should('have.length', 4);
      cy.get('.pipeline-youtube-details .pipeline-inline-check').eq(0)
        .should('contain.text', 'Short (#shorts)')
        .find('input[type="checkbox"]')
        .should('have.attr', 'aria-label', 'Mark this pipeline video as a YouTube Short');
      cy.get('.pipeline-youtube-details .pipeline-inline-check').eq(1).should('contain.text', 'Made for kids');
      cy.get('.pipeline-youtube-details .pipeline-inline-check').eq(2).should('contain.text', 'Synthetic media');
      cy.get('.pipeline-youtube-details .pipeline-inline-check').eq(3).should('contain.text', 'Notify subscribers');
    });
  });

  it('runs visualization-only stages through the converter', () => {
    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').clear().type('Rendered stage');
    cy.get('.pipeline-stage').first().find('select').first().select('visualize-only');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-audio'),
      fileName: 'render-me.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.window().then((win) => {
      cy.stub(win.AudioRecorderApp.converter, 'convertWithFallback').resolves({
        blob: new win.Blob(['rendered-video'], { type: 'video/webm' }),
        format: 'webm',
        usedFallback: false,
      }).as('pipelineConvert');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@pipelineConvert').should('have.been.calledOnce');
    cy.get('#recordingsList').should('contain.text', 'render-me.webm');
    cy.get('#status').should('contain.text', 'Pipeline complete: 1 task finished');
    cy.get('#resetPipelineFieldsBtn').should('be.visible');
  });

  it('uploads direct YouTube stages with stage metadata when already signed in', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer stored-token');
      expect(String(req.query.notifySubscribers)).to.equal('true');
      expect(body.snippet.title).to.equal('Direct upload stage');
      expect(body.snippet.description).to.equal('Pipeline description');
      expect(body.snippet.tags).to.deep.equal(['pipeline', 'direct']);
      expect(body.status.privacyStatus).to.equal('private');
      expect(body.status.selfDeclaredMadeForKids).to.equal(true);
      expect(body.status.containsSyntheticMedia).to.equal(true);

      req.reply({
        statusCode: 200,
        headers: { Location: 'https://upload.example/pipeline-session' },
        body: '',
      });
    }).as('startPipelineUpload');

    cy.intercept('PUT', 'https://upload.example/pipeline-session', {
      statusCode: 201,
      body: { id: 'pipeline-video-id' },
    }).as('finishPipelineUpload');

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer stored-token');
      expect(body).to.deep.equal({
        snippet: {
          playlistId: 'PL-stage',
          resourceId: {
            kind: 'youtube#video',
            videoId: 'pipeline-video-id',
          },
        },
      });

      req.reply({
        statusCode: 200,
        body: { id: 'playlist-item-id' },
      });
    }).as('addPipelinePlaylistItem');

    cy.reload();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: Date.now() + 3600 * 1000,
          tokenScope: combinedYouTubeScope,
        }));
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').clear().type('Direct upload stage');
    cy.get('.pipeline-stage').first().find('select').first().select('upload-youtube');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-description').type('Pipeline description');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-tags').clear().type('pipeline, direct');
    cy.get('.pipeline-stage').first().find('.youtube-playlist-create input').type('PL-stage');
    cy.get('.pipeline-stage').first().find('.youtube-playlist-create button').click();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-playlist-ids').should('have.value', 'PL-stage');
    cy.get('.pipeline-stage').first().find('.pipeline-youtube-details .pipeline-inline-check').eq(1).find('input').check();
    cy.get('.pipeline-stage').first().find('.pipeline-youtube-details .pipeline-inline-check').eq(2).find('input').check();
    cy.get('.pipeline-stage').first().find('.pipeline-youtube-details .pipeline-inline-check').eq(3).find('input').check();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-video'),
      fileName: 'direct-video.webm',
      mimeType: 'video/webm',
    }, { force: true });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    cy.wait('@startPipelineUpload');
    cy.wait('@finishPipelineUpload');
    cy.wait('@addPipelinePlaylistItem');
    cy.get('#status').should('contain.text', 'Pipeline complete: 1 task finished');
    cy.get('#pipelineReportModal').should('be.visible');
    cy.get('#pipelineReportList li').should('have.length', 1)
      .and('contain.text', '1.')
      .and('contain.text', 'Direct upload stage')
      .and('contain.text', 'Publish date:')
      .and('contain.text', 'PL-stage');
    cy.get('#pipelineReportList a')
      .should('have.attr', 'href', 'https://www.youtube.com/watch?v=pipeline-video-id');
  });

  it('keeps generated tooltip boxes inside the viewport', () => {
    cy.viewport(360, 640);
    cy.get('.pipeline-stage').first().find('.pipeline-file-btn').trigger('mouseover');
    cy.get('.pipeline-stage').first().find('.pipeline-file-btn').then(($button) => {
      const tooltipStyle = getComputedStyle($button[0], '::before');
      expect(tooltipStyle.whiteSpace).to.equal('normal');
      expect(parseFloat(tooltipStyle.maxWidth)).to.be.lessThan(360);
    });
  });
});
