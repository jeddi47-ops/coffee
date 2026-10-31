// Redimensionnement et conversion WebP dans le navigateur avant envoi vers Storage.
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public reason: "type" | "decode" | "too_large") {
    super(reason);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/** Largeur max 1200 px (par défaut), WebP, qualité réduite jusqu'à passer sous 2 Mo. */
export async function toWebp(file: File, maxWidth = 1200): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new ImageError("type");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError("decode");
  }
  let width = Math.min(maxWidth, bitmap.width);
  for (let attempt = 0; attempt < 6; attempt++) {
    const height = Math.round((bitmap.height * width) / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("decode");
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.type === "image/webp" && blob.size <= MAX_BYTES) {
        bitmap.close();
        return blob;
      }
    }
    width = Math.round(width * 0.8);
  }
  bitmap.close();
  throw new ImageError("too_large");
}
