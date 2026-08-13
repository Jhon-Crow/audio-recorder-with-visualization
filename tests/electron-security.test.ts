const {
  deserializeYouTubeAuth,
  resolveSafeRecordingPath,
  serializeYouTubeAuth,
} = require('../electron/security');
const path = require('path');

describe('Electron security helpers', () => {
  const safeStorage = {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((value: string) => Buffer.from(value).reverse()),
    decryptString: jest.fn((value: Buffer) => value.reverse().toString()),
  };

  test('encrypts stored YouTube authorization and reads it back', () => {
    const authState = { refreshToken: 'secret-token', scope: 'scope' };
    const serialized = serializeYouTubeAuth(authState, safeStorage);

    expect(serialized).toMatch(/^encrypted:/);
    expect(serialized).not.toContain('secret-token');
    expect(deserializeYouTubeAuth(serialized, safeStorage)).toEqual({
      authState,
      needsMigration: false,
    });
  });

  test('marks legacy plaintext authorization for migration', () => {
    const authState = { refreshToken: 'legacy-token' };
    expect(deserializeYouTubeAuth(JSON.stringify(authState), safeStorage)).toEqual({
      authState,
      needsMigration: true,
    });
  });

  test('fails closed when secure storage is unavailable', () => {
    const unavailableStorage = { isEncryptionAvailable: () => false };
    expect(() => serializeYouTubeAuth({ refreshToken: 'secret' }, unavailableStorage))
      .toThrow('Secure credential storage is unavailable');
  });

  test.each([
    ['../escaped.webm', 'escaped.webm'],
    ['subfolder/video.webm', 'video.webm'],
    ['bad:name?.webm', 'bad-name-.webm'],
    ['..', 'recording'],
  ])('contains recording filename %s as %s', (fileName, expected) => {
    const folderPath = path.join(path.parse(process.cwd()).root, 'selected', 'folder');
    expect(resolveSafeRecordingPath(folderPath, fileName))
      .toBe(path.join(folderPath, expected));
  });
});
