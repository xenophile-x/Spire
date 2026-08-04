export const extractMetadataFromFilename = (filename) => {
  if (!filename) return { title: 'Unknown Track', artist: 'Unknown Artist' };

  // Strip file extension
  const cleanName = filename.replace(/\.[^/.]+$/, '');

  // Check for "Artist - Title" pattern
  if (cleanName.includes('-')) {
    const parts = cleanName.split('-');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join('-').trim(),
    };
  }

  return {
    title: cleanName.trim(),
    artist: 'Unknown Artist',
  };
};