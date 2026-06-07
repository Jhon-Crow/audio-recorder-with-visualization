/**
 * Browser-friendly YouTube Data API upload helper.
 */

export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
export const YOUTUBE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const YOUTUBE_THUMBNAIL_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set';
export const YOUTUBE_PLAYLIST_ITEMS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';
export const YOUTUBE_SHORT_HASHTAG = '#shorts';

const DEFAULT_CATEGORY_ID = '10';
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const MIN_CHUNK_SIZE = 256 * 1024;

export type YouTubePrivacyStatus = 'private' | 'unlisted' | 'public';
export type YouTubeUploadStage = 'starting' | 'session' | 'uploading' | 'complete';

export interface YouTubeUploadMetadata {
  title: string;
  description?: string;
  tags?: string[] | string;
  categoryId?: string;
  privacyStatus?: YouTubePrivacyStatus;
  selfDeclaredMadeForKids?: boolean;
  containsSyntheticMedia?: boolean;
  publishAt?: string | Date;
  short?: boolean;
  playlistId?: string;
}

export interface YouTubeUploadProgress {
  loaded: number;
  total: number;
  percent: number;
  stage: YouTubeUploadStage;
}

export interface YouTubeUploadRequest {
  video: Blob;
  thumbnail?: Blob;
  accessToken: string;
  metadata: YouTubeUploadMetadata;
  notifySubscribers?: boolean;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: YouTubeUploadProgress) => void;
}

export interface YouTubeUploadResult {
  id: string;
  url: string;
  thumbnail?: unknown;
  playlistItem?: unknown;
  rawResponse: unknown;
}

export interface YouTubeVideoResource {
  snippet: {
    title: string;
    description: string;
    tags?: string[];
    categoryId: string;
  };
  status: {
    privacyStatus: YouTubePrivacyStatus;
    selfDeclaredMadeForKids: boolean;
    containsSyntheticMedia?: boolean;
    publishAt?: string;
  };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface YouTubeUploaderConfig {
  fetch?: FetchLike;
  uploadEndpoint?: string;
  thumbnailUploadEndpoint?: string;
  playlistItemsEndpoint?: string;
}

export class YouTubeUploadError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'YouTubeUploadError';
    this.status = status;
    this.details = details;
  }
}

export function normalizeYouTubeTags(tags?: string[] | string): string[] {
  if (!tags) {
    return [];
  }

  const rawTags = Array.isArray(tags) ? tags : tags.split(',');
  const normalized: string[] = [];
  const seen = new Set<string>();
  let totalLength = 0;

  rawTags.forEach((tag) => {
    const value = tag.replace(/\s+/g, ' ').trim();
    const key = value.toLowerCase();

    if (!value || seen.has(key)) {
      return;
    }

    const nextTotalLength = totalLength + value.length + (normalized.length > 0 ? 1 : 0);
    if (nextTotalLength > 500) {
      return;
    }

    normalized.push(value);
    seen.add(key);
    totalLength = nextTotalLength;
  });

  return normalized;
}

export function appendShortHashtag(
  description = '',
  enabled = true,
  hashtag = YOUTUBE_SHORT_HASHTAG
): string {
  if (!enabled) {
    return description;
  }

  const trimmedDescription = description.trim();
  if (/(^|\s)#shorts?\b/i.test(trimmedDescription)) {
    return trimmedDescription;
  }

  if (!trimmedDescription) {
    return hashtag;
  }

  return `${trimmedDescription}\n\n${hashtag}`;
}

