


export const isVideoUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  if (url.includes("/download/video/")) return true;
  try {
    const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
    return /\.(mp4|webm|mov|m4v|ogv)$/.test(pathname);
  } catch {
    return false;
  }
};

export const getUltraQualityUnsplashUrl = (url) => {
  if (!url || !url.includes("images.unsplash.com")) return url;

  const baseUrl = url.split("?")[0];
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    w: "2560",
    q: "80",
    dpr: "1",
  });

  return `${baseUrl}?${params.toString()}`;
};


export const getOptimizedUnsplashUrl = (url, options = {}) => {
  if (!url || !url.includes("images.unsplash.com")) return url;

  const {
    width = 1920,
    quality = 85,
    saturation = 15,
    contrast = 10,
    brightness = -5,
    blur = 0,
  } = options;

  const baseUrl = url.split("?")[0];
  const params = new URLSearchParams({
    auto: "format,compress",
    fit: "crop",
    w: width.toString(),
    q: quality.toString(),
  });

  if (saturation) params.set("sat", saturation.toString());
  if (contrast) params.set("con", contrast.toString());
  if (brightness) params.set("bri", brightness.toString());
  if (blur > 0) params.set("blur", blur.toString());

  return `${baseUrl}?${params.toString()}`;
};
