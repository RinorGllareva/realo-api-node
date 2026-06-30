import sharp from "sharp";

const DEFAULT_IMAGE_TARGET_WIDTH = 2400;
const DEFAULT_IMAGE_QUALITY = 88;
const DEFAULT_MAX_IMAGE_INPUT_BYTES = 75 * 1024 * 1024;

function mediaError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.publicMessage = message;
  return err;
}

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
  const maxBytes = Number(process.env.IMAGE_MAX_INPUT_BYTES || DEFAULT_MAX_IMAGE_INPUT_BYTES);

  if (!source.length) throw mediaError("Image file is empty.");
  if (source.length > maxBytes) {
    throw mediaError(`Image is too large. Maximum upload size is ${Math.round(maxBytes / 1024 / 1024)}MB.`, 413);
  }

  let output;
  try {
    output = await sharp(source, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: targetWidth })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  } catch {
    throw mediaError("The uploaded file is not a readable image.");
  }

  const meta = await sharp(output).metadata();
  return {
    buffer: output,
    mimeType: "image/jpeg",
    width: meta.width || null,
    height: meta.height || null,
  };
}

export async function remoteImageToRecord(imageUrl) {
  const sourceUrl = String(imageUrl || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw mediaError("Image URL must start with http:// or https://.");
  }

  let response;
  try {
    response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 45000)),
    });
  } catch {
    throw mediaError("Could not download the image from that URL.", 400);
  }
  if (!response.ok) throw mediaError(`Could not download image from URL. Status ${response.status}.`, 400);

  const input = Buffer.from(await response.arrayBuffer());
  const processed = await processImageBuffer(input);
  return {
    ...processed,
    originalUrl: sourceUrl,
  };
}
