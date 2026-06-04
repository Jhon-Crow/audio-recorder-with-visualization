describe('Aspect Ratio Settings', () => {
  function selectHiddenOption(selector, value) {
    cy.get(selector).then(($select) => {
      $select.val(value);
      $select[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('defaults to 16:9 and preserves the existing 1080p canvas size', () => {
    cy.get('#aspectRatio').should('have.value', '16:9');
    cy.get('#videoDimensions').should('contain.text', '1920 x 1080');
    cy.get('#visualizer')
      .should('have.prop', 'width', 1920)
      .and('have.prop', 'height', 1080);
  });

  it('switches 1080p output to 9:16 shorts dimensions', () => {
    selectHiddenOption('#aspectRatio', '9:16');

    cy.get('#videoDimensions').should('contain.text', '608 x 1080');
    cy.get('#visualizer')
      .should('have.prop', 'width', 608)
      .and('have.prop', 'height', 1080);

    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem('audio-recorder-settings'));
      expect(saved.aspectRatio).to.equal('9:16');
      expect(win.AudioRecorderApp.getVideoDimensions()).to.deep.equal({ width: 608, height: 1080 });
    });
  });

  it('calculates portrait dimensions from the selected quality height', () => {
    selectHiddenOption('#videoQuality', '720p');
    selectHiddenOption('#aspectRatio', '4:5');

    cy.get('#videoDimensions').should('contain.text', '576 x 720');
    cy.window().then((win) => {
      expect(win.AudioRecorderApp.getVideoDimensions()).to.deep.equal({ width: 576, height: 720 });
    });
  });

  it('restores the selected aspect ratio after reload', () => {
    selectHiddenOption('#aspectRatio', '1:1');
    cy.reload();
    cy.waitForVisualization();

    cy.get('#aspectRatio').should('have.value', '1:1');
    cy.get('#videoDimensions').should('contain.text', '1920 x 1920');
    cy.get('#visualizer')
      .should('have.prop', 'width', 1920)
      .and('have.prop', 'height', 1920);
  });
});
