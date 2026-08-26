import {
  getValidDriveToken,
  refreshDriveAccessToken,
} from "@/utils/driveApi";

const MUSIC_FOLDER_NAME = "Spire_Music_Songs";
const BACKGROUND_FOLDER_NAME = "Spire_Backgrounds";
const KARAOKE_FOLDER_NAME = "Spire_Karaoke_Recordings";

export class DriveQuotaError extends Error {
  constructor(message = "") {
    super(
      message ||
        "Your Google Drive storage is full. Free up space in Google Drive and try again."
    );
    this.name = "DriveQuotaError";
  }
}

export async function getDriveErrorInfo(response) {
  if (!response) return null;
  try {
    const data = await response.clone().json();
    const reason =
      data?.error?.errors?.[0]?.reason ||
      data?.error?.reason ||
      data?.error?.status ||
      "";
    const message = data?.error?.message || "";
    if (
      response.status === 507 ||
      String(reason).toLowerCase().includes("storagequota") ||
      String(reason).toLowerCase().includes("quota")
    ) {
      return { isQuota: true, message };
    }
    return { isQuota: false, message };
  } catch {
    return response.status === 507 ? { isQuota: true, message: "" } : null;
  }
}

async function throwUploadError(response, fallback) {
  const info = await getDriveErrorInfo(response);
  if (info?.isQuota) {
    throw new DriveQuotaError(info.message);
  }
  throw new Error(info?.message || fallback);
}

async function resolveToken(fallbackToken) {
  const valid = await getValidDriveToken();
  return valid || fallbackToken || "";
}

async function driveFetch(url, init = {}, fallbackToken) {
  const token = await resolveToken(fallbackToken);
  if (!token) throw new Error("No Google access token available.");

  const request = (t) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` },
    });

  let response = await request(token);


  if (response.status === 401) {
    const fresh = await refreshDriveAccessToken();
    if (fresh) {
      response = await request(fresh);
    } else {
      throw new Error("UNAUTHORIZED");
    }
  }

  return response;
}

export async function getDriveAudioBlobUrl(fileId, accessToken) {
  if (!fileId) return "";

  try {
    const blob = await getDriveFileBlob(fileId, accessToken);
    return blob ? URL.createObjectURL(blob) : "";
  } catch (err) {
    console.error("Error creating audio blob from Drive:", err);
    return null;
  }
}

export async function getDriveFileBlob(fileId, accessToken, mimeType = "") {
  if (!fileId) return null;

  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {},
    accessToken
  );

  if (!response.ok) {
    throw new Error(`Drive fetch failed with status ${response.status}`);
  }

  const blob = await response.blob();


  if (
    mimeType &&
    (!blob.type || blob.type === "application/octet-stream")
  ) {
    return new Blob([blob], { type: mimeType });
  }
  return blob;
}

export async function getOrCreateFolder(folderName, accessToken) {
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`,
    {},
    accessToken
  );
  if (!searchRes.ok) {
    throw new Error(
      `Drive folder search failed with status ${searchRes.status}`
    );
  }
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await driveFetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
    accessToken
  );

  if (!createRes.ok) {
    throw new Error(
      `Drive folder creation failed with status ${createRes.status}`
    );
  }
  const createData = await createRes.json();
  if (!createData.id) {
    throw new Error("Drive folder creation returned no folder ID.");
  }
  return createData.id;
}

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

  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      body: formData,
    },
    accessToken
  );

  if (!response.ok) {
    await throwUploadError(response, "Failed to upload audio file to Google Drive.");
  }

  const data = await response.json();
  return data.id;
}

export async function uploadBackgroundToDrive(file, accessToken, oldFileId = null) {
  if (oldFileId) {
    try {
      await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${oldFileId}`,
        { method: "DELETE" },
        accessToken
      );
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

  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      body: formData,
    },
    accessToken
  );

  if (!response.ok) {
    await throwUploadError(response, "Failed to upload wallpaper to Google Drive.");
  }

  const data = await response.json();
  return data.id;
}

export async function uploadRecordingToDrive(file, accessToken) {
  const folderId = await getOrCreateFolder(KARAOKE_FOLDER_NAME, accessToken);

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

  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      body: formData,
    },
    accessToken
  );

  if (!response.ok) {
    await throwUploadError(
      response,
      "Failed to upload karaoke recording to Google Drive."
    );
  }

  const data = await response.json();
  return data.id;
}

export async function deleteDriveFile(fileId, accessToken) {
  if (!fileId) return;
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: "DELETE" },
    accessToken
  );
  if (!response.ok) {
    throw new Error(`Failed to delete Drive file: ${response.status}`);
  }
}

export async function fetchAudioFilesFromDrive(accessToken) {
  if (!accessToken) {
    const valid = await getValidDriveToken();
    if (!valid) throw new Error("No Google access token provided.");
  }

  const query = "mimeType contains 'audio/' and trashed = false";
  const baseUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink)&pageSize=100`;

  const files = [];
  let pageToken = null;


  do {
    const url = `${baseUrl}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const response = await driveFetch(url, {}, accessToken);

    if (!response.ok) {
      throw new Error(`Failed to list Google Drive files: ${response.statusText}`);
    }

    const data = await response.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return files.map((file) => ({
    id: file.id,
    drive_file_id: file.id,
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Drive Library",
    album: "Google Drive",
    cover: file.thumbnailLink || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300",
    artworkUrl: file.thumbnailLink || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300",
    synced_lyrics: "",
  }));
}