import { getDriveFileBlob } from "@/services/driveService";

const RECORDINGS_KEY = "spire_karaoke_recordings";

export function getSavedRecordings() {
  try {
    const raw = localStorage.getItem(RECORDINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecordingMeta(recording) {
  const list = getSavedRecordings();
  list.unshift(recording);
  try {
    localStorage.setItem(RECORDINGS_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export function removeRecordingMeta(recordingId) {
  const list = getSavedRecordings().filter((r) => r.id !== recordingId);
  try {
    localStorage.setItem(RECORDINGS_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export async function getRecordingPlaybackUrl(recording) {
  if (recording.localUrl) return recording.localUrl;
  try {
    const name = (recording.name || "").toLowerCase();
    const mime = name.endsWith(".mp4") || name.endsWith(".m4a")
      ? "audio/mp4"
      : "audio/webm";
    const blob = await getDriveFileBlob(recording.driveFileId, "", mime);
    return blob ? URL.createObjectURL(blob) : "";
  } catch (err) {
    console.error("[recordingsStore] Failed to load recording:", err);
    return "";
  }
}

export function triggerDownload(url, name) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "karaoke-recording";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatRecordingDuration(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
