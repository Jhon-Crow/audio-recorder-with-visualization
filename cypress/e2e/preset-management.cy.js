describe('Preset Management', () => {
  function visitWithPresets(presets) {
    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-presets', JSON.stringify(presets));
    });
    cy.reload();
    cy.waitForVisualization();
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('saves current settings as a preset and restores them from the sidebar', () => {
    cy.get('#presetSidebar').should('not.be.visible');
    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetSidebar').should('be.visible');
    cy.get('#savePresetBtn').should('be.visible').click();

    cy.get('#presetSaveModal').should('be.visible');
    cy.get('#presetNameInput').should('have.value', '1');
    cy.get('#presetConfirmSaveBtn').click();

    cy.get('#presetSaveModal').should('not.be.visible');
    cy.get('#presetList .preset-load-btn').should('have.length', 1).first().should('contain', '1');

    cy.window().then((win) => {
      const presets = JSON.parse(win.localStorage.getItem('audio-recorder-presets'));
      expect(presets).to.have.length(1);
      expect(presets[0].name).to.equal('1');
      expect(presets[0].settings.visualizer).to.equal('bars');
    });

    cy.get('#visualizerSelect').select('waveform');
    cy.get('#primaryColor').invoke('val', '#ff0000').trigger('input').trigger('change');
    cy.wait(250);

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetList .preset-load-btn').first().click();
    cy.get('#visualizerSelect').should('have.value', 'bars');
    cy.get('#primaryColor').should('have.value', '#00ff88');
  });

  it('uses skip dialog mode with numbered default names', () => {
    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#savePresetBtn').click();
    cy.get('#presetDontShowAgain').check();
    cy.get('#presetConfirmSaveBtn').click();

    cy.get('#savePresetBtn').click();

    cy.get('#presetSaveModal').should('not.be.visible');
    cy.get('#presetList .preset-load-btn').should('have.length', 2);
    cy.get('#presetList .preset-load-btn').eq(1).should('contain', '2');
  });

  it('renames, deletes, and reorders presets from the sidebar', () => {
    visitWithPresets([
      { id: 'preset-a', name: 'A', createdAt: '2026-06-04T00:00:00.000Z', settings: {} },
      { id: 'preset-b', name: 'B', createdAt: '2026-06-04T00:00:01.000Z', settings: {} },
      { id: 'preset-c', name: 'C', createdAt: '2026-06-04T00:00:02.000Z', settings: {} },
    ]);
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });
    cy.get('#presetEdgeTrigger').trigger('pointerenter');

    cy.get('#presetList .preset-load-btn').eq(1).rightclick();
    cy.get('#presetContextMenu').should('be.visible');
    cy.get('#presetRenameBtn').click();
    cy.get('#presetRenameModal').should('be.visible');
    cy.get('#presetRenameInput').should('have.value', 'B').clear().type('Renamed');
    cy.get('#presetConfirmRenameBtn').click();
    cy.get('#presetRenameModal').should('not.be.visible');
    cy.get('#presetList .preset-load-btn').eq(1).should('contain', 'Renamed');
    cy.window().then((win) => {
      const presets = JSON.parse(win.localStorage.getItem('audio-recorder-presets'));
      expect(presets[1].name).to.equal('Renamed');
    });

    cy.get('#presetList .preset-load-btn').eq(2).rightclick();
    cy.get('#presetDeleteBtn').click();
    cy.get('#presetList .preset-load-btn').should('have.length', 2);

    cy.get('#presetList .preset-load-btn').eq(1).trigger('dragstart', {
      dataTransfer: new DataTransfer(),
    });
    cy.get('#presetList .preset-load-btn').eq(0).trigger('dragover', {
      dataTransfer: new DataTransfer(),
    });
    cy.get('#presetList .preset-load-btn').eq(0).trigger('drop', {
      dataTransfer: new DataTransfer(),
    });

    cy.get('#presetList .preset-load-btn').eq(0).should('contain', 'Renamed');
    cy.window().then((win) => {
      const presets = JSON.parse(win.localStorage.getItem('audio-recorder-presets'));
      expect(presets.map((preset) => preset.name)).to.deep.equal(['Renamed', 'A']);
    });
  });

  it('highlights the loaded preset until settings change', () => {
    visitWithPresets([
      { id: 'preset-a', name: 'A', createdAt: '2026-06-04T00:00:00.000Z', settings: {} },
      {
        id: 'preset-b',
        name: 'B',
        createdAt: '2026-06-04T00:00:01.000Z',
        settings: { visualizer: 'waveform', primaryColor: '#ff0000' },
      },
    ]);
    cy.get('#presetEdgeTrigger').trigger('pointerenter');

    cy.get('#presetList .preset-load-btn').first().click();
    cy.get('#presetList .preset-load-btn').first()
      .should('have.class', 'is-active')
      .and('have.attr', 'aria-current', 'true');

    cy.get('#visualizerSelect').select('waveform');
    cy.get('#presetList .preset-load-btn').first()
      .should('not.have.class', 'is-active')
      .and('not.have.attr', 'aria-current');
  });

  it('restores the active preset highlight after reload when settings still match', () => {
    visitWithPresets([
      {
        id: 'preset-a',
        name: 'A',
        createdAt: '2026-06-04T00:00:00.000Z',
        settings: { visualizer: 'waveform', primaryColor: '#ff0000' },
      },
      {
        id: 'preset-b',
        name: 'B',
        createdAt: '2026-06-04T00:00:01.000Z',
        settings: { visualizer: 'bars', primaryColor: '#00ff88' },
      },
    ]);
    cy.get('#presetEdgeTrigger').trigger('pointerenter');

    cy.get('#presetList .preset-load-btn').first().click();
    cy.get('#presetList .preset-load-btn').first()
      .should('have.class', 'is-active')
      .and('have.attr', 'aria-current', 'true');

    cy.reload();
    cy.waitForVisualization();
    cy.get('#presetEdgeTrigger').trigger('pointerenter');

    cy.get('#presetList .preset-load-btn').first()
      .should('have.class', 'is-active')
      .and('have.attr', 'aria-current', 'true');

    cy.get('#visualizerSelect').select('bars');
    cy.get('#presetList .preset-load-btn').first()
      .should('not.have.class', 'is-active')
      .and('not.have.attr', 'aria-current');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('audio-recorder-active-preset-id')).to.equal(null);
    });
  });

  it('loads presets from a manually selected Electron folder', () => {
    cy.window().then((win) => {
      win.electronAPI = {
        choosePresetFolder: () => Promise.resolve({ success: true, folderPath: '/old/presets' }),
        loadPresetFiles: () => Promise.resolve({
          success: true,
          presets: [
            {
              id: 'legacy-preset',
              name: 'Legacy',
              createdAt: '2026-06-01T00:00:00.000Z',
              settings: { visualizer: 'waveform', primaryColor: '#ff0000' },
            },
          ],
        }),
      };
      cy.spy(win.electronAPI, 'choosePresetFolder').as('choosePresetFolder');
      cy.spy(win.electronAPI, 'loadPresetFiles').as('loadPresetFiles');
    });

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetSettingsBtn').click();
    cy.get('#presetSettingsChooseFolderBtn').click();

    cy.get('@choosePresetFolder').should('have.been.calledOnce');
    cy.get('@loadPresetFiles').should('have.been.calledWith', '/old/presets');
    cy.get('#presetSettingsPathInput').should('have.value', '/old/presets');
    cy.get('#presetList .preset-load-btn').should('have.length', 1).first().should('contain', 'Legacy');

    cy.get('#presetSettingsCloseBtn').click();
    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetList .preset-load-btn').first().click();
    cy.get('#visualizerSelect').should('have.value', 'waveform');
    cy.get('#primaryColor').should('have.value', '#ff0000');

    cy.window().then((win) => {
      const presets = JSON.parse(win.localStorage.getItem('audio-recorder-presets'));
      expect(presets).to.have.length(1);
      expect(presets[0].id).to.equal('legacy-preset');

      const options = JSON.parse(win.localStorage.getItem('audio-recorder-preset-options'));
      expect(options.savePath).to.equal('/old/presets');
    });
  });

  it('loads presets from a saved Electron folder on startup', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-preset-options', JSON.stringify({
        savePath: '/old/presets',
        skipDialog: false,
      }));
      win.electronAPI = {
        loadPresetFiles: () => Promise.resolve({
          success: true,
          presets: [
            {
              id: 'startup-legacy-preset',
              name: 'Startup Legacy',
              createdAt: '2026-06-01T00:00:00.000Z',
              settings: { visualizer: 'waveform', primaryColor: '#ff0000' },
            },
          ],
        }),
      };
      return win.AudioRecorderApp.loadPresetsFromFolder('/old/presets');
    });

    cy.get('#presetEdgeTrigger').trigger('pointerenter');
    cy.get('#presetList .preset-load-btn').should('have.length', 1).first().should('contain', 'Startup Legacy');
  });
});
