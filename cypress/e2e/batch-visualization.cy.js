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
      .and('contain.text', 'Save All');
  });
});
