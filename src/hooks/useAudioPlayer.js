import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const audioRef = useRef(new Audio());

  // State
  const [currentTrack, setCurrentTrack] = useState(null); // Full track object
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); // 0.0 to 1.0
  const [error, setError] = useState(null);

  // Active Blob URL cleanup reference
  const currentBlobUrlRef = useRef(null);

  // Clean up object URL when switching tracks or unmounting
  const cleanupBlobUrl = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  /**
   * Fetches the Google Drive file binary using the access token
   * and creates a local Blob Object URL for streaming playback.
   */
  const fetchDriveAudioBlobUrl = async (driveFileId, refreshToken) => {
    let token = localStorage.getItem('google_drive_access_token');
    if (!token) {
      throw new Error('Google Drive access token missing.');
    }

    let response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 && refreshToken) {
      const newToken = await refreshToken();
      if (newToken) {
        token = newToken;
        response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch audio stream (${response.status})`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  /**
   * Main method to play a track from a user_tracks database item
   * @param {Object} trackData - Combined object with track details & drive_file_id
   */
  const playTrack = useCallback(async (trackData) => {
    const audio = audioRef.current;

    try {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);

      // Stop current playback & cleanup previous blob URL
      audio.pause();
      cleanupBlobUrl();

      setCurrentTrack(trackData);

      // Fetch file as blob from Google Drive REST API
      const blobUrl = await fetchDriveAudioBlobUrl(trackData.drive_file_id);
      currentBlobUrlRef.current = blobUrl;

      audio.src = blobUrl;
      audio.load();

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback Error:', err);
      setError(err.message || 'Failed to play track');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [cleanupBlobUrl]);

  // Controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.src) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => setError(err.message));
    }
  }, [isPlaying]);

  const seek = useCallback((timeInSeconds) => {
    const audio = audioRef.current;
    if (audio.src) {
      audio.currentTime = timeInSeconds;
      setCurrentTime(timeInSeconds);
    }
  }, []);

  const changeVolume = useCallback((newVolume) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(1, newVolume));
    audio.volume = clamped;
    setVolume(clamped);
  }, []);

  // Sync HTML5 Audio element events with React state
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => {
      console.error('Audio element error:', e);
      setError('Playback failed on HTML5 Audio Element.');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      audio.pause();
      cleanupBlobUrl();
    };
  }, [cleanupBlobUrl]);

  return {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    error,
    playTrack,
    togglePlay,
    seek,
    changeVolume,
  };
}
