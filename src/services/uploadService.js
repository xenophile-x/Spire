import { getValidDriveToken, refreshDriveAccessToken } from "../utils/driveApi";

export const uploadAudioToDrive = async (file, metadata = {}, isRetry = false) => {
  const token = await getValidDriveToken();
  if (!token) throw new Error("Authentication required.");

  const fileMetadata = {
    name: metadata.title ? `${metadata.artist} - ${metadata.title}` : file.name,
    mimeType: file.type || "audio/mpeg",
    description: JSON.stringify(metadata),
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(fileMetadata)], { type: "application/json" })
  );
  formData.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (response.status === 401 && !isRetry) {
    const freshToken = await refreshDriveAccessToken();
    if (freshToken) return uploadAudioToDrive(file, metadata, true);
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Drive Upload failed.");
  }

  return await response.json();
};