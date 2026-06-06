describe('Pipeline Mode', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();
  });

  it('deletes a stage only after confirmation', () => {
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
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: Date.now() + 3600 * 1000,
        }));
      },
    });
    cy.waitForVisualization();
    cy.contains('.tab', 'Pipeline').click();

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
});
