import "dotenv/config";
import { getPool, sql } from "../src/db/mssql.js";
import { imageApiUrl, remoteImageToRecord } from "../src/utils/images.js";

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const batchSize = Number(process.env.IMAGE_BACKFILL_BATCH_SIZE || 10);
const dryRun = args.has("--dry-run");

function pickRows(rows) {
  if (!limit) return rows;
  return rows.slice(0, limit);
}

async function ensureImageColumns(pool) {
  await pool.request().query(`
    IF COL_LENGTH('PropertiesImage', 'OriginalUrl') IS NULL
      ALTER TABLE PropertiesImage ADD OriginalUrl NVARCHAR(1000) NULL;
    IF COL_LENGTH('PropertiesImage', 'ImageData') IS NULL
      ALTER TABLE PropertiesImage ADD ImageData VARBINARY(MAX) NULL;
    IF COL_LENGTH('PropertiesImage', 'MimeType') IS NULL
      ALTER TABLE PropertiesImage ADD MimeType NVARCHAR(100) NULL;
    IF COL_LENGTH('PropertiesImage', 'Width') IS NULL
      ALTER TABLE PropertiesImage ADD Width INT NULL;
    IF COL_LENGTH('PropertiesImage', 'Height') IS NULL
      ALTER TABLE PropertiesImage ADD Height INT NULL;
    IF COL_LENGTH('PropertiesImage', 'SortOrder') IS NULL
      ALTER TABLE PropertiesImage ADD SortOrder INT NOT NULL DEFAULT 0;
  `);
}

async function loadPendingRows(pool) {
  const result = await pool.request().query(`
    SELECT ImageId, PropertyId, ImageUrl, OriginalUrl
    FROM PropertiesImage
    WHERE ImageData IS NULL
      AND ImageUrl LIKE 'http%'
    ORDER BY ImageId ASC
  `);
  return pickRows(result.recordset || []);
}

async function updateImage(pool, row, processed) {
  const dbUrl = imageApiUrl(row.ImageId);
  await pool
    .request()
    .input("imageId", sql.Int, row.ImageId)
    .input("imageUrl", sql.NVarChar(1000), dbUrl)
    .input("originalUrl", sql.NVarChar(1000), row.OriginalUrl || row.ImageUrl)
    .input("imageData", sql.VarBinary(sql.MAX), processed.buffer)
    .input("mimeType", sql.NVarChar(100), processed.mimeType)
    .input("width", sql.Int, processed.width)
    .input("height", sql.Int, processed.height)
    .query(`
      UPDATE PropertiesImage
      SET ImageUrl=@imageUrl,
          OriginalUrl=@originalUrl,
          ImageData=@imageData,
          MimeType=@mimeType,
          Width=@width,
          Height=@height
      WHERE ImageId=@imageId
        AND ImageData IS NULL
    `);
}

async function main() {
  const pool = await getPool();
  await ensureImageColumns(pool);
  const pending = await loadPendingRows(pool);
  const failures = [];

  console.log(`Pending images: ${pending.length}${dryRun ? " (dry run)" : ""}`);

  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize);
    for (const row of batch) {
      try {
        const sourceUrl = row.OriginalUrl || row.ImageUrl;
        const processed = await remoteImageToRecord(sourceUrl);
        if (!dryRun) await updateImage(pool, row, processed);
        console.log(
          `[${index + batch.indexOf(row) + 1}/${pending.length}] ImageId ${row.ImageId}: ${processed.width}x${processed.height}`,
        );
      } catch (error) {
        failures.push({
          imageId: row.ImageId,
          propertyId: row.PropertyId,
          imageUrl: row.ImageUrl,
          error: error?.message || String(error),
        });
        console.error(`ImageId ${row.ImageId} failed: ${error?.message || error}`);
      }
    }
  }

  const stats = await pool.request().query(`
    SELECT
      COUNT(*) AS total_images,
      SUM(CASE WHEN ImageData IS NULL THEN 1 ELSE 0 END) AS missing_image_data,
      SUM(CASE WHEN ImageData IS NOT NULL THEN 1 ELSE 0 END) AS has_image_data
    FROM PropertiesImage;
  `);

  console.log("Final stats:", stats.recordset[0]);
  if (failures.length) {
    console.log("Failures:", JSON.stringify(failures, null, 2));
  }

  await pool.close();
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
