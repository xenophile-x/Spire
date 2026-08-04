// src/services/driveService.js

const MUSIC_FOLDER_NAME = "Spire_Music_Songs";
const BACKGROUND_FOLDER_NAME = "Spire_Backgrounds";

/**
 * Fetches Google Drive file as a Blob URL to bypass CORS 403 restrictions on <audio> elements.
 */
export async function getDriveAudioBlobUrl(fileId, accessToken) {
  if (!fileId || !accessToken) return "";

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Drive fetch failed with status ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Error creating audio blob from Drive:", err);
    return null;
  }
}

/**
 * Retrieves or creates a specific folder inside Google Drive.
 */
export async function getOrCreateFolder(folderName, accessToken) {
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Uploads audio track binary to Google Drive under 'Spire_Music_Songs'.
 */
export async function uploadToGoogleDrive(file, accessToken) {
  const folderId = await getOrCreateFolder(MUSIC_FOLDER_NAME, accessToken);

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to upload audio file to Google Drive.");
  }

  const data = await response.json();
  return data.id;
}

/**
 * Uploads a background wallpaper to Google Drive under 'Spire_Backgrounds'.
 */
export async function uploadBackgroundToDrive(file, accessToken, oldFileId = null) {
  if (oldFileId) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${oldFileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.warn("Could not delete previous background:", err);
    }
  }

  const folderId = await getOrCreateFolder(BACKGROUND_FOLDER_NAME, accessToken);

  const metadata = {
    name: `spire_bg_${Date.now()}.${file.name.split(".").pop()}`,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to upload wallpaper to Google Drive.");
  }

  const data = await response.json();
  return data.id;
}
// src/services/driveService.js

/**
 * Fetches all existing audio files directly from the user's Google Drive storage
 */
export async function fetchAudioFilesFromDrive(accessToken) {
  if (!accessToken) throw new Error("No Google access token provided.");

  // Query Drive API for files with audio MIME types
  const query = "mimeType contains 'audio/' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id, name, mimeType, size, createdTime, thumbnailLink)&pageSize=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list Google Drive files: ${response.statusText}`);
  }

  const data = await response.json();
  const files = data.files || [];

  // Format into standard track objects
  return files.map((file) => ({
    id: file.id,
    drive_file_id: file.id,
    title: file.name.replace(/\.[^/.]+$/, ""), // Strip file extension
    artist: "Drive Library",
    album: "Google Drive",
    cover: file.thumbnailLink || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300",
    artworkUrl: file.thumbnailLink || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300",
    synced_lyrics: "",
  }));
}