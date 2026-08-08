describe('Pipeline Mode', () => {
  const verticalPreviewBackground = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 192"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" x2="1" y1="0" y2="1"%3E%3Cstop stop-color="%2307202f"/%3E%3Cstop offset="1" stop-color="%230abf53"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="108" height="192" fill="url(%23g)"/%3E%3Ccircle cx="54" cy="78" r="31" fill="%23ffffff" fill-opacity=".18"/%3E%3C/svg%3E';
  const landscapePreviewBackground = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 108"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" x2="1" y1="1" y2="0"%3E%3Cstop stop-color="%23120427"/%3E%3Cstop offset="1" stop-color="%23ff5a5a"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="192" height="108" fill="url(%23g)"/%3E%3Cpath d="M0 77 C44 42 82 102 126 56 S180 47 192 36" stroke="%23ffdd57" stroke-width="7" fill="none" stroke-linecap="round"/%3E%3C/svg%3E';
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQgwMABKbgQG6gz8ZAAAAABJRU5ErkJggg==';
  const savedVisualizationPresets = [
    {
      id: 'preset-cypress-bars',
      name: 'Cypress Bars',
      settings: {
        visualizer: 'bars',
        primaryColor: '#00ff88',
        secondaryColor: '#00d4ff',
        backgroundColor: '#071923',
        backgroundImage: verticalPreviewBackground,
        backgroundSizeMode: 'cover',
      },
    },
    {
      id: 'preset-cypress-waveform',
      name: 'Cypress Waveform',
      settings: {
        visualizer: 'waveform',
        primaryColor: '#ffdd57',
        secondaryColor: '#ff5a5a',
        backgroundColor: '#120427',
        backgroundImage: landscapePreviewBackground,
        backgroundSizeMode: 'cover',
      },
    },
    {
      id: 'preset-cypress-offset-circular',
      name: 'Cypress Offset Circular',
      settings: {
        visualizer: 'circular',
        primaryColor: '#ffffff',
        secondaryColor: '#ffffff',
        backgroundColor: '#000000',
        offsetX: 480,
        offsetY: -180,
        visualizationScale: 120,
      },
    },
  ];

  const combinedYouTubeScope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ].join(' ');

  function expectPreviewContainsBrightCenter(previewImage) {
    const dataUrl = previewImage.match(/url\("([^"]+)"\)/)[1];
    return cy.window().then((win) => new Cypress.Promise((resolve, reject) => {
      const image = new win.Image();
      image.onload = () => {
        const canvas = win.document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const center = ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height * 0.42), 1, 1).data;

        expect(center[0] + center[1] + center[2], 'background image center brightness').to.be.greaterThan(120);
        resolve();
      };
      image.onerror = reject;
      image.src = dataUrl;
    }));
  }

  function expectPreviewBrightSpotNear(previewImage, expectedXRatio, expectedYRatio) {
    const dataUrl = previewImage.match(/url\("([^"]+)"\)/)[1];
    return cy.window().then((win) => new Cypress.Promise((resolve, reject) => {
      const image = new win.Image();
      image.onload = () => {
        const canvas = win.document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        let totalBrightness = 0;
        let weightedX = 0;
        let weightedY = 0;

        for (let y = 0; y < image.height; y += 1) {
          for (let x = 0; x < image.width; x += 1) {
            const index = (y * image.width + x) * 4;
            const brightness = Math.max(0, data[index] + data[index + 1] + data[index + 2] - 72);
            if (brightness > 0) {
              totalBrightness += brightness;
              weightedX += x * brightness;
              weightedY += y * brightness;
            }
          }
        }

        expect(totalBrightness, 'decoded preview brightness').to.be.greaterThan(1000);
        const centerXRatio = weightedX / totalBrightness / image.width;
        const centerYRatio = weightedY / totalBrightness / image.height;
        expect(centerXRatio, 'preview visual x center').to.be.closeTo(expectedXRatio, 0.08);
        expect(centerYRatio, 'preview visual y center').to.be.closeTo(expectedYRatio, 0.08);
        resolve();
      };
      image.onerror = reject;
      image.src = dataUrl;
    }));
  }

  function expectPreviewImageDimensions(previewImage, expectedWidth, expectedHeight) {
    const dataUrl = previewImage.match(/url\("([^"]+)"\)/)[1];
    return cy.window().then((win) => new Cypress.Promise((resolve, reject) => {
      const image = new win.Image();
      image.onload = () => {
        expect(image.width, 'decoded preview width').to.equal(expectedWidth);
        expect(image.height, 'decoded preview height').to.equal(expectedHeight);
        resolve();
      };
      image.onerror = reject;
      image.src = dataUrl;
    }));
  }

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

  function seedPresetFolder(win) {
    win.localStorage.setItem('audio-recorder-presets', JSON.stringify([]));
    win.localStorage.setItem('audio-recorder-preset-options', JSON.stringify({
      savePath: '/cypress/presets',
      skipDialog: false,
    }));
    win.electronAPI = {
      loadPresetFiles() {
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            success: true,
            presets: [
              {
                id: 'folder-preset',
                name: 'Folder Saved Preset',
                settings: {
                  visualizer: 'bars',
                  primaryColor: '#0abf53',
                },
              },
            ],
          }), 25);
        });
      },
    };
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/playlists*', {
      statusCode: 200,
      body: { items: [] },
    });
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

  it('restores selected pipeline files after reload so the pipeline can run', () => {
    selectFilesForEveryStage();
    cy.get('#runPipelineBtn').should('not.be.disabled');
    cy.get('.pipeline-file-btn').first().should('contain.text', 'track-1.mp3');

    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-file-btn').first().should('contain.text', 'track-1.mp3');
    cy.get('#pipelineValidationStatus').should('have.text', '');
    cy.get('#runPipelineBtn').should('not.be.disabled');
  });

  it('shows a fixed numbered stage navigator that scrolls to pipeline stages without narrowing cards', () => {
    cy.get('#pipelineStageNav')
      .should('have.class', 'is-open')
      .and('have.css', 'position', 'fixed')
      .and('have.css', 'pointer-events', 'auto');
    cy.get('#pipelineStageNav').parent().should('match', 'body');
    cy.get('#pipelineStageNav').then(($nav) => {
      const rect = $nav[0].getBoundingClientRect();
      const bottomOffset = parseFloat(getComputedStyle($nav[0]).bottom);
      expect(rect.height).to.be.lessThan(260);
      expect(rect.bottom).to.be.closeTo(Cypress.config('viewportHeight') - bottomOffset, 4);
    });
    cy.get('#pipelineStageNav').then(($nav) => {
      cy.get('#pipelineSidebar').then(($sidebar) => {
        const navRect = $nav[0].getBoundingClientRect();
        const sidebarRect = $sidebar[0].getBoundingClientRect();
        expect(navRect.right).to.be.lessThan(sidebarRect.left + 1);
        expect(sidebarRect.left - navRect.right).to.be.lessThan(72);
      });
    });
    cy.get('.pipeline-workspace').then(($workspace) => {
      expect($workspace.css('display')).to.eq('block');
    });
    cy.get('.pipeline-stage').first().then(($stage) => {
      expect($stage[0].getBoundingClientRect().width).to.be.greaterThan(900);
    });
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').should('have.length', 3);
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(0)
      .should('contain.text', '1')
      .and('contain.text', 'Pre-save short')
      .and('contain.text', 'Visualization + update')
      .invoke('text')
      .should('match', /\d{4}-\d{2}-\d{2}/)
      .and('match', /\(-\d+[dhm]( \d+[hm])*\)/);
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(1)
      .should('contain.text', 'Release')
      .and('contain.text', 'Visualization + update')
      .invoke('text')
      .should('match', /\d{4}-\d{2}-\d{2}/);
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(1).find('.pipeline-stage-nav-meta').then(($meta) => {
      const meta = $meta[0];
      expect(meta.scrollWidth).to.be.at.most(meta.clientWidth + 1);
    });

    cy.get('.pipeline-stage').eq(2).then(($stage) => {
      const stageId = $stage.attr('data-stage-id');
      cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(2).click();
      cy.get(`#pipelineStageNav .pipeline-stage-nav-btn[data-stage-id="${stageId}"]`)
        .should('have.class', 'is-active')
        .and('have.attr', 'aria-current', 'step');
      cy.get('.canvas-container').then(($canvas) => {
        const stickyBottom = $canvas[0].getBoundingClientRect().bottom;
        cy.get(`.pipeline-stage[data-stage-id="${stageId}"]`).then(($target) => {
          const stageTop = $target[0].getBoundingClientRect().top;
          expect(stageTop).to.be.at.least(stickyBottom - 2);
          expect(stageTop).to.be.lessThan(stickyBottom + 48);
        });
      });
    });

    cy.get('.pipeline-stage').eq(2).find('.pipeline-inline-check input[aria-label="Publish this pipeline stage immediately"]').check();
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(2).should('contain.text', 'Immediately');

    cy.get('#addPipelineStageBtn').click();
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').should('have.length', 4);
    cy.get('#clearPipelineBtn').click();
    cy.get('#pipelineStageNav').should('not.be.visible');
  });

  it('keeps the stage navigator fixed at the bottom of the viewport on narrow screens', () => {
    cy.viewport(820, 720);
    cy.get('#pipelineStageNav')
      .should('have.class', 'is-open')
      .and('have.css', 'position', 'fixed');
    cy.get('#pipelineStageNav').parent().should('match', 'body');
    cy.get('#pipelineStageNav').then(($nav) => {
      const rect = $nav[0].getBoundingClientRect();
      const styles = getComputedStyle($nav[0]);
      const bottomOffset = parseFloat(styles.bottom);
      const leftOffset = parseFloat(styles.left);
      const rightOffset = parseFloat(styles.right);
      expect(rect.bottom).to.be.closeTo(720 - bottomOffset, 4);
      expect(rect.left).to.be.greaterThan(leftOffset - 4);
      expect(rect.right).to.be.closeTo(820 - rightOffset, 4);
    });

    cy.scrollTo('bottom');
    cy.get('#pipelineStageNav').then(($nav) => {
      const rect = $nav[0].getBoundingClientRect();
      const bottomOffset = parseFloat(getComputedStyle($nav[0]).bottom);
      expect(rect.bottom).to.be.closeTo(720 - bottomOffset, 4);
    });
  });

  it('opens stage rename and delete actions from the stage navigator context menu', () => {
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(1).rightclick();
    cy.get('#pipelineStageContextMenu')
      .should('have.class', 'active')
      .and('have.attr', 'aria-hidden', 'false');

    cy.get('#pipelineStageRenameBtn').click();
    cy.get('#pipelineStageContextMenu').should('not.have.class', 'active');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-name')
      .should('be.focused')
      .clear()
      .type('Renamed from nav');
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(1)
      .should('contain.text', 'Renamed from nav');

    cy.get('#pipelineStageNav .pipeline-stage-nav-btn').eq(1).rightclick();
    cy.get('#pipelineStageDeleteBtn').click();
    cy.get('#pipelineDeleteModal').should('be.visible');
    cy.get('#pipelineDeleteMessage').should('contain.text', 'Renamed from nav');
    cy.get('#confirmPipelineDeleteBtn').click();

    cy.get('.pipeline-stage').should('have.length', 2);
    cy.get('#pipelineStageNav .pipeline-stage-nav-btn')
      .should('have.length', 2)
      .and('not.contain.text', 'Renamed from nav');
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
        expect(labels).to.deep.equal(['Cypress Bars', 'Cypress Waveform', 'Cypress Offset Circular']);
        expect(values).to.deep.equal([
          'preset:preset-cypress-bars',
          'preset:preset-cypress-waveform',
          'preset:preset-cypress-offset-circular',
        ]);
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

  it('updates pipeline preset choices when the sidebar loads saved presets after startup', () => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html', { onBeforeLoad: seedPresetFolder });
    cy.waitForVisualization();

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetList .preset-load-btn', { timeout: 10000 })
      .should('contain.text', 'Folder Saved Preset');

    cy.contains('.tab', 'Pipeline').click();
    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'Folder Saved Preset')
        .and('have.value', 'preset:folder-preset');
    });
  });

  it('updates pipeline preset choices immediately after saving a new preset', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('audio-recorder-presets');
      win.localStorage.removeItem('audio-recorder-pipeline-stages');
    });
    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').as('firstStageName');
    cy.get('@firstStageName').clear().type('Unsaved pipeline title');
    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'No saved visualization presets')
        .and('have.value', '');
    });

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#savePresetBtn').click();
    cy.get('#presetNameInput').clear().type('Pipeline Fresh Preset');
    cy.get('#presetConfirmSaveBtn').click();

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'Pipeline Fresh Preset')
        .invoke('val')
        .should('match', /^preset:preset-/);
    });
    cy.get('@firstStageName').should('have.value', 'Unsaved pipeline title');
  });

  it('updates pipeline preset choices when preset persistence fails but the in-memory preset is saved', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('audio-recorder-presets');
      win.localStorage.removeItem('audio-recorder-pipeline-stages');
    });
    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'No saved visualization presets')
        .and('have.value', '');
    });

    cy.window().then((win) => {
      const originalSetItem = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === 'audio-recorder-presets') {
          throw new Error('Quota exceeded');
        }
        return originalSetItem.call(this, key, value);
      });
    });

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#savePresetBtn').click();
    cy.get('#presetNameInput').clear().type('Pipeline Memory Preset');
    cy.get('#presetConfirmSaveBtn').click();

    cy.get('#presetList .preset-load-btn').should('contain.text', 'Pipeline Memory Preset');
    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Preset').find('select')
        .should('contain.text', 'Pipeline Memory Preset')
        .invoke('val')
        .should('match', /^preset:preset-/);
    });
  });

  it('shows image-backed visualization previews for vertical stages and landscape album tracks', () => {
    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          kind: 'custom',
          name: 'Vertical preview',
          action: 'visualize-upload',
          resolution: '1080x1920',
          presetId: 'preset:preset-cypress-bars',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-01T12:00',
        },
        {
          kind: 'release',
          name: 'Landscape album preview',
          action: 'visualize-upload',
          resolution: '1920x1080',
          presetId: 'preset:preset-cypress-waveform',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-02T12:00',
          releaseType: 'album',
          tracks: [
            { id: 'track-landscape-one', title: 'Landscape track' },
          ],
        },
      ]);
    });

    let verticalPreviewImage = '';
    cy.get('.pipeline-stage').eq(0).find('.pipeline-stage-number.pipeline-preview-trigger')
      .should('have.attr', 'data-tooltip')
      .and('contain', 'Stage 1 preview: 1080x1920, Cypress Bars');
    cy.get('.pipeline-stage').eq(0).find('.pipeline-stage-number.pipeline-preview-trigger')
      .should('have.attr', 'data-preview-state', 'ready')
      .should(($trigger) => {
        const style = $trigger[0].style;
        const previewImage = style.getPropertyValue('--pipeline-preview-image');
        expect(style.getPropertyValue('--pipeline-preview-aspect')).to.equal('1080 / 1920');
        expect(previewImage).to.match(/^url\("data:image\/png;base64,/);
        verticalPreviewImage = previewImage;
      })
      .then(() => expectPreviewContainsBrightCenter(verticalPreviewImage));

    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-handle.pipeline-preview-trigger').first()
      .should('have.attr', 'data-tooltip')
      .and('contain', 'Track 1 preview: 1920x1080, Cypress Waveform');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-track-handle.pipeline-preview-trigger').first()
      .should('have.attr', 'data-preview-state', 'ready')
      .should(($trigger) => {
        const style = $trigger[0].style;
        const previewImage = style.getPropertyValue('--pipeline-preview-image');
        expect(style.getPropertyValue('--pipeline-preview-aspect')).to.equal('1920 / 1080');
        expect(previewImage).to.match(/^url\("data:image\/png;base64,/);
        expect(previewImage).to.not.equal(verticalPreviewImage);
      })
      .then(($trigger) => {
        expectPreviewContainsBrightCenter($trigger[0].style.getPropertyValue('--pipeline-preview-image'));
      });
  });

  it('applies preset visualization offsets to generated tooltip previews', () => {
    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          kind: 'custom',
          name: 'Offset tooltip preview',
          action: 'visualize-upload',
          resolution: '1920x1080',
          presetId: 'preset:preset-cypress-offset-circular',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-01T12:00',
        },
      ]);
    });

    cy.get('.pipeline-stage').eq(0).find('.pipeline-stage-number.pipeline-preview-trigger')
      .should('have.attr', 'data-preview-state', 'ready')
      .then(($trigger) => {
        const previewImage = $trigger[0].style.getPropertyValue('--pipeline-preview-image');
        expectPreviewBrightSpotNear(previewImage, 0.63, 0.39);
        expectPreviewImageDimensions(previewImage, 360, 203);
      });
  });

  it('shows fetched YouTube playlists in pipeline stages and creates playlists by name', () => {
    cy.clearLocalStorage();
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/playlists*', {
      statusCode: 200,
      body: {
        items: [
          {
            id: 'PL-existing',
            snippet: { title: 'Existing playlist' },
            contentDetails: { itemCount: 3 },
          },
        ],
      },
    }).as('listPipelinePlaylists');
    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlists*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer stored-token');
      expect(body.snippet.title).to.equal('Pipeline created playlist');
      expect(body.status.privacyStatus).to.equal('private');

      req.reply({
        statusCode: 200,
        body: {
          id: 'PL-created',
          snippet: { title: 'Pipeline created playlist', description: '' },
        },
      });
    }).as('createPipelineStagePlaylist');

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
    cy.wait('@listPipelinePlaylists');
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('.youtube-playlist-option', 'Existing playlist').find('input').check();
      cy.get('.pipeline-stage-playlist-ids').should('have.value', 'PL-existing');
      cy.get('.youtube-playlist-create input').type('Pipeline created playlist');
      cy.get('.youtube-playlist-create button').click();
    });
    cy.wait('@createPipelineStagePlaylist');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-playlist-ids')
      .should('have.value', 'PL-existing, PL-created');
    cy.get('.pipeline-stage').first()
      .contains('.youtube-playlist-option', 'Pipeline created playlist')
      .find('input')
      .should('be.checked');
  });

  it('replaces stale cached YouTube playlists in pipeline stages after restart', () => {
    cy.clearLocalStorage();
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/playlists*', {
      statusCode: 200,
      body: {
        items: [
          {
            id: 'PL-current',
            snippet: { title: 'Current pipeline playlist' },
            contentDetails: { itemCount: 5 },
          },
        ],
      },
    }).as('refreshPipelinePlaylists');

    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: Date.now() + 3600 * 1000,
          tokenScope: combinedYouTubeScope,
        }));
        win.localStorage.setItem('audio-recorder-youtube-playlists', JSON.stringify([
          { id: 'PL-stale', title: 'Stale pipeline playlist' },
        ]));
      },
    });
    cy.waitForVisualization();
    cy.wait('@refreshPipelinePlaylists');
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.youtube-playlist-option').should('contain.text', 'Current pipeline playlist');
      cy.contains('.youtube-playlist-option', 'Stale pipeline playlist').should('not.exist');
    });
  });

  it('creates a pipeline playlist after YouTube helpers become available post-render', () => {
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.window().then((win) => {
      const youtube = win.AudioRecorderYouTube;
      delete win.AudioRecorderYouTube;
      win.AudioRecorderPipeline.replaceStages([
        {
          name: 'Late YouTube helper',
          action: 'upload-youtube',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-07-02T12:00',
          playlistIds: '',
        },
      ]);
      win.AudioRecorderYouTube = {
        ...youtube,
        createPlaylist: cy.stub().as('createLatePipelinePlaylist').resolves({
          id: 'PL-late-created',
          title: 'Late created playlist',
        }),
      };
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.youtube-playlist-create input').type('Late created playlist');
      cy.get('.youtube-playlist-create button').should('not.be.disabled').click();
      cy.get('.pipeline-stage-playlist-ids').should('have.value', 'PL-late-created');
    });
    cy.get('@createLatePipelinePlaylist').should('have.been.calledWith', 'Late created playlist');
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

  it('keeps upload review enabled by default and can disable it from settings', () => {
    cy.get('#pipelineSettingsBtn').click();
    cy.get('#pipelineReviewBeforeUpload').should('be.checked').uncheck();
    cy.get('#confirmPipelineTimezoneBtn').click();

    cy.window().then((win) => {
      expect(win.localStorage.getItem('audio-recorder-pipeline-review-before-upload')).to.equal('false');
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

  it('shows release type controls on stages added after clearing the pipeline', () => {
    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();

    cy.get('.pipeline-stage').should('have.length', 1);
    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-stage-name').should('have.value', 'Stage 1');
      cy.contains('label', 'Release type').find('select')
        .should('have.class', 'pipeline-release-type')
        .and('have.value', 'album');
      cy.get('.pipeline-full-album-video')
        .should('exist')
        .and('not.be.checked');
    });
  });

  it('uses signed-in YouTube channel default tags for newly added stages', () => {
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/channels*', {
      statusCode: 200,
      body: {
        items: [
          {
            brandingSettings: {
              channel: {
                keywords: 'ambient "visual album" cypress ambient',
              },
            },
          },
        ],
      },
    }).as('loadYouTubeChannelDefaults');

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
    cy.wait('@loadYouTubeChannelDefaults');
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();

    cy.get('.pipeline-stage').should('have.length', 1);
    cy.get('.pipeline-stage').first().find('.pipeline-stage-tags')
      .should('have.value', 'ambient, visual album, cypress');
    cy.get('.pipeline-stage').first().contains('button', 'YouTube').click();
    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeTags').should('have.value', 'ambient, visual album, cypress');
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
        win.__pipelineTestDurations = {
          'track-one.mp3': 75,
          'track-two.mp3': 145,
        };
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

  it('adds full album as the last upload item in combined release mode', () => {
    const publishAtValues = [];
    const uploadTitles = [];
    let uploadIndex = 0;

    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      uploadIndex += 1;
      publishAtValues.push(body.status.publishAt);
      uploadTitles.push(body.snippet.title);

      req.reply({
        statusCode: 200,
        headers: { Location: `https://upload.example/combined-release-${uploadIndex}` },
        body: '',
      });
    }).as('startCombinedReleaseUpload');

    cy.intercept('PUT', /^https:\/\/upload\.example\/combined-release-\d+$/, (req) => {
      req.reply({
        statusCode: 201,
        body: { id: `combined-release-${uploadIndex}` },
      });
    }).as('finishCombinedReleaseUpload');
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

    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          kind: 'release',
          name: 'Combined release',
          action: 'upload-youtube',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-07-01T08:00',
          publishImmediately: false,
          releaseType: 'album-with-full',
          privacyStatus: 'private',
        },
      ]);
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Release type').find('select')
        .should('contain.text', 'One track one video + full album')
        .and('have.value', 'album-with-full');
      cy.get('.pipeline-stage-file-input').selectFile([
        {
          contents: Cypress.Buffer.from('combined-one'),
          fileName: '01 first track.mp4',
          mimeType: 'video/mp4',
        },
        {
          contents: Cypress.Buffer.from('combined-two'),
          fileName: '02 second track.mp4',
          mimeType: 'video/mp4',
        },
      ], { force: true });
    });

    cy.window().then((win) => {
      cy.stub(win.AudioRecorderApp.converter, 'concatenateVideosWithFallback')
        .callsFake(({ videoSources, onProgress }) => {
          onProgress?.(0.5);
          onProgress?.(1);
          return Promise.resolve({
            blob: new win.Blob(['combined-upload-video'], { type: 'video/webm' }),
            format: 'webm',
            usedFallback: false,
            sourceCount: videoSources.length,
          });
        })
        .as('combinedReleaseStitch');
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-album-track').should('have.length', 3);
      cy.get('.pipeline-album-track').eq(0).find('.pipeline-track-title')
        .should('have.value', '01 first track');
      cy.get('.pipeline-album-track').eq(1).find('.pipeline-track-title')
        .should('have.value', '02 second track');
      cy.get('.pipeline-album-track').eq(2)
        .should('have.class', 'pipeline-full-album-track')
        .find('.pipeline-track-title')
        .should('have.value', 'Combined release (full album)')
        .and('be.disabled');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    for (let index = 0; index < 3; index += 1) {
      cy.wait('@startCombinedReleaseUpload');
      cy.wait('@finishCombinedReleaseUpload');
    }

    cy.get('@combinedReleaseStitch').should('have.been.calledOnce');
    cy.get('@combinedReleaseStitch').then((stitch) => {
      expect(stitch.firstCall.args[0].videoSources).to.have.length(2);
    });

    cy.wrap(uploadTitles).should('deep.equal', [
      '01 first track',
      '02 second track',
      'Combined release (full album)',
    ]);
    cy.wrap(publishAtValues).should('deep.equal', [
      '2026-07-01T08:00:00.000Z',
      '2026-07-01T08:01:00.000Z',
      '2026-07-01T08:02:00.000Z',
    ]);
  });

  it('adds a dependent full album stage with its own schedule and generated timestamps', () => {
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
    cy.get('#pipelineSettingsBtn').click();
    cy.get('#pipelineReviewBeforeUpload').uncheck();
    cy.get('#confirmPipelineTimezoneBtn').click();

    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-name').clear().type('Album premiere');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-description').type('Album release description');
    cy.get('.pipeline-stage').eq(0).find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('pre-save'),
      fileName: 'pre-save.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });
    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-file-input').selectFile([
      {
        contents: Cypress.Buffer.from('track-one'),
        fileName: 'track-one.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        contents: Cypress.Buffer.from('track-two'),
        fileName: 'track-two.mp3',
        mimeType: 'audio/mpeg',
      },
    ], { force: true });
    cy.get('.pipeline-stage').eq(1).find('.pipeline-album-track').should('have.length', 2);
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').find('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(tinyPngBase64, 'base64'),
      fileName: 'album-cover.png',
      mimeType: 'image/png',
    }, { force: true });
    cy.get('.pipeline-stage').eq(1).find('.pipeline-file-btn')
      .should('have.attr', 'data-preview-state', 'ready')
      .and('have.attr', 'data-tooltip')
      .and('contain', 'album-cover.png preview');
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').should(($label) => {
      expect($label).to.have.attr('data-preview-state', 'ready');
      expect($label.attr('data-preview-src')).to.match(/^data:image\/png;base64,/);
      expect($label).to.have.class('pipeline-preview-trigger');
      expect($label.attr('aria-label')).to.contain('album-cover.png preview');
    });
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').trigger('pointerover');
    cy.get('#pipelinePreviewTooltip').should(($tooltip) => {
      expect($tooltip).to.have.class('is-visible');
      expect($tooltip).to.have.attr('aria-hidden', 'false');
      expect($tooltip.attr('data-preview-src')).to.match(/^data:image\/png;base64,/);
      const previewImage = $tooltip[0].style.getPropertyValue('--pipeline-preview-image');
      expect(previewImage).to.match(/^url\("data:image\/png;base64,/);
    });
    cy.get('#pipelinePreviewTooltip .pipeline-preview-tooltip-image')
      .should('have.attr', 'src')
      .then(src => {
        expect(src).to.include(`data:image/png;base64,${tinyPngBase64}`);
      });
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').trigger('pointerout');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-full-album-video')
      .should('not.be.checked')
      .check();
    cy.get('.pipeline-stage').should('have.length', 4);
    cy.window().then((win) => {
      const albumStageId = win.AudioRecorderPipeline.getStages()[1].id;
      win.AudioRecorderPipeline.setStageFileDurationsForDebug(albumStageId, [75, 145]);
      expect(win.AudioRecorderPipeline.getStageFileDurationsForDebug(albumStageId)).to.deep.equal([75, 145]);
    });
    cy.get('.pipeline-stage').eq(2).should('have.class', 'pipeline-full-album-stage');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-type')
      .should('have.value', 'album')
      .and('be.disabled');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-fields > .pipeline-field').then(($fields) => {
      const labels = [...$fields].map(field => field.firstElementChild?.textContent.trim());
      expect(labels.indexOf('Type')).to.be.lessThan(labels.indexOf('Action'));
    });
    cy.get('.pipeline-stage').eq(2).find('.pipeline-release-type')
      .should('have.value', 'album')
      .and('be.disabled');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name')
      .should('have.value', 'Album premiere - full album');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-file-btn')
      .should('contain.text', 'track-one.mp3')
      .and('contain.text', 'track-two.mp3')
      .and('not.contain.text', 'УКАЖИТЕ ФАЙЛ/ФАЙЛЫ')
      .and('be.disabled');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-file-names')
      .should('contain.text', '2 selected');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-file-btn')
      .should('have.attr', 'data-preview-state', 'ready')
      .and('have.attr', 'data-tooltip')
      .and('contain', 'album-cover.png preview');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name').clear();
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name').type('Complete album visual');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-description')
      .should('have.value', 'Album release description');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-description').clear();
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-description').type('Complete album description');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-relative-minutes').clear();
    cy.get('.pipeline-stage').eq(2).find('.pipeline-relative-minutes').type('45');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-album-timestamps')
      .should(($timestamps) => {
        expect($timestamps.val()).to.include('00:00 - track one');
        expect($timestamps.val()).to.include('01:15 - track two');
      });
    cy.get('.pipeline-stage').eq(1).find('.pipeline-full-album-video')
      .should('be.checked')
      .uncheck({ force: true });
    cy.window().then((win) => {
      expect(win.AudioRecorderPipeline.getStages().filter(stage => stage.kind === 'fullalbum')).to.have.length(0);
    });
    cy.get('.pipeline-stage').should('have.length', 3);
    cy.get('.pipeline-stage').eq(1).find('.pipeline-full-album-video').should('not.be.checked').check();
    cy.get('.pipeline-stage').should('have.length', 4);
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name').clear().type('Complete album visual');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-description').clear().type('Complete album description');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-relative-minutes').clear().type('45');
    cy.get('.pipeline-stage').eq(3).find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('post-album'),
      fileName: 'post-album.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.window().then((win) => {
      win.__pipelineProgressWidths = [];
      cy.stub(win.AudioRecorderApp.converter, 'convertWithFallback')
        .callsFake(({ audioSource, onProgress }) => {
          onProgress?.(0.5);
          win.__pipelineProgressWidths.push(win.AudioRecorderApp.elements.progressFill.style.width);
          onProgress?.(1);
          return Promise.resolve({
            blob: new win.Blob([audioSource.name], { type: 'video/webm' }),
            format: 'webm',
            usedFallback: false,
          });
        })
        .as('pipelineConvert');
      cy.stub(win.AudioRecorderApp.converter, 'concatenateVideosWithFallback')
        .callsFake(({ videoSources, onProgress }) => {
          onProgress?.(0.5);
          onProgress?.(1);
          return Promise.resolve({
            blob: new win.Blob(['joined-track-videos'], { type: 'video/webm' }),
            format: 'webm',
            usedFallback: false,
            sourceCount: videoSources.length,
          });
        })
        .as('pipelineStitch');
      const uploadTitles = [];
      const uploadDescriptions = [];
      cy.stub(win.AudioRecorderYouTube, 'uploadDirect')
        .callsFake(({ video, metadata }) => {
          uploadTitles.push(metadata.title);
          uploadDescriptions.push(metadata.description);
          expect(video.type).to.equal('video/webm');
          return Promise.resolve({
            id: 'album-video-id',
            url: 'https://www.youtube.com/watch?v=album-video-id',
          });
        })
        .as('pipelineUpload');
      cy.wrap(uploadTitles).as('pipelineUploadTitles');
      cy.wrap(uploadDescriptions).as('pipelineUploadDescriptions');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@pipelineConvert').should('have.callCount', 4);
    cy.get('@pipelineStitch').should('have.been.calledOnce');
    cy.get('@pipelineUpload').should('have.callCount', 5);
    cy.get('@pipelineConvert').then((convert) => {
      const convertedNames = convert.getCalls().map(call => call.args[0].audioSource.name);
      expect(convertedNames).to.deep.equal([
        'pre-save.mp3',
        'track-one.mp3',
        'track-two.mp3',
        'post-album.mp3',
      ]);
    });
    cy.get('@pipelineUpload').then((upload) => {
      const fullAlbumUpload = upload.getCalls().find(call => call.args[0].metadata.title === 'Complete album visual');
      expect(fullAlbumUpload.args[0].video).to.have.property('size', 'joined-track-videos'.length);
      expect(fullAlbumUpload.args[0].thumbnail).to.have.property('name', 'album-cover.png');
    });
    cy.window().its('__pipelineProgressWidths').should((widths) => {
      expect(widths.some(width => parseFloat(width) > 0)).to.equal(true);
    });
    cy.get('@pipelineUploadTitles').should('include', 'Complete album visual');
    cy.get('@pipelineUploadDescriptions').then((descriptions) => {
      expect(descriptions).to.include('Complete album description\n\n00:00 - track one\n01:15 - track two');
    });
    cy.get('#status').should('contain.text', 'Pipeline complete: 5 tasks finished');
    cy.get('#pipelineReportList li').should('have.length', 5)
      .and('contain.text', 'Complete album visual');

    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
    cy.get('.pipeline-stage').eq(1).find('.pipeline-full-album-video').should('be.checked');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-stage-name').should('have.value', 'Complete album visual');
    cy.get('.pipeline-stage').eq(2).find('.pipeline-relative-minutes').should('have.value', '45');
  });

  it('keeps saved album cover previews after reload and pipeline restore', () => {
    cy.reload();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('.pipeline-stage').eq(1).find('.pipeline-stage-file-input').selectFile([
      {
        contents: Cypress.Buffer.from('track-one'),
        fileName: 'track-one.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        contents: Cypress.Buffer.from('track-two'),
        fileName: 'track-two.mp3',
        mimeType: 'audio/mpeg',
      },
    ], { force: true });
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').find('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(tinyPngBase64, 'base64'),
      fileName: 'album-cover.png',
      mimeType: 'image/png',
    }, { force: true });
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover')
      .should('have.attr', 'data-preview-state', 'ready');
    cy.get('.pipeline-stage').eq(1).find('.pipeline-full-album-video').check();
    cy.window().then((win) => win.AudioRecorderPipeline.saveCurrentPipeline());

    cy.window().then((win) => {
      const pipelines = JSON.parse(win.localStorage.getItem('audio-recorder-pipelines'));
      expect(pipelines).to.have.length(1);
      expect(pipelines[0].stages[1].storedCover).to.include({
        name: 'album-cover.png',
        type: 'image/png',
      });
      expect(pipelines[0].stages[1].storedCover.dataUrl).to.match(/^data:image\/png;base64,/);
    });

    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
    cy.get('#pipelineList .pipeline-load-btn').first().click();

    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover')
      .should('have.attr', 'data-preview-state', 'ready')
      .and('have.attr', 'data-preview-src', `data:image/png;base64,${tinyPngBase64}`)
      .and('have.attr', 'data-tooltip', 'album-cover.png preview');
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').trigger('pointerover', { force: true });
    cy.get('#pipelinePreviewTooltip')
      .should('have.class', 'is-visible')
      .and('have.attr', 'aria-label', 'album-cover.png preview')
      .and('have.attr', 'data-preview-src', `data:image/png;base64,${tinyPngBase64}`)
      .should(($tooltip) => {
        const previewImage = $tooltip[0].style.getPropertyValue('--pipeline-preview-image');
        expect(previewImage).to.include(`data:image/png;base64,${tinyPngBase64}`);
      });
    cy.get('#pipelinePreviewTooltip .pipeline-preview-tooltip-image')
      .should('have.attr', 'src')
      .then(src => {
        expect(src).to.include(`data:image/png;base64,${tinyPngBase64}`);
      });
    cy.get('.pipeline-stage').eq(1).contains('label', 'YouTube cover').trigger('pointerout');

    cy.get('.pipeline-stage').eq(2).find('.pipeline-file-btn')
      .should('have.attr', 'data-preview-state', 'ready')
      .and('have.attr', 'data-tooltip', 'album-cover.png preview')
      .trigger('pointerover', { force: true });
    cy.get('#pipelinePreviewTooltip')
      .should('have.class', 'is-visible')
      .and('have.attr', 'aria-label', 'album-cover.png preview')
      .and('have.attr', 'data-preview-src', `data:image/png;base64,${tinyPngBase64}`)
      .should(($tooltip) => {
        const previewImage = $tooltip[0].style.getPropertyValue('--pipeline-preview-image');
        expect(previewImage).to.include(`data:image/png;base64,${tinyPngBase64}`);
      });
    cy.get('#pipelinePreviewTooltip .pipeline-preview-tooltip-image')
      .should('have.attr', 'src')
      .then(src => {
        expect(src).to.include(`data:image/png;base64,${tinyPngBase64}`);
      });
  });

  it('schedules regular release posts from ordered files and cycle slots', () => {
    const publishAtValues = [];
    const uploadTitles = [];
    let uploadIndex = 0;

    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      publishAtValues.push(body.status.publishAt);
      uploadTitles.push(body.snippet.title);
      uploadIndex += 1;

      req.reply({
        statusCode: 200,
        headers: { Location: `https://upload.example/regular-post-${uploadIndex}` },
        body: '',
      });
    }).as('startRegularPostUpload');

    cy.intercept('PUT', /^https:\/\/upload\.example\/regular-post-\d+$/, (req) => {
      req.reply({
        statusCode: 201,
        body: { id: `regular-post-${uploadIndex}` },
      });
    }).as('finishRegularPostUpload');

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

    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          kind: 'release',
          name: 'Regular shorts',
          action: 'upload-youtube',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-07-01T08:00',
          publishImmediately: false,
          releaseType: 'regular-posts',
          regularCycleDays: 10,
          regularPostSlots: [
            { id: 'slot-day-3', day: 3, time: '09:30' },
            { id: 'slot-day-7', day: 7, time: '18:00' },
          ],
          privacyStatus: 'private',
        },
      ]);
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.contains('label', 'Release type').find('select')
        .should('contain.text', 'Regular posts')
        .and('have.value', 'regular-posts');

      cy.get('.pipeline-stage-file-input').selectFile([
        {
          contents: Cypress.Buffer.from('regular-one'),
          fileName: '01 regular one.mp4',
          mimeType: 'video/mp4',
        },
        {
          contents: Cypress.Buffer.from('regular-two'),
          fileName: '02 regular two.mp4',
          mimeType: 'video/mp4',
        },
        {
          contents: Cypress.Buffer.from('regular-three'),
          fileName: '03 regular three.mp4',
          mimeType: 'video/mp4',
        },
        {
          contents: Cypress.Buffer.from('regular-four'),
          fileName: '04 regular four.mp4',
          mimeType: 'video/mp4',
        },
        {
          contents: Cypress.Buffer.from('regular-five'),
          fileName: '05 regular five.mp4',
          mimeType: 'video/mp4',
        },
      ], { force: true });
    });

    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-regular-slot').should('have.length', 2);
      cy.get('.pipeline-regular-post-track').should('have.length', 5);
      cy.get('.pipeline-regular-post-track .pipeline-track-title').eq(0)
        .should('have.value', '01 regular one');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-01"]').should('have.class', 'is-cycle-active');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-03"]')
        .should('have.class', 'is-publish')
        .and('contain.text', '1');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-07"]')
        .should('have.class', 'is-publish')
        .and('contain.text', '2');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-23"]')
        .should('have.class', 'is-publish')
        .and('contain.text', '5');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-24"]')
        .should('not.have.class', 'is-cycle-active');

      cy.get('.pipeline-regular-post-track .pipeline-track-remove').eq(1).click();
      cy.get('.pipeline-regular-post-track').should('have.length', 4);
      cy.get('.pipeline-regular-post-track .pipeline-track-title').eq(1)
        .should('have.value', '03 regular three');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-23"]')
        .should('not.have.class', 'is-publish');
      cy.get('.pipeline-regular-calendar-day[data-date="2026-07-18"]')
        .should('not.have.class', 'is-cycle-active');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    for (let index = 0; index < 4; index += 1) {
      cy.wait('@startRegularPostUpload');
      cy.wait('@finishRegularPostUpload');
    }

    cy.wrap(publishAtValues).should('deep.equal', [
      '2026-07-03T09:30:00.000Z',
      '2026-07-07T18:00:00.000Z',
      '2026-07-13T09:30:00.000Z',
      '2026-07-17T18:00:00.000Z',
    ]);
    cy.wrap(uploadTitles).should('deep.equal', [
      '01 regular one',
      '03 regular three',
      '04 regular four',
      '05 regular five',
    ]);
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
    cy.get('.pipeline-stage').first().find('.pipeline-stage-description').type('Keep this description');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-tags').clear().type('keep, youtube');
    cy.get('.pipeline-stage').first().find('.pipeline-youtube-details input[type="checkbox"]').first().check();
    cy.get('.pipeline-stage').first().find('select').first().select('visualize-only');
    cy.get('.pipeline-stage').first().within(() => {
      cy.get('.pipeline-stage-description')
        .should('be.disabled')
        .and('have.value', 'Keep this description');
      cy.get('.pipeline-stage-tags')
        .should('be.disabled')
        .and('have.value', 'keep, youtube');
      cy.get('.pipeline-youtube-details input[type="checkbox"]').first()
        .should('be.disabled')
        .and('be.checked');
      cy.get('.youtube-playlist-create input').should('be.disabled');
      cy.get('.youtube-playlist-create button').should('be.disabled');
      cy.contains('button', 'YouTube').should('be.disabled');
    });
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

  it('reviews rendered visualization uploads before YouTube upload and can skip them', () => {
    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          name: 'Review before upload',
          action: 'visualize-upload',
          resolution: '1920x1080',
          presetId: 'preset:preset-cypress-bars',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-01T12:00',
        },
      ]);
    });
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-audio'),
      fileName: 'review-me.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
        accessToken: 'stored-token',
        accessTokenExpiresAt: Date.now() + 3600 * 1000,
        tokenScope: combinedYouTubeScope,
      }));
      cy.stub(win.AudioRecorderYouTube, 'hasValidAccessToken').returns(true);
      cy.stub(win.AudioRecorderYouTube, 'uploadDirect').as('pipelineUploadDirect').resolves({
        id: 'should-not-upload',
      });
      cy.stub(win.AudioRecorderApp.converter, 'convertWithFallback').resolves({
        blob: new win.Blob(['rendered-video'], { type: 'video/webm' }),
        format: 'webm',
        usedFallback: false,
      }).as('pipelineConvertForReview');
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@pipelineConvertForReview').should('have.been.calledOnce');
    cy.get('#pipelineReportModal').should('be.visible');
    cy.get('#pipelineReviewList').should('be.visible').and('contain.text', 'Review before upload');
    cy.get('@pipelineUploadDirect').should('not.have.been.called');
    cy.get('#pipelineReviewList video').should('have.attr', 'src').and('match', /^blob:/);
    cy.get('#confirmPipelineUploadsBtn').should('be.visible');
    cy.get('#skipPipelineUploadsBtn').should('be.visible').click();

    cy.get('@pipelineUploadDirect').should('not.have.been.called');
    cy.get('#pipelineReviewList').should('not.be.visible');
    cy.get('#pipelineReportSummary').should('contain.text', 'Pipeline complete: 1 task finished');
    cy.get('#status').should('contain.text', 'YouTube upload skipped');
  });

  it('uploads reviewed visualization results only after confirmation', () => {
    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          name: 'Confirmed upload',
          action: 'visualize-upload',
          resolution: '1920x1080',
          presetId: 'preset:preset-cypress-bars',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-01T12:00',
        },
      ]);
    });
    cy.get('.pipeline-stage').first().find('.pipeline-stage-description').type('Reviewed description');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-audio'),
      fileName: 'confirm-me.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
        accessToken: 'stored-token',
        accessTokenExpiresAt: Date.now() + 3600 * 1000,
        tokenScope: combinedYouTubeScope,
      }));
      cy.stub(win.AudioRecorderYouTube, 'hasValidAccessToken').returns(true);
      cy.stub(win.AudioRecorderYouTube, 'uploadDirect').as('pipelineUploadDirect').resolves({
        id: 'reviewed-video-id',
        url: 'https://www.youtube.com/watch?v=reviewed-video-id',
      });
      cy.stub(win.AudioRecorderApp.converter, 'convertWithFallback').resolves({
        blob: new win.Blob(['rendered-video'], { type: 'video/webm' }),
        format: 'webm',
        usedFallback: false,
      });
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();
    cy.get('#pipelineReportModal').should('be.visible');
    cy.get('#pipelineReviewList').should('be.visible').and('contain.text', 'Confirmed upload');
    cy.get('@pipelineUploadDirect').should('not.have.been.called');
    cy.get('#confirmPipelineUploadsBtn').click();

    cy.get('@pipelineUploadDirect').should('have.been.calledOnce');
    cy.window().then((win) => {
      cy.get('@pipelineUploadDirect').then((uploadDirect) => {
        const call = uploadDirect.getCall(0).args[0];
        expect(call.video).to.be.instanceOf(win.Blob);
        expect(call.metadata.title).to.equal('Confirmed upload');
        expect(call.metadata.description).to.equal('Reviewed description');
      });
    });
    cy.get('#pipelineReviewList').should('not.be.visible');
    cy.get('#pipelineReportList').should('contain.text', 'Confirmed upload');
    cy.get('#pipelineReportList').should('contain.text', 'reviewed-video-id');
  });

  it('uploads rendered visualization results immediately when review is disabled', () => {
    cy.get('#pipelineSettingsBtn').click();
    cy.get('#pipelineReviewBeforeUpload').uncheck();
    cy.get('#confirmPipelineTimezoneBtn').click();

    cy.window().then((win) => {
      win.AudioRecorderPipeline.replaceStages([
        {
          name: 'Immediate upload',
          action: 'visualize-upload',
          resolution: '1920x1080',
          presetId: 'preset:preset-cypress-bars',
          scheduleMode: 'absolute',
          publishAtLocal: '2026-08-01T12:00',
        },
      ]);
    });
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-audio'),
      fileName: 'immediate-upload.mp3',
      mimeType: 'audio/mpeg',
    }, { force: true });

    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
        accessToken: 'stored-token',
        accessTokenExpiresAt: Date.now() + 3600 * 1000,
        tokenScope: combinedYouTubeScope,
      }));
      cy.stub(win.AudioRecorderYouTube, 'hasValidAccessToken').returns(true);
      cy.stub(win.AudioRecorderYouTube, 'uploadDirect').as('pipelineUploadDirect').resolves({
        id: 'immediate-video-id',
        url: 'https://www.youtube.com/watch?v=immediate-video-id',
      });
      cy.stub(win.AudioRecorderApp.converter, 'convertWithFallback').resolves({
        blob: new win.Blob(['rendered-video'], { type: 'video/webm' }),
        format: 'webm',
        usedFallback: false,
      });
    });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@pipelineUploadDirect').should('have.been.calledOnce');
    cy.get('#pipelineReportModal').should('be.visible');
    cy.get('#pipelineReviewList').should('not.be.visible');
    cy.get('#pipelineReportList').should('contain.text', 'Immediate upload');
    cy.get('#pipelineReportList').should('contain.text', 'immediate-video-id');
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
          playlistId: 'PL-stage-created',
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

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlists*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer stored-token');
      expect(body).to.deep.equal({
        snippet: {
          title: 'Stage playlist',
          description: '',
        },
        status: {
          privacyStatus: 'private',
        },
      });

      req.reply({
        statusCode: 200,
        body: {
          id: 'PL-stage-created',
          snippet: { title: 'Stage playlist', description: '' },
        },
      });
    }).as('createPipelinePlaylist');

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
    cy.get('.pipeline-stage').first().find('.youtube-playlist-create input').type('Stage playlist');
    cy.get('.pipeline-stage').first().find('.youtube-playlist-create button').click();
    cy.wait('@createPipelinePlaylist');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-playlist-ids').should('have.value', 'PL-stage-created');
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
      .and('contain.text', 'PL-stage-created');
    cy.get('#pipelineReportList a')
      .should('have.attr', 'href', 'https://www.youtube.com/watch?v=pipeline-video-id');
  });

  it('starts YouTube authorization from Run for upload stages without a separate YouTube click', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      expect(req.headers.authorization).to.equal('Bearer electron-token');

      req.reply({
        statusCode: 200,
        headers: { Location: 'https://upload.example/pipeline-auth-session' },
        body: '',
      });
    }).as('startPipelineUpload');

    cy.intercept('PUT', 'https://upload.example/pipeline-auth-session', {
      statusCode: 201,
      body: { id: 'pipeline-auth-video-id' },
    }).as('finishPipelineUpload');

    cy.reload();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
        win.localStorage.setItem('audio-recorder-youtube-client-id', '123-desktop-client-id.apps.googleusercontent.com');
        win.electronAPI = {
          isElectron: true,
          authorizeYouTube: cy.stub().as('authorizeYouTube').resolves({
            accessToken: 'electron-token',
            expiresIn: 3600,
            scope: combinedYouTubeScope,
          }),
        };
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('.pipeline-stage').first().find('.pipeline-stage-name').clear().type('Run authorizes upload');
    cy.get('.pipeline-stage').first().find('select').first().select('upload-youtube');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-video'),
      fileName: 'direct-video.webm',
      mimeType: 'video/webm',
    }, { force: true });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@authorizeYouTube')
      .should('have.been.calledOnce')
      .and('have.been.calledWith', '123-desktop-client-id.apps.googleusercontent.com');
  });

  it('starts browser YouTube sign-in from Run without a separate YouTube click', () => {
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/channels*', {
      statusCode: 200,
      body: { items: [{ brandingSettings: { channel: {} } }] },
    }).as('refreshChannelDefaultsAfterBrowserAuth');
    cy.reload();
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        seedSavedVisualizationPresets(win);
        win.localStorage.setItem('audio-recorder-youtube-client-id', '123-web-client-id.apps.googleusercontent.com');
        win.google = {
          accounts: {
            oauth2: {
              initTokenClient: cy.stub().callsFake(({ callback }) => ({
                requestAccessToken: cy.stub().as('requestAccessToken').callsFake(() => callback({
                  access_token: 'browser-token',
                  expires_in: 3600,
                  scope: combinedYouTubeScope,
                })),
              })).as('initTokenClient'),
            },
          },
        };
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#clearPipelineBtn').click();
    cy.get('#addPipelineStageBtn').click();
    cy.get('.pipeline-stage').first().find('select').first().select('upload-youtube');
    cy.get('.pipeline-stage').first().find('.pipeline-stage-file-input').selectFile({
      contents: Cypress.Buffer.from('stage-video'),
      fileName: 'direct-video.webm',
      mimeType: 'video/webm',
    }, { force: true });

    cy.get('#runPipelineBtn').should('not.be.disabled').click();

    cy.get('@initTokenClient').should('have.been.calledOnce');
    cy.get('@requestAccessToken').should('have.been.calledOnceWith', { prompt: 'consent' });
    cy.get('#youtubeAuthModal').should('not.be.visible');
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

  it('renames, deletes, and reorders saved pipelines from the sidebar', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-pipelines', JSON.stringify([
        { id: 'pipe-a', name: 'Alpha', timezone: '', uploadOrder: 'chronological', stages: [] },
        { id: 'pipe-b', name: 'Beta', timezone: '', uploadOrder: 'chronological', stages: [] },
        { id: 'pipe-c', name: 'Gamma', timezone: '', uploadOrder: 'chronological', stages: [] },
      ]));
    });
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });
    cy.reload();
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

    cy.get('#pipelineList .pipeline-load-btn').should('have.length', 3);

    cy.get('#pipelineList .pipeline-load-btn').eq(1).rightclick();
    cy.get('#pipelineContextMenu').should('be.visible');
    cy.get('#pipelineRenameBtn').click();
    cy.get('#pipelineRenameModal').should('be.visible');
    cy.get('#pipelineRenameInput').should('have.value', 'Beta').clear().type('Renamed');
    cy.get('#pipelineConfirmRenameBtn').click();
    cy.get('#pipelineRenameModal').should('not.be.visible');
    cy.get('#pipelineList .pipeline-load-btn').eq(1).should('contain', 'Renamed');
    cy.window().then((win) => {
      const pipelines = JSON.parse(win.localStorage.getItem('audio-recorder-pipelines'));
      expect(pipelines[1].name).to.equal('Renamed');
    });

    cy.get('#pipelineList .pipeline-load-btn').eq(2).rightclick();
    cy.get('#pipelineContextMenu').should('be.visible');
    cy.get('#pipelineDeleteSavedBtn').click();
    cy.get('#pipelineList .pipeline-load-btn').should('have.length', 2);
    cy.window().then((win) => {
      const pipelines = JSON.parse(win.localStorage.getItem('audio-recorder-pipelines'));
      expect(pipelines.map(p => p.name)).to.deep.equal(['Alpha', 'Renamed']);
    });

    cy.get('#pipelineList .pipeline-load-btn').eq(1).trigger('dragstart', {
      dataTransfer: new DataTransfer(),
    });
    cy.get('#pipelineList .pipeline-load-btn').eq(0).trigger('dragover', {
      dataTransfer: new DataTransfer(),
    });
    cy.get('#pipelineList .pipeline-load-btn').eq(0).trigger('drop', {
      dataTransfer: new DataTransfer(),
    });

    cy.get('#pipelineList .pipeline-load-btn').eq(0).should('contain', 'Renamed');
    cy.window().then((win) => {
      const pipelines = JSON.parse(win.localStorage.getItem('audio-recorder-pipelines'));
      expect(pipelines.map(p => p.name)).to.deep.equal(['Renamed', 'Alpha']);
    });
  });
});
