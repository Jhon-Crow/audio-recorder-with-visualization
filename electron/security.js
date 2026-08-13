const path = require('path');

const ENCRYPTED_PREFIX = 'encrypted:';

function serializeYouTubeAuth(authState, safeStorage) {
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable');
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(authState));
  return `${ENCRYPTED_PREFIX}${encrypted.toString('base64')}`;
}

function deserializeYouTubeAuth(contents, safeStorage) {
  if (contents.startsWith(ENCRYPTED_PREFIX)) {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable');
    }
    const encrypted = Buffer.from(contents.slice(ENCRYPTED_PREFIX.length), 'base64');
    return { authState: JSON.parse(safeStorage.decryptString(encrypted)), needsMigration: false };
  }

  return { authState: JSON.parse(contents), needsMigration: true };
}

function resolveSafeRecordingPath(folderPath, fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    throw new Error('Recording filename is required');
  }

  const sanitized = path.basename(fileName)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/^\.+$/, 'recording');
  const filePath = path.join(folderPath, sanitized);
  const relativePath = path.relative(folderPath, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Recording filename must stay inside the selected folder');
  }
  return filePath;
}

module.exports = {
  deserializeYouTubeAuth,
  resolveSafeRecordingPath,
  serializeYouTubeAuth,
};
