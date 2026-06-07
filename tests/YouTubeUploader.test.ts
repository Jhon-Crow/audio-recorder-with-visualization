import {
  YouTubeUploadError,
  YouTubeUploader,
  appendShortHashtag,
  buildYouTubeVideoResource,
  normalizeYouTubePlaylistIds,
  normalizeYouTubeTags,
  type YouTubeUploadProgress,
} from '../src/core/YouTubeUploader';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function createFetchMock(): FetchMock {
  return jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
}

function createResponse(
  body: string | null,
  init: { status: number; headers?: Record<string, string> },
): Response {
  const headerEntries = Object.entries(init.headers || {});

  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: {
      get(name: string) {
        const requestedName = name.toLowerCase();
        const header = headerEntries.find(([key]) => key.toLowerCase() === requestedName);

        return header ? header[1] : null;
      },
    },
    text: jest.fn().mockResolvedValue(body || ''),
  } as unknown as Response;
}

describe('YouTubeUploader', () => {
  describe('metadata helpers', () => {
    test('normalizes comma-separated tags and removes duplicates', () => {
      expect(normalizeYouTubeTags('music, visualizer, Music,  synth wave  ')).toEqual([
        'music',
        'visualizer',
        'synth wave',
      ]);
    });

    test('normalizes comma-separated and newline playlist IDs', () => {
      expect(normalizeYouTubePlaylistIds(' PL1,PL2\nPL1\n PL3 ')).toEqual([
        'PL1',
        'PL2',
        'PL3',
      ]);
    });

    test('appends #shorts to descriptions only when enabled and not already present', () => {
      expect(appendShortHashtag('Demo description', true)).toBe('Demo description\n\n#shorts');
      expect(appendShortHashtag('Demo #shorts', true)).toBe('Demo #shorts');
      expect(appendShortHashtag('Demo #short', true)).toBe('Demo #short');
      expect(appendShortHashtag('Demo description', false)).toBe('Demo description');
    });

    test('builds YouTube video metadata with private privacy by default', () => {
      const resource = buildYouTubeVideoResource({
        title: '  Audio visualizer  ',
        description: 'Rendered with the app',
        tags: ['audio', 'visualizer'],
        short: true,
      });

      expect(resource).toEqual({
        snippet: {
          title: 'Audio visualizer',
          description: 'Rendered with the app\n\n#shorts',
          tags: ['audio', 'visualizer'],
          categoryId: '10',
        },
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
        },
      });
    });

    test('requires a non-empty video title', () => {
      expect(() => buildYouTubeVideoResource({ title: '   ' })).toThrow(YouTubeUploadError);
    });

    test('sets scheduled publish date and keeps scheduled videos private', () => {
      const resource = buildYouTubeVideoResource({
        title: 'Scheduled visualizer',
        privacyStatus: 'public',
        publishAt: '2026-07-01T12:30:00.000Z',
      });

      expect(resource.status).toMatchObject({
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
        publishAt: '2026-07-01T12:30:00.000Z',
      });
    });

    test('rejects invalid scheduled publish dates', () => {
      expect(() => buildYouTubeVideoResource({
        title: 'Scheduled visualizer',
        publishAt: 'not a date',
      })).toThrow('Scheduled publish date is invalid');
    });
  });

  describe('playlist helpers', () => {
    test('lists the signed-in channel playlists across pages', async () => {
      const fetchMock = createFetchMock();
      fetchMock
        .mockResolvedValueOnce(createResponse(JSON.stringify({
          nextPageToken: 'next-page',
          items: [
            {
              id: 'PL123',
              snippet: { title: 'Existing playlist', description: 'First page' },
              contentDetails: { itemCount: 2 },
            },
          ],
        }), { status: 200 }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({
          items: [
            {
              id: 'PL456',
              snippet: { title: 'Second playlist' },
              contentDetails: { itemCount: 0 },
            },
          ],
        }), { status: 200 }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });

      await expect(uploader.listPlaylists('token-123')).resolves.toEqual([
        { id: 'PL123', title: 'Existing playlist', description: 'First page', itemCount: 2 },
        { id: 'PL456', title: 'Second playlist', itemCount: 0 },
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        'https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=50',
      );
      expect(String(fetchMock.mock.calls[1][0])).toBe(
        'https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=50&pageToken=next-page',
      );
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: 'GET',
        headers: { Authorization: 'Bearer token-123' },
      });
    });

    test('creates a private playlist by title', async () => {
      const fetchMock = createFetchMock();
      fetchMock.mockResolvedValueOnce(createResponse(JSON.stringify({
        id: 'PL-created',
        snippet: { title: 'Release playlist', description: '' },
      }), { status: 200 }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });

      await expect(uploader.createPlaylist('token-123', '  Release   playlist  ')).resolves.toEqual({
        id: 'PL-created',
        title: 'Release playlist',
        description: '',
      });

      expect(String(fetchMock.mock.calls[0][0])).toBe(
        'https://www.googleapis.com/youtube/v3/playlists?part=snippet%2Cstatus',
      );

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json; charset=UTF-8',
      });
      expect(JSON.parse(init.body as string)).toEqual({
        snippet: {
          title: 'Release playlist',
          description: '',
        },
        status: {
          privacyStatus: 'private',
        },
      });
    });
  });

  describe('upload()', () => {
    test('starts a resumable session and uploads the video blob', async () => {
      const fetchMock = createFetchMock();
      fetchMock
        .mockResolvedValueOnce(createResponse(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session' },
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'video-123' }), {
          status: 201,
        }));

      const progress: YouTubeUploadProgress[] = [];
      const uploader = new YouTubeUploader({ fetch: fetchMock });
      const video = new Blob(['video'], { type: 'video/webm' });

      const result = await uploader.upload({
        video,
        accessToken: 'token-123',
        metadata: {
          title: 'Audio visualizer',
          description: 'Demo',
          privacyStatus: 'unlisted',
          short: true,
        },
        notifySubscribers: false,
        onProgress: (event) => progress.push(event),
      });

      expect(result).toEqual({
        id: 'video-123',
        url: 'https://www.youtube.com/watch?v=video-123',
        rawResponse: { id: 'video-123' },
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toContain('uploadType=resumable');
      expect(String(fetchMock.mock.calls[0][0])).toContain('part=snippet%2Cstatus');
      expect(String(fetchMock.mock.calls[0][0])).toContain('notifySubscribers=false');

      const sessionInit = fetchMock.mock.calls[0][1] as RequestInit;
      expect(sessionInit.method).toBe('POST');
      expect(sessionInit.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        'X-Upload-Content-Length': String(video.size),
        'X-Upload-Content-Type': 'video/webm',
      });

      const sessionBody = JSON.parse(sessionInit.body as string);
      expect(sessionBody.snippet.description).toBe('Demo\n\n#shorts');
      expect(sessionBody.status.privacyStatus).toBe('unlisted');

      const uploadInit = fetchMock.mock.calls[1][1] as RequestInit;
      expect(fetchMock.mock.calls[1][0]).toBe('https://upload.example/session');
      expect(uploadInit.method).toBe('PUT');
      expect(uploadInit.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        'Content-Type': 'video/webm',
        'Content-Range': `bytes 0-${video.size - 1}/${video.size}`,
      });
      expect(progress[progress.length - 1]).toMatchObject({ percent: 1, stage: 'complete' });
    });

    test('sets a custom video thumbnail after uploading the video', async () => {
      const fetchMock = createFetchMock();
      fetchMock
        .mockResolvedValueOnce(createResponse(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session' },
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'video-123' }), {
          status: 201,
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ items: [{ default: true }] }), {
          status: 200,
        }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });
      const thumbnail = new Blob(['image'], { type: 'image/png' });

      const result = await uploader.upload({
        video: new Blob(['video'], { type: 'video/webm' }),
        thumbnail,
        accessToken: 'token-123',
        metadata: { title: 'Audio visualizer' },
      });

      expect(result.thumbnail).toEqual({ items: [{ default: true }] });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2][0])).toBe(
        'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=video-123',
      );

      const thumbnailInit = fetchMock.mock.calls[2][1] as RequestInit;
      expect(thumbnailInit.method).toBe('POST');
      expect(thumbnailInit.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        'Content-Type': 'image/png',
      });
      expect(thumbnailInit.body).toBe(thumbnail);
    });

    test('adds the uploaded video to requested playlists', async () => {
      const fetchMock = createFetchMock();
      fetchMock
        .mockResolvedValueOnce(createResponse(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session' },
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'video-123' }), {
          status: 201,
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'playlist-item-123' }), {
          status: 200,
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'playlist-item-456' }), {
          status: 200,
        }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });
      const result = await uploader.upload({
        video: new Blob(['video'], { type: 'video/webm' }),
        accessToken: 'token-123',
        metadata: {
          title: 'Audio visualizer',
          playlistId: ' PL123 ',
          playlistIds: 'PL456, PL123',
        },
      });

      expect(result.playlistItem).toEqual({ id: 'playlist-item-123' });
      expect(result.playlistItems).toEqual([
        { id: 'playlist-item-123' },
        { id: 'playlist-item-456' },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(String(fetchMock.mock.calls[2][0])).toBe(
        'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
      );

      const firstPlaylistInit = fetchMock.mock.calls[2][1] as RequestInit;
      expect(firstPlaylistInit.method).toBe('POST');
      expect(firstPlaylistInit.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json; charset=UTF-8',
      });
      expect(JSON.parse(firstPlaylistInit.body as string)).toEqual({
        snippet: {
          playlistId: 'PL123',
          resourceId: {
            kind: 'youtube#video',
            videoId: 'video-123',
          },
        },
      });

      const secondPlaylistInit = fetchMock.mock.calls[3][1] as RequestInit;
      expect(JSON.parse(secondPlaylistInit.body as string).snippet.playlistId).toBe('PL456');
    });

    test('continues after a 308 resumable response', async () => {
      const fetchMock = createFetchMock();
      fetchMock
        .mockResolvedValueOnce(createResponse(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session' },
        }))
        .mockResolvedValueOnce(createResponse(null, {
          status: 308,
          headers: { Range: 'bytes=0-262143' },
        }))
        .mockResolvedValueOnce(createResponse(JSON.stringify({ id: 'video-456' }), {
          status: 201,
        }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });
      const video = new Blob([new Uint8Array(300 * 1024)], { type: 'video/webm' });

      await uploader.upload({
        video,
        accessToken: 'token-123',
        metadata: { title: 'Chunked upload' },
        chunkSize: 256 * 1024,
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
        'Content-Range': `bytes 0-262143/${video.size}`,
      });
      expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
        'Content-Range': `bytes 262144-${video.size - 1}/${video.size}`,
      });
    });

    test('throws a descriptive error for API failures', async () => {
      const fetchMock = createFetchMock();
      fetchMock.mockResolvedValueOnce(createResponse(JSON.stringify({
        error: { message: 'Quota exceeded' },
      }), { status: 403 }));

      const uploader = new YouTubeUploader({ fetch: fetchMock });

      await expect(uploader.upload({
        video: new Blob(['video'], { type: 'video/webm' }),
        accessToken: 'token-123',
        metadata: { title: 'Failed upload' },
      })).rejects.toThrow('Quota exceeded');
    });

    test('rejects empty videos before calling the API', async () => {
      const fetchMock = createFetchMock();
      const uploader = new YouTubeUploader({ fetch: fetchMock });

      await expect(uploader.upload({
        video: new Blob([], { type: 'video/webm' }),
        accessToken: 'token-123',
        metadata: { title: 'Empty upload' },
      })).rejects.toThrow('Video file is empty');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
