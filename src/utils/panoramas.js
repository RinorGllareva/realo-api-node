import sharp from "sharp";
import { apiOrigin } from "./images.js";

export function panoramaApiUrl(roomId) {
  if (!roomId) return "";
  return `${apiOrigin()}/api/VirtualTour/GetPanorama/${roomId}`;
}

export async function processPanoramaBuffer(input) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const image = sharp(source, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  const meta = await image.metadata();
  const targetWidth = Number(process.env.PANORAMA_MAX_WIDTH || 4096);
  const shouldResize = meta.width && meta.width > targetWidth;
  const output = await image
    .resize(shouldResize ? { width: targetWidth } : undefined)
    .jpeg({ quality: Number(process.env.PANORAMA_JPEG_QUALITY || 90), mozjpeg: true })
    .toBuffer();
  const processedMeta = await sharp(output).metadata();

  return {
    buffer: output,
    mimeType: "image/jpeg",
    width: processedMeta.width || null,
    height: processedMeta.height || null,
  };
}
