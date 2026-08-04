// src/utils/audioParser.js

/**
 * Extracts accurate audio duration (in seconds) from an uploaded File object.
 */
export function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(audio.duration || 0);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
  });
}