import { useEffect, useState } from "react";


export function useImageColor(src) {
  const [color, setColor] = useState(null);

  useEffect(() => {
    if (!src) {
      setColor(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];

          if (a < 16) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        if (count > 0 && !cancelled) {
          setColor(
            `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`
          );
        }
      } catch {
        if (!cancelled) setColor(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.removeAttribute("src");
    };
  }, [src]);

  return color;
}