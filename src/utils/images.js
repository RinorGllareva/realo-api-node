import sharp from "sharp";

const DEFAULT_IMAGE_TARGET_WIDTH = 2400;
const DEFAULT_IMAGE_QUALITY = 88;

function normalizeOrigin(origin) {
  return String(origin || "").replace(/\/+$/, "");
}

export function apiOrigin() {
  const configuredOrigin =
    process.env.PUBLIC_API_ORIGIN ||
    process.env.VITE_API_URL ||
    process.env.LOCAL_API_ORIGIN;
  if (configuredOrigin) return normalizeOrigin(configuredOrigin);

  return "https://api.realo-realestate.com";
}

export function imageApiUrl(imageId) {
  if (!imageId) return "";
  return `${apiOrigin()}/api/Property/GetPropertyImage/${imageId}`;
}

export function hasDatabaseImage(image) {
  return !!(image?.HasImageData || image?.hasImageData || image?.ImageData);
}

export function preferredImageUrl(image) {
  const imageId = image?.ImageId ?? image?.imageId;
  if (imageId && hasDatabaseImage(image)) return imageApiUrl(imageId);
  return image?.ImageUrl || image?.imageUrl || "";
}

export async function processImageBuffer(input) {
  const targetWidth = Number(process.env.IMAGE_TARGET_WIDTH || DEFAULT_IMAGE_TARGET_WIDTH);
  const quality = Number(process.env.IMAGE_JPEG_QUALITY || DEFAULT_IMAGE_QUALITY);
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);

  const output = await sharp(source, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: targetWidth })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(output).metadata();
  return {
    buffer: output,
    mimeType: "image/jpeg",
    width: meta.width || null,
    height: meta.height || null,
  };
}

export async function remoteImageToRecord(imageUrl) {
  if (!/^https?:\/\//i.test(String(imageUrl || ""))) {
    throw new Error(`Invalid remote image URL: ${imageUrl}`);
  }

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 45000)),
  });
  if (!response.ok) throw new Error(`Failed to fetch image ${imageUrl}: ${response.status}`);

  const input = Buffer.from(await response.arrayBuffer());
  const processed = await processImageBuffer(input);
  return {
    ...processed,
    originalUrl: imageUrl,
  };
}
