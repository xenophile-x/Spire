import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const audioRef = useRef(null);

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = 'anonymous';
  }

  const [currentTrack, setCurrentTrack] = useState(null); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); 
  const [error, setError] = useState(null);

  const buildDriveAudioUrl = useCallback((driveFileId, accessToken) => {
    if (!driveFileId) return null;
    const token = accessToken || localStorage.getItem('google_drive_access_token');
    if (!token) return null;
    return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&access_token=${encodeURIComponent(token)}`;
  }, []);

  const playTrack = useCallback(async (trackData) => {
    const audio = audioRef.current;

    try {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);

      audio.pause();

      setCurrentTrack(trackData);

      const audioUrl = trackData.url || trackData.src || buildDriveAudioUrl(trackData.drive_file_id);

      if (!audioUrl) {
        throw new Error('No audio source available for this track.');
      }

      audio.src = audioUrl;
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
  }, [buildDriveAudioUrl]);

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

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.pause();
    };
  }, []);

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

