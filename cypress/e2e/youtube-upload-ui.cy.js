describe('YouTube Upload UI', () => {
  function addSyntheticRecording() {
    cy.window().then((win) => {
      win.AudioRecorderApp.addRecording(new win.Blob(['video'], { type: 'video/webm' }));
    });
  }

  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('shows an upload button beside the generated recording download action', () => {
    cy.visit('/examples/index.html');
    cy.waitForVisualization();

    addSyntheticRecording();

    cy.contains('.recording-item', 'Recording 1').within(() => {
      cy.contains('a', 'Download').should('be.visible');
      cy.contains('button', 'Upload to YouTube').should('be.visible').click();
    });

    cy.get('#youtubeAuthModal').should('be.visible');
    cy.get('#youtubeUploadModal').should('not.be.visible');
  });

  it('offers to reopen file origins on localhost before Google sign-in', () => {
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.__audioRecorderYouTubeOrigin = new URL('file:///tmp/audio-recorder-with-visualization/examples/index.html');
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeAuthModal').should('be.visible');
    cy.get('#youtubeAuthStatus')
      .should('have.class', 'error')
      .and('contain.text', 'Google sign-in requires a localhost or HTTPS URL')
      .and('contain.text', 'http://localhost:8080/index.html');
    cy.get('#authorizeYouTubeBtn').should('not.be.disabled').and('contain.text', 'Open localhost');
  });

  it('explains invalid OAuth client IDs before Google sign-in', () => {
    cy.visit('/examples/index.html');
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeClientId').type('not-a-web-client-id');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeAuthStatus')
      .should('have.class', 'error')
      .and('contain.text', 'This does not look like a Google OAuth Client ID')
      .and('contain.text', 'Authorized JavaScript origins')
      .and('contain.text', 'exactly http://localhost:8080')
      .and('contain.text', 'without a path or trailing slash');
  });

  it('opens Google Cloud OAuth setup guidance with the current origin', () => {
    cy.visit('/examples/index.html');
    cy.waitForVisualization();

    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen');
    });

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();
    cy.get('#openGoogleCloudOAuthBtn').click();

    cy.get('@windowOpen')
      .should('have.been.calledWith', 'https://console.cloud.google.com/apis/credentials/oauthclient', '_blank', 'noopener');
    cy.get('#youtubeAuthStatus')
      .should('contain.text', 'Opening Google Cloud OAuth clients')
      .and('contain.text', 'Web application OAuth Client ID')
      .and('contain.text', 'YouTube Data API v3')
      .and('contain.text', 'http://localhost:8080');
  });

  it('explains Google invalid_client responses with origin setup guidance', () => {
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.google = {
          accounts: {
            oauth2: {
              initTokenClient(config) {
                return {
                  requestAccessToken() {
                    config.callback({
                      error: 'invalid_client',
                      error_description: 'The OAuth client was not found.',
                    });
                  },
                };
              },
            },
          },
        };
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeClientId').type('123-test.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeAuthStatus')
      .should('have.class', 'error')
      .and('contain.text', 'Google rejected this OAuth Client ID')
      .and('contain.text', 'Authorized JavaScript origins')
      .and('contain.text', 'exactly http://localhost:8080')
      .and('contain.text', 'without a path or trailing slash');
  });

  it('uses Electron native OAuth instead of the browser Google token flow', () => {
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        const initTokenClient = cy.stub().as('initTokenClient');
        win.google = {
          accounts: {
            oauth2: {
              initTokenClient,
            },
          },
        };
        win.electronAPI = {
          isElectron: true,
          authorizeYouTube: cy.stub().as('authorizeYouTube').resolves({
            accessToken: 'electron-token',
            expiresIn: 3600,
          }),
        };
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeAuthModal').should('be.visible');
    cy.get('#youtubeAuthStatus')
      .should('contain.text', 'Electron sign-in opens Google in your default browser')
      .and('contain.text', 'Desktop app OAuth Client ID');
    cy.get('#youtubeClientSecretField').should('be.visible');
    cy.get('#youtubeClientId').type('123-desktop-client-id.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('@authorizeYouTube')
      .should('have.been.calledOnce')
      .and('have.been.calledWith', '123-desktop-client-id.apps.googleusercontent.com');
    cy.get('@initTokenClient').should('not.have.been.called');
    cy.get('#youtubeUploadModal').should('be.visible');
  });

  it('authorizes with Google and uploads metadata with the short tag enabled', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body.snippet.title).to.equal('Published visualizer');
      expect(body.snippet.description).to.equal('Rendered from Cypress\n\n#short');
      expect(body.snippet.tags).to.deep.equal(['audio', 'visualizer', 'cypress']);
      expect(body.status.privacyStatus).to.equal('unlisted');
      expect(body.status.selfDeclaredMadeForKids).to.equal(false);

      req.reply({
        statusCode: 200,
        headers: { Location: 'https://upload.example/session' },
        body: '',
      });
    }).as('startYouTubeUpload');

    cy.intercept('PUT', 'https://upload.example/session', (req) => {
      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(req.headers['content-range']).to.equal('bytes 0-4/5');

      req.reply({
        statusCode: 201,
        body: { id: 'video-abc' },
      });
    }).as('finishYouTubeUpload');

    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=video-abc', (req) => {
      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(req.headers['content-type']).to.contain('image/png');

      req.reply({
        statusCode: 200,
        body: { items: [{ default: true }] },
      });
    }).as('setYouTubeThumbnail');

    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.google = {
          accounts: {
            oauth2: {
              initTokenClient(config) {
                return {
                  requestAccessToken() {
                    config.callback({
                      access_token: 'test-token',
                      expires_in: 3600,
                      scope: 'https://www.googleapis.com/auth/youtube.upload',
                    });
                  },
                };
              },
            },
          },
        };
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeAuthModal').should('be.visible');
    cy.get('#youtubeClientId').type('123-test-client-id.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeTitle').clear().type('Published visualizer');
    cy.get('#youtubeDescription').type('Rendered from Cypress');
    cy.get('#youtubeTags').clear().type('audio, visualizer, cypress');
    cy.get('#youtubeThumbnail').selectFile({
      contents: Cypress.Buffer.from('preview-image'),
      fileName: 'preview.png',
      mimeType: 'image/png',
    });
    cy.get('#youtubePrivacy').select('unlisted');
    cy.get('#youtubeShort').check();
    cy.get('#submitYouTubeUploadBtn').click();

    cy.wait('@startYouTubeUpload');
    cy.wait('@finishYouTubeUpload');
    cy.wait('@setYouTubeThumbnail');
    cy.get('#youtubeUploadStatus')
      .should('contain.text', 'Uploaded:')
      .find('a')
      .should('have.attr', 'href', 'https://www.youtube.com/watch?v=video-abc');
  });
});
