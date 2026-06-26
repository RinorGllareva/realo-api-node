/*
  Verification query for live-sqlserver-media-tour-migration.sql.
  Run after the migration against the same live database.
*/

SET NOCOUNT ON;

SELECT
  'Properties media columns' AS CheckName,
  SUM(CASE WHEN c.name IN (
    'FloorPlanUrl',
    'VirtualTourUrl',
    'FloorPlanImageData',
    'FloorPlanMimeType',
    'FloorPlanOriginalName',
    'FloorPlanWidth',
    'FloorPlanHeight',
    'CreatedAt',
    'UpdatedAt'
  ) THEN 1 ELSE 0 END) AS FoundCount,
  9 AS ExpectedCount
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.Properties');

SELECT
  'PropertiesImage database image columns' AS CheckName,
  SUM(CASE WHEN c.name IN (
    'OriginalUrl',
    'ImageData',
    'MimeType',
    'Width',
    'Height',
    'SortOrder',
    'CreatedAt'
  ) THEN 1 ELSE 0 END) AS FoundCount,
  7 AS ExpectedCount
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.PropertiesImage');

SELECT
  t.name AS RequiredTable,
  CASE WHEN OBJECT_ID('dbo.' + t.name, 'U') IS NULL THEN 'MISSING' ELSE 'OK' END AS Status
FROM (VALUES
  ('PropertyVirtualTours'),
  ('VirtualTourRooms'),
  ('VirtualTourHotspots')
) AS t(name);

SELECT
  i.name AS RequiredIndex,
  CASE WHEN i.object_id IS NULL THEN 'MISSING' ELSE 'OK' END AS Status
FROM (VALUES
  ('UX_PropertyVirtualTours_PropertyId', 'PropertyVirtualTours'),
  ('IX_PropertiesImage_Property_Sort', 'PropertiesImage'),
  ('IX_VirtualTourRooms_Tour_Sort', 'VirtualTourRooms'),
  ('IX_VirtualTourHotspots_FromRoom_Sort', 'VirtualTourHotspots')
) AS required(name, table_name)
OUTER APPLY (
  SELECT TOP 1 sysi.object_id, sysi.name
  FROM sys.indexes sysi
  WHERE sysi.object_id = OBJECT_ID('dbo.' + required.table_name)
    AND sysi.name = required.name
) i;
