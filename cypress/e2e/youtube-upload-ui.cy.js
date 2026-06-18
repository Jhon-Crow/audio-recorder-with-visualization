describe('YouTube Upload UI', () => {
  const combinedYouTubeScope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ].join(' ');

  function addSyntheticRecording() {
    cy.window().then((win) => {
      win.AudioRecorderApp.addRecording(new win.Blob(['video'], { type: 'video/webm' }));
    });
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/playlists*', {
      statusCode: 200,
      body: { items: [] },
    });
  });

  it('shows an upload button beside the generated recording download action', () => {
    cy.visit('/examples/index.html');
    cy.waitForVisualization();

    addSyntheticRecording();

    cy.get('#recordingsList').scrollIntoView();
    cy.get('.recording-item').first().within(() => {
      cy.contains('recording-1.webm').should('be.visible');
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

  it('restores Electron Google authorization with the saved client ID before showing the auth form', () => {
    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('audio-recorder-youtube-client-id', '123-desktop-client-id.apps.googleusercontent.com');
        win.electronAPI = {
          isElectron: true,
          authorizeYouTube: cy.stub().as('authorizeYouTube').resolves({
            accessToken: 'refreshed-electron-token',
            expiresIn: 3600,
            scope: combinedYouTubeScope,
          }),
        };
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('@authorizeYouTube')
      .should('have.been.calledOnce')
      .and('have.been.calledWith', '123-desktop-client-id.apps.googleusercontent.com');
    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeAuthModal').should('not.be.visible');
    cy.get('#youtubeAuthSettingsStatus').should('contain.text', 'Signed in');
  });

  it('restores saved Google authorization after a restart', () => {
    const futureExpiry = Date.now() + 3600 * 1000;

    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('audio-recorder-youtube-client-id', '123-test-client-id.apps.googleusercontent.com');
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: futureExpiry,
        }));
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeAuthModal').should('not.be.visible');
    cy.get('#youtubeAuthSettingsStatus').should('contain.text', 'Signed in');
  });

  it('loads existing YouTube playlists and creates a new playlist by title', () => {
    cy.intercept('GET', 'https://www.googleapis.com/youtube/v3/playlists*', {
      statusCode: 200,
      body: {
        items: [
          {
            id: 'PL-existing',
            snippet: { title: 'Existing playlist' },
            contentDetails: { itemCount: 4 },
          },
        ],
      },
    }).as('listYouTubePlaylists');
    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlists*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body).to.deep.equal({
        snippet: {
          title: 'Release playlist',
          description: '',
        },
        status: {
          privacyStatus: 'private',
        },
      });

      req.reply({
        statusCode: 200,
        body: {
          id: 'PL-created',
          snippet: { title: 'Release playlist', description: '' },
        },
      });
    }).as('createYouTubePlaylist');

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
                      scope: combinedYouTubeScope,
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
    cy.get('#youtubeClientId').type('123-test-client-id.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.wait('@listYouTubePlaylists');
    cy.contains('#youtubePlaylistSelector .youtube-playlist-option', 'Existing playlist').find('input').check();
    cy.get('#youtubePlaylistIds').should('have.value', 'PL-existing');
    cy.get('#youtubePlaylistSelector .youtube-playlist-create input').type('Release playlist');
    cy.get('#youtubePlaylistSelector .youtube-playlist-create button').click();
    cy.wait('@createYouTubePlaylist');
    cy.get('#youtubePlaylistIds').should('have.value', 'PL-existing, PL-created');
  });

  it('signs out from Google authorization settings', () => {
    const futureExpiry = Date.now() + 3600 * 1000;

    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('audio-recorder-youtube-token-state', JSON.stringify({
          accessToken: 'stored-token',
          accessTokenExpiresAt: futureExpiry,
        }));
        win.electronAPI = {
          isElectron: true,
          authorizeYouTube: cy.stub().as('authorizeYouTube').resolves({
            accessToken: 'electron-token',
            expiresIn: 3600,
          }),
          clearYouTubeAuthorization: cy.stub().as('clearYouTubeAuthorization').resolves({ success: true }),
        };
      },
    });
    cy.waitForVisualization();

    addSyntheticRecording();
    cy.contains('button', 'Upload to YouTube').click();
    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeUploadModal .close-btn').click();

    cy.get('#youtubeAuthModal').invoke('show');
    cy.get('#youtubeAuthSettingsStatus').should('contain.text', 'Signed in');
    cy.get('#youtubeSignOutBtn').click();

    cy.get('@clearYouTubeAuthorization').should('have.been.calledOnce');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('audio-recorder-youtube-token-state')).to.equal(null);
    });
    cy.get('#youtubeAuthSettingsStatus').should('contain.text', 'Not signed in');
  });

  it('authorizes with Google and uploads metadata with the short tag enabled', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body.snippet.title).to.equal('Published visualizer');
      expect(body.snippet.description).to.equal('Rendered from Cypress\n\n#shorts');
      expect(body.snippet.tags).to.deep.equal(['audio', 'visualizer', 'cypress']);
      expect(body.status.privacyStatus).to.equal('private');
      expect(body.status.publishAt).to.equal('2026-07-01T12:30:00.000Z');
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

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body).to.deep.equal({
        snippet: {
          playlistId: 'PL-form',
          resourceId: {
            kind: 'youtube#video',
            videoId: 'video-abc',
          },
        },
      });

      req.reply({
        statusCode: 200,
        body: { id: 'playlist-item-form' },
      });
    }).as('addYouTubePlaylistItem');

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlists*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body.snippet.title).to.equal('Release upload playlist');
      expect(body.status.privacyStatus).to.equal('private');

      req.reply({
        statusCode: 200,
        body: {
          id: 'PL-form',
          snippet: { title: 'Release upload playlist', description: '' },
        },
      });
    }).as('createUploadPlaylist');

    cy.visit('/examples/index.html', {
      onBeforeLoad(win) {
        win.google = {
          accounts: {
            oauth2: {
              initTokenClient(config) {
                expect(config.scope).to.equal(combinedYouTubeScope);
                return {
                  requestAccessToken() {
                    config.callback({
                      access_token: 'test-token',
                      expires_in: 3600,
                      scope: combinedYouTubeScope,
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
    cy.get('#youtubePlaylistSelector .youtube-playlist-create input').type('Release upload playlist');
    cy.get('#youtubePlaylistSelector .youtube-playlist-create button').click();
    cy.wait('@createUploadPlaylist');
    cy.get('#youtubePlaylistIds').should('have.value', 'PL-form');
    cy.get('#youtubeThumbnail').selectFile({
      contents: Cypress.Buffer.from('preview-image'),
      fileName: 'preview.png',
      mimeType: 'image/png',
    });
    cy.get('#youtubePrivacy').select('unlisted');
    cy.get('#youtubePublishAt').type('2026-07-01T12:30');
    cy.get('#youtubePrivacy').should('be.disabled').and('have.value', 'private');
    cy.get('#youtubeShort').check();
    cy.get('#submitYouTubeUploadBtn').click();

    cy.wait('@startYouTubeUpload');
    cy.wait('@finishYouTubeUpload');
    cy.wait('@setYouTubeThumbnail');
    cy.wait('@addYouTubePlaylistItem');
    cy.get('#youtubeUploadStatus')
      .should('contain.text', 'Uploaded:')
      .find('a')
      .should('have.attr', 'href', 'https://www.youtube.com/watch?v=video-abc');
  });

  it('remembers upload form options from the last upload attempt', () => {
    cy.intercept('POST', 'https://www.googleapis.com/upload/youtube/v3/videos*', {
      statusCode: 200,
      headers: { Location: 'https://upload.example/memory-session' },
      body: '',
    }).as('startMemoryUpload');

    cy.intercept('PUT', 'https://upload.example/memory-session', {
      statusCode: 201,
      body: { id: 'video-memory' },
    }).as('finishMemoryUpload');

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
      statusCode: 200,
      body: { id: 'playlist-memory' },
    }).as('addMemoryPlaylistItem');

    cy.intercept('POST', 'https://www.googleapis.com/youtube/v3/playlists*', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      expect(req.headers.authorization).to.equal('Bearer test-token');
      expect(body.snippet.title).to.equal('Memory playlist');
      expect(body.status.privacyStatus).to.equal('private');

      req.reply({
        statusCode: 200,
        body: {
          id: 'PL-memory',
          snippet: { title: 'Memory playlist', description: '' },
        },
      });
    }).as('createMemoryPlaylist');

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
                      scope: combinedYouTubeScope,
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
    cy.get('#youtubeClientId').type('123-test-client-id.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeDescription').type('Saved upload description');
    cy.get('#youtubeTags').clear().type('ambient, saved, cypress');
    cy.get('#youtubePlaylistSelector .youtube-playlist-create input').type('Memory playlist');
    cy.get('#youtubePlaylistSelector .youtube-playlist-create button').click();
    cy.wait('@createMemoryPlaylist');
    cy.get('#youtubePlaylistIds').should('have.value', 'PL-memory');
    cy.get('#youtubeCategory').select('22');
    cy.get('#youtubePrivacy').select('public');
    cy.get('#youtubeShort').check();
    cy.get('#youtubeMadeForKids').check();
    cy.get('#youtubeSyntheticMedia').check();
    cy.get('#youtubeNotifySubscribers').check();
    cy.get('#submitYouTubeUploadBtn').click();

    cy.wait('@startMemoryUpload');
    cy.wait('@finishMemoryUpload');
    cy.wait('@addMemoryPlaylistItem');
    cy.get('#closeYouTubeUploadBtn').click();

    addSyntheticRecording();
    cy.contains('.recording-item', 'recording-2.webm').within(() => {
      cy.contains('button', 'Upload to YouTube').click();
    });

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeDescription').should('have.value', 'Saved upload description');
    cy.get('#youtubeTags').should('have.value', 'ambient, saved, cypress');
    cy.get('#youtubePlaylistSelector .youtube-playlist-option').should('contain.text', 'Memory playlist');
    cy.get('#youtubePlaylistIds').should('have.value', 'PL-memory');
    cy.get('#youtubeCategory').should('have.value', '22');
    cy.get('#youtubePrivacy').should('have.value', 'public');
    cy.get('#youtubeShort').should('be.checked');
    cy.get('#youtubeMadeForKids').should('be.checked');
    cy.get('#youtubeSyntheticMedia').should('be.checked');
    cy.get('#youtubeNotifySubscribers').should('be.checked');
  });

  it('keeps the upload form open when text selection ends outside the form', () => {
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
    cy.get('#youtubeClientId').type('123-test-client-id.apps.googleusercontent.com');
    cy.get('#authorizeYouTubeBtn').click();

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeDescription').type('Rendered from Cypress');
    cy.get('#youtubeDescription').trigger('mousedown');
    cy.get('#youtubeUploadModal').trigger('mouseup').click('topLeft');

    cy.get('#youtubeUploadModal').should('be.visible');
    cy.get('#youtubeDescription').should('have.value', 'Rendered from Cypress');
  });
});
