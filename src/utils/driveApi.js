import { getStoredToken } from './auth';

// 1. Base API Fetch Helper
export const fetchDriveApi = async (endpoint, options = {}) => {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Google OAuth token missing or expired.');
  }

  const defaultHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  return response;
};

// 2. Find or Create Application Folder in Google Drive
export const getOrCreateSpireFolder = async (folderName = 'SPIRE') => {
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  // Check if folder exists
  const searchResponse = await fetchDriveApi(`/drive/v3/files?q=${query}&fields=files(id,name)`);
  if (!searchResponse.ok) {
    throw new Error('Failed to query Google Drive folders.');
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id; // Return existing folder ID
  }

  // Folder doesn't exist -> Create it
  const createResponse = await fetchDriveApi('/drive/v3/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    throw new Error('Failed to create folder in Google Drive.');
  }

  const newFolder = await createResponse.json();
  return newFolder.id;
};
// Fetch audio file content as a secure Blob URL for the audio player
export const fetchAudioBlobUrl = async (fileId) => {
  const response = await fetchDriveApi(`/drive/v3/files/${fileId}?alt=media`);
  if (!response.ok) {
    throw new Error('Failed to stream audio binary from Google Drive.');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};