export function buildYouTubeVideoResource(metadata: YouTubeUploadMetadata): YouTubeVideoResource {
  const title = metadata.title.trim();
  if (!title) {
    throw new YouTubeUploadError('Video title is required');
  }

  const tags = normalizeYouTubeTags(metadata.tags);
  const publishAt = normalizePublishAt(metadata.publishAt);
  const resource: YouTubeVideoResource = {
    snippet: {
      title,
      description: appendShortHashtag(metadata.description || '', metadata.short === true),
      categoryId: (metadata.categoryId || DEFAULT_CATEGORY_ID).trim() || DEFAULT_CATEGORY_ID,
    },
    status: {
      privacyStatus: publishAt ? 'private' : metadata.privacyStatus || 'private',
      selfDeclaredMadeForKids: metadata.selfDeclaredMadeForKids === true,
    },
  };

  if (tags.length > 0) {
    resource.snippet.tags = tags;
  }

  if (metadata.containsSyntheticMedia !== undefined) {
    resource.status.containsSyntheticMedia = metadata.containsSyntheticMedia === true;
  }

  if (publishAt) {
    resource.status.publishAt = publishAt;
  }

  return resource;
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export class YouTubeUploader {
  private readonly fetchImpl?: FetchLike;
  private readonly uploadEndpoint: string;
  private readonly thumbnailUploadEndpoint: string;
  private readonly playlistItemsEndpoint: string;

  constructor(config: YouTubeUploaderConfig = {}) {
    this.fetchImpl = config.fetch;
    this.uploadEndpoint = config.uploadEndpoint || YOUTUBE_UPLOAD_ENDPOINT;
    this.thumbnailUploadEndpoint = config.thumbnailUploadEndpoint || YOUTUBE_THUMBNAIL_UPLOAD_ENDPOINT;
    this.playlistItemsEndpoint = config.playlistItemsEndpoint || YOUTUBE_PLAYLIST_ITEMS_ENDPOINT;
  }

  async upload(request: YouTubeUploadRequest): Promise<YouTubeUploadResult> {
    if (!request.accessToken.trim()) {
      throw new YouTubeUploadError('Google access token is required');
    }

    if (request.video.size <= 0) {
      throw new YouTubeUploadError('Video file is empty');
    }

    const fetchImpl = this.getFetch();
    const resource = buildYouTubeVideoResource(request.metadata);
    const contentType = request.video.type || 'application/octet-stream';
    const uploadUrl = await this.startResumableSession(
      fetchImpl,
      request.accessToken,
      resource,
      request.video.size,
      contentType,
      request.notifySubscribers,
      request.signal
    );

    request.onProgress?.({
      loaded: 0,
      total: request.video.size,
      percent: 0,
      stage: 'session',
    });

    const result = await this.uploadChunks(fetchImpl, uploadUrl, request, contentType);

    if (request.thumbnail && request.thumbnail.size > 0) {
      result.thumbnail = await this.uploadThumbnail(
        fetchImpl,
        request.accessToken,
        result.id,
        request.thumbnail,
        request.signal
      );
    }

    const playlistId = request.metadata.playlistId?.trim();
    if (playlistId) {
      result.playlistItem = await this.addVideoToPlaylist(
        fetchImpl,
        request.accessToken,
        playlistId,
        result.id,
        request.signal
      );
    }

    return result;
  }

  private getFetch(): FetchLike {
    const fetchImpl = this.fetchImpl || globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) {
      throw new YouTubeUploadError('Fetch API is not available in this environment');
    }
    return fetchImpl;
  }

  private async startResumableSession(
    fetchImpl: FetchLike,
    accessToken: string,
    resource: YouTubeVideoResource,
    contentLength: number,
    contentType: string,
    notifySubscribers?: boolean,
    signal?: AbortSignal
  ): Promise<string> {
    const url = new URL(this.uploadEndpoint);
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('part', 'snippet,status');
    if (notifySubscribers !== undefined) {
      url.searchParams.set('notifySubscribers', String(notifySubscribers));
    }

    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(contentLength),
        'X-Upload-Content-Type': contentType,
      },
      body: JSON.stringify(resource),
      signal,
    });

    if (!response.ok) {
      throw await this.createError(response, 'Unable to start YouTube upload session');
    }

    const location = response.headers.get('Location');
    if (!location) {
      throw new YouTubeUploadError('YouTube upload session did not return a Location header', response.status);
    }

    return location;
  }

  private async uploadChunks(
    fetchImpl: FetchLike,
    uploadUrl: string,
    request: YouTubeUploadRequest,
    contentType: string
  ): Promise<YouTubeUploadResult> {
    const total = request.video.size;
    const chunkSize = normalizeChunkSize(request.chunkSize || DEFAULT_CHUNK_SIZE);
    let offset = 0;

    request.onProgress?.({ loaded: 0, total, percent: 0, stage: 'starting' });

    while (offset < total) {
      const end = Math.min(offset + chunkSize, total) - 1;
      const chunk = request.video.slice(offset, end + 1, contentType);
      const response = await fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${request.accessToken}`,
          'Content-Type': contentType,
          'Content-Range': `bytes ${offset}-${end}/${total}`,
        },
        body: chunk,
        signal: request.signal,
      });

      if (response.status === 308) {
        offset = getNextOffset(response.headers.get('Range'), end);
        request.onProgress?.({
          loaded: Math.min(offset, total),
          total,
          percent: Math.min(offset / total, 1),
          stage: 'uploading',
        });
        continue;
      }

      if (response.ok) {
        const rawResponse = await readResponseBody(response);
        const id = getVideoId(rawResponse);
        if (!id) {
          throw new YouTubeUploadError('YouTube upload response did not include a video id', response.status, rawResponse);
        }

        request.onProgress?.({ loaded: total, total, percent: 1, stage: 'complete' });
        return {
          id,
          url: getYouTubeWatchUrl(id),
          rawResponse,
        };
      }

      throw await this.createError(response, 'YouTube upload failed');
    }

    throw new YouTubeUploadError('YouTube upload ended before a completion response was received');
  }

  private async createError(response: Response, fallbackMessage: string): Promise<YouTubeUploadError> {
    const details = await readResponseBody(response);
    const message = extractErrorMessage(details) || fallbackMessage;
    return new YouTubeUploadError(message, response.status, details);
  }

  private async uploadThumbnail(
    fetchImpl: FetchLike,
    accessToken: string,
    videoId: string,
    thumbnail: Blob,
    signal?: AbortSignal
  ): Promise<unknown> {
    const url = new URL(this.thumbnailUploadEndpoint);
    url.searchParams.set('videoId', videoId);

    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': thumbnail.type || 'application/octet-stream',
      },
      body: thumbnail,
      signal,
    });

    if (!response.ok) {
      throw await this.createError(response, 'Unable to set YouTube video thumbnail');
    }

    return readResponseBody(response);
  }

  private async addVideoToPlaylist(
    fetchImpl: FetchLike,
    accessToken: string,
    playlistId: string,
    videoId: string,
    signal?: AbortSignal
  ): Promise<unknown> {
    const url = new URL(this.playlistItemsEndpoint);
    url.searchParams.set('part', 'snippet');

    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      }),
      signal,
    });

    if (!response.ok) {
      throw await this.createError(response, 'Unable to add YouTube video to playlist');
    }

    return readResponseBody(response);
  }
}

function normalizeChunkSize(chunkSize: number): number {
  if (!Number.isFinite(chunkSize) || chunkSize < MIN_CHUNK_SIZE) {
    return MIN_CHUNK_SIZE;
  }

  return Math.floor(chunkSize / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE;
}

function normalizePublishAt(publishAt?: string | Date): string | undefined {
  if (!publishAt) {
    return undefined;
  }

  const date = publishAt instanceof Date ? publishAt : new Date(publishAt);
  if (Number.isNaN(date.getTime())) {
    throw new YouTubeUploadError('Scheduled publish date is invalid');
  }

  return date.toISOString();
}

function getNextOffset(rangeHeader: string | null, fallbackEnd: number): number {
  if (!rangeHeader) {
    return fallbackEnd + 1;
  }

  const match = /bytes=\d+-(\d+)/.exec(rangeHeader);
  if (!match) {
    return fallbackEnd + 1;
  }

  return parseInt(match[1], 10) + 1;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getVideoId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.id === 'string' ? value.id : null;
}

function extractErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const error = value.error;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return typeof value.message === 'string' ? value.message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
