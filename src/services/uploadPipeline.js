import { uploadToGoogleDrive } from "./driveService";
import { registerTrackInSupabase } from "./supabaseService";
import { matchItunesMetadata, cleanTrackTitle } from "./itunesService";
import { fetchLyrics } from "./lyricsService";

// Utility to calculate real duration from the uploaded audio file
function getAudioFileDuration(file) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(objectUrl);
        resolve(Number.isFinite(duration) ? duration : 0);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(0);
      };
    } catch {
      resolve(0);
    }
  });
}

export async function processAudioUpload(file, user, accessToken, onProgress) {
  const fileNameStr = String(file?.name || "audio.mp3");
  const userIdStr = user?.id ? String(user.id) : null;
  const fallbackImg =
    "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=600";

  // Get real local audio file duration
  const localDurationSeconds = await getAudioFileDuration(file);

  // 1. iTunes Metadata Search
  onProgress?.({ step: 1, percent: 20, message: "Matching iTunes metadata..." });
  const itunesData = await matchItunesMetadata(fileNameStr);

  let trackInfo;
  let itunesTrackId = null;
  if (itunesData) {
    itunesTrackId = itunesData.trackId ? String(itunesData.trackId) : null;
    trackInfo = {
      title: itunesData.trackName,
      artist: itunesData.artistName,
      album: itunesData.collectionName,
      artworkUrl: itunesData.artworkUrl || fallbackImg,
      artistPhotoUrl: itunesData.artworkUrl || fallbackImg,
      primaryGenre: itunesData.primaryGenreName,
      durationSeconds:
        localDurationSeconds || Math.round(itunesData.trackTimeMillis / 1000),
    };
  } else {
    // Fallback parsing from filename if iTunes yields no result
    const cleaned = cleanTrackTitle(fileNameStr);
    const parts = cleaned.split("-");
    trackInfo = {
      title: String((parts[1] || parts[0] || "Unknown Track").trim()),
      artist: String((parts[1] ? parts[0] : "Unknown Artist").trim()),
      album: "Uploaded Single",
      artworkUrl: fallbackImg,
      artistPhotoUrl: fallbackImg,
      primaryGenre: "Music",
      durationSeconds: localDurationSeconds || 0,
    };
  }

  // 2. Lyrics Lookup
  onProgress?.({ step: 2, percent: 40, message: "Searching for lyrics on LRCLIB..." });
  const lyricsResult = await fetchLyrics({
    title: trackInfo.title,
    artist: trackInfo.artist,
    album: trackInfo.album,
    duration: trackInfo.durationSeconds,
  });

  const lyricsData = {
    syncedLyrics: lyricsResult?.synced || "",
    plainLyrics: lyricsResult?.plain || "",
    isSynced: Boolean(lyricsResult?.isSynced),
  };

  // 3. Save to Google Drive
  onProgress?.({ step: 3, percent: 70, message: "Uploading audio to Google Drive..." });
  let driveFileId = null;
  try {
    driveFileId = await uploadToGoogleDrive(file, accessToken);
  } catch (err) {
    console.error("Google Drive upload failure:", err);
    throw new Error("Failed to upload audio to Google Drive.");
  }

  // 4. Register Track in Supabase
  onProgress?.({ step: 4, percent: 90, message: "Registering in Supabase library..." });
  let userTrackRecord = null;
  try {
    userTrackRecord = await registerTrackInSupabase({
      userId: userIdStr,
      driveFileId: String(driveFileId),
      filename: fileNameStr,
      trackInfo,
      lyricsData,
      trackId: itunesTrackId,
    });
  } catch (err) {
    console.error("SUPABASE REGISTRATION ERROR:", err);
    throw new Error(err?.message || "Database registration failed.");
  }

  onProgress?.({ step: 5, percent: 100, message: "Upload completed!" });

  return {
    driveFileId,
    track: trackInfo,
    lyrics: lyricsData,
    userTrackRecord,
  };
}
// Fetches high-resolution album artwork from the iTunes Search API
export async function fetchArtworkFromITunes(title, artist) {
  if (!title) return null;

  try {
    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const query = encodeURIComponent(`${cleanTitle} ${artist !== "Unknown Artist" ? artist : ""}`);
    
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Upgrade 100x100 resolution URL to high-res 600x600 artwork
      const rawArtwork = data.results[0].artworkUrl100;
      return rawArtwork ? rawArtwork.replace("100x100bb", "600x600bb") : null;
    }
  } catch (err) {
    console.warn("iTunes artwork fetch failed:", err);
  }

  return null;
}