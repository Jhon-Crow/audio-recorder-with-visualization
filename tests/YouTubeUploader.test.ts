import {
  YouTubeUploadError,
  YouTubeUploader,
  appendShortHashtag,
  buildYouTubeVideoResource,
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

    test('appends #short to descriptions only when enabled and not already present', () => {
      expect(appendShortHashtag('Demo description', true)).toBe('Demo description\n\n#short');
      expect(appendShortHashtag('Demo #shorts', true)).toBe('Demo #shorts');
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
          description: 'Rendered with the app\n\n#short',
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
      expect(sessionBody.snippet.description).toBe('Demo\n\n#short');
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
