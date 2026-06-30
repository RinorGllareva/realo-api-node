import sharp from "sharp";
import { apiOrigin } from "./images.js";

const DEFAULT_MAX_PANORAMA_INPUT_BYTES = 100 * 1024 * 1024;

function panoramaError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.publicMessage = message;
  return err;
}

export function panoramaApiUrl(roomId) {
  if (!roomId) return "";
  return `${apiOrigin()}/api/VirtualTour/GetPanorama/${roomId}`;
}

export async function processPanoramaBuffer(input) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const maxBytes = Number(process.env.PANORAMA_MAX_INPUT_BYTES || DEFAULT_MAX_PANORAMA_INPUT_BYTES);
  if (!source.length) throw panoramaError("Panorama file is empty.");
  if (source.length > maxBytes) {
    throw panoramaError(`Panorama image is too large. Maximum upload size is ${Math.round(maxBytes / 1024 / 1024)}MB.`, 413);
  }

  let image;
  let meta;
  try {
    image = sharp(source, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
    meta = await image.metadata();
  } catch {
    throw panoramaError("The uploaded panorama is not a readable image.");
  }
  const targetWidth = Number(process.env.PANORAMA_MAX_WIDTH || 4096);
  const shouldResize = meta.width && meta.width > targetWidth;
  let output;
  try {
    output = await image
      .resize(shouldResize ? { width: targetWidth } : undefined)
      .jpeg({ quality: Number(process.env.PANORAMA_JPEG_QUALITY || 90), mozjpeg: true })
      .toBuffer();
  } catch {
    throw panoramaError("The uploaded panorama could not be processed.");
  }
  const processedMeta = await sharp(output).metadata();

  return {
    buffer: output,
    mimeType: "image/jpeg",
    width: processedMeta.width || null,
    height: processedMeta.height || null,
  };
}
