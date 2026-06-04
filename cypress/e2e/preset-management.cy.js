describe('Preset Management', () => {
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
    cy.window().then((win) => {
      win.localStorage.setItem('audio-recorder-presets', JSON.stringify([
        { id: 'preset-a', name: 'A', createdAt: '2026-06-04T00:00:00.000Z', settings: {} },
        { id: 'preset-b', name: 'B', createdAt: '2026-06-04T00:00:01.000Z', settings: {} },
        { id: 'preset-c', name: 'C', createdAt: '2026-06-04T00:00:02.000Z', settings: {} },
      ]));
    });
    cy.reload();
    cy.waitForVisualization();
    cy.window().then((win) => {
      cy.stub(win, 'prompt').returns('Renamed');
      cy.stub(win, 'confirm').returns(true);
    });
    cy.get('#presetEdgeTrigger').trigger('pointerenter');

    cy.get('#presetList .preset-load-btn').eq(1).rightclick();
    cy.get('#presetContextMenu').should('be.visible');
    cy.get('#presetRenameBtn').click();
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
});
