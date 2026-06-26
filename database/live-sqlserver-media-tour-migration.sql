/*
  Realo live SQL Server migration for database-backed images, floor plans,
  and internal 360 virtual tours.

  Safe to run more than once.
  This script only adds missing columns/tables/indexes. It does not delete data.

  Run against the live database that contains dbo.Properties and dbo.PropertiesImage.
*/

SET NOCOUNT ON;

PRINT 'Starting Realo live media/tour schema migration...';

IF OBJECT_ID('dbo.Properties', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Properties (
    PropertyId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Properties PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Address NVARCHAR(255) NULL,
    City NVARCHAR(100) NULL,
    PropertyType NVARCHAR(50) NULL,
    IsForSale BIT NOT NULL CONSTRAINT DF_Properties_IsForSale DEFAULT 0,
    IsForRent BIT NOT NULL CONSTRAINT DF_Properties_IsForRent DEFAULT 0,
    Price NVARCHAR(100) NULL,
    Bedrooms INT NULL,
    Bathrooms INT NULL,
    SquareFeet INT NULL,
    HasOwnershipDocument BIT NOT NULL CONSTRAINT DF_Properties_HasOwnershipDocument DEFAULT 0,
    Furniture NVARCHAR(100) NULL,
    FloorPlanUrl NVARCHAR(1000) NULL,
    VirtualTourUrl NVARCHAR(1000) NULL,
    Latitude FLOAT NULL,
    Longitude FLOAT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Properties_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Properties_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
  PRINT 'Created dbo.Properties.';
END;

IF COL_LENGTH('dbo.Properties', 'FloorPlanUrl') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanUrl NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.Properties', 'VirtualTourUrl') IS NULL
  ALTER TABLE dbo.Properties ADD VirtualTourUrl NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.Properties', 'FloorPlanImageData') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanImageData VARBINARY(MAX) NULL;

IF COL_LENGTH('dbo.Properties', 'FloorPlanMimeType') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanMimeType NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.Properties', 'FloorPlanOriginalName') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanOriginalName NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.Properties', 'FloorPlanWidth') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanWidth INT NULL;

IF COL_LENGTH('dbo.Properties', 'FloorPlanHeight') IS NULL
  ALTER TABLE dbo.Properties ADD FloorPlanHeight INT NULL;

IF COL_LENGTH('dbo.Properties', 'CreatedAt') IS NULL
  ALTER TABLE dbo.Properties ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Properties_CreatedAt_Live DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.Properties', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.Properties ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Properties_UpdatedAt_Live DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('dbo.PropertiesImage', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PropertiesImage (
    ImageId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PropertiesImage PRIMARY KEY,
    PropertyId INT NOT NULL,
    ImageUrl NVARCHAR(1000) NULL,
    OriginalUrl NVARCHAR(1000) NULL,
    ImageData VARBINARY(MAX) NULL,
    MimeType NVARCHAR(100) NULL,
    Width INT NULL,
    Height INT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_PropertiesImage_SortOrder DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertiesImage_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PropertiesImage_Properties_Live FOREIGN KEY (PropertyId)
      REFERENCES dbo.Properties(PropertyId) ON DELETE CASCADE
  );
  PRINT 'Created dbo.PropertiesImage.';
END;

IF COL_LENGTH('dbo.PropertiesImage', 'OriginalUrl') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD OriginalUrl NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.PropertiesImage', 'ImageData') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD ImageData VARBINARY(MAX) NULL;

IF COL_LENGTH('dbo.PropertiesImage', 'MimeType') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD MimeType NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.PropertiesImage', 'Width') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD Width INT NULL;

IF COL_LENGTH('dbo.PropertiesImage', 'Height') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD Height INT NULL;

IF COL_LENGTH('dbo.PropertiesImage', 'SortOrder') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD SortOrder INT NOT NULL CONSTRAINT DF_PropertiesImage_SortOrder_Live DEFAULT 0;

IF COL_LENGTH('dbo.PropertiesImage', 'CreatedAt') IS NULL
  ALTER TABLE dbo.PropertiesImage ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertiesImage_CreatedAt_Live DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('dbo.PropertyVirtualTours', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PropertyVirtualTours (
    TourId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PropertyVirtualTours PRIMARY KEY,
    PropertyId INT NOT NULL,
    Title NVARCHAR(200) NULL,
    StartRoomId INT NULL,
    IsPublished BIT NOT NULL CONSTRAINT DF_PropertyVirtualTours_IsPublished DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyVirtualTours_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyVirtualTours_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PropertyVirtualTours_Properties_Live FOREIGN KEY (PropertyId)
      REFERENCES dbo.Properties(PropertyId) ON DELETE CASCADE
  );
  PRINT 'Created dbo.PropertyVirtualTours.';
END;

IF COL_LENGTH('dbo.PropertyVirtualTours', 'Title') IS NULL
  ALTER TABLE dbo.PropertyVirtualTours ADD Title NVARCHAR(200) NULL;

IF COL_LENGTH('dbo.PropertyVirtualTours', 'StartRoomId') IS NULL
  ALTER TABLE dbo.PropertyVirtualTours ADD StartRoomId INT NULL;

IF COL_LENGTH('dbo.PropertyVirtualTours', 'IsPublished') IS NULL
  ALTER TABLE dbo.PropertyVirtualTours ADD IsPublished BIT NOT NULL CONSTRAINT DF_PropertyVirtualTours_IsPublished_Live DEFAULT 0;

IF COL_LENGTH('dbo.PropertyVirtualTours', 'CreatedAt') IS NULL
  ALTER TABLE dbo.PropertyVirtualTours ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyVirtualTours_CreatedAt_Live DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.PropertyVirtualTours', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.PropertyVirtualTours ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyVirtualTours_UpdatedAt_Live DEFAULT SYSUTCDATETIME();

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.PropertyVirtualTours')
    AND name = 'UX_PropertyVirtualTours_PropertyId'
)
BEGIN
  CREATE UNIQUE INDEX UX_PropertyVirtualTours_PropertyId
    ON dbo.PropertyVirtualTours(PropertyId);
END;

IF OBJECT_ID('dbo.VirtualTourRooms', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VirtualTourRooms (
    RoomId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_VirtualTourRooms PRIMARY KEY,
    TourId INT NOT NULL,
    Label NVARCHAR(200) NOT NULL,
    PanoramaImageData VARBINARY(MAX) NOT NULL,
    PanoramaMimeType NVARCHAR(100) NOT NULL,
    PanoramaWidth INT NULL,
    PanoramaHeight INT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_VirtualTourRooms_SortOrder DEFAULT 0,
    InitialYaw FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_InitialYaw DEFAULT 0,
    InitialPitch FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_InitialPitch DEFAULT 0,
    CompassOffset FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_CompassOffset DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourRooms_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourRooms_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_VirtualTourRooms_Tours_Live FOREIGN KEY (TourId)
      REFERENCES dbo.PropertyVirtualTours(TourId) ON DELETE CASCADE
  );
  PRINT 'Created dbo.VirtualTourRooms.';
END;

IF COL_LENGTH('dbo.VirtualTourRooms', 'CompassOffset') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD CompassOffset FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_CompassOffset_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourRooms', 'InitialYaw') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD InitialYaw FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_InitialYaw_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourRooms', 'InitialPitch') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD InitialPitch FLOAT NOT NULL CONSTRAINT DF_VirtualTourRooms_InitialPitch_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourRooms', 'SortOrder') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD SortOrder INT NOT NULL CONSTRAINT DF_VirtualTourRooms_SortOrder_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourRooms', 'CreatedAt') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourRooms_CreatedAt_Live DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.VirtualTourRooms', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.VirtualTourRooms ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourRooms_UpdatedAt_Live DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('dbo.VirtualTourHotspots', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VirtualTourHotspots (
    HotspotId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_VirtualTourHotspots PRIMARY KEY,
    FromRoomId INT NOT NULL,
    ToRoomId INT NOT NULL,
    Label NVARCHAR(200) NULL,
    Yaw FLOAT NOT NULL CONSTRAINT DF_VirtualTourHotspots_Yaw DEFAULT 0,
    Pitch FLOAT NOT NULL CONSTRAINT DF_VirtualTourHotspots_Pitch DEFAULT 0,
    SortOrder INT NOT NULL CONSTRAINT DF_VirtualTourHotspots_SortOrder DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourHotspots_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourHotspots_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_VirtualTourHotspots_FromRoom_Live FOREIGN KEY (FromRoomId)
      REFERENCES dbo.VirtualTourRooms(RoomId) ON DELETE CASCADE
  );
  PRINT 'Created dbo.VirtualTourHotspots.';
END;

IF COL_LENGTH('dbo.VirtualTourHotspots', 'Yaw') IS NULL
  ALTER TABLE dbo.VirtualTourHotspots ADD Yaw FLOAT NOT NULL CONSTRAINT DF_VirtualTourHotspots_Yaw_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourHotspots', 'Pitch') IS NULL
  ALTER TABLE dbo.VirtualTourHotspots ADD Pitch FLOAT NOT NULL CONSTRAINT DF_VirtualTourHotspots_Pitch_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourHotspots', 'SortOrder') IS NULL
  ALTER TABLE dbo.VirtualTourHotspots ADD SortOrder INT NOT NULL CONSTRAINT DF_VirtualTourHotspots_SortOrder_Live DEFAULT 0;

IF COL_LENGTH('dbo.VirtualTourHotspots', 'CreatedAt') IS NULL
  ALTER TABLE dbo.VirtualTourHotspots ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourHotspots_CreatedAt_Live DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.VirtualTourHotspots', 'UpdatedAt') IS NULL
  ALTER TABLE dbo.VirtualTourHotspots ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_VirtualTourHotspots_UpdatedAt_Live DEFAULT SYSUTCDATETIME();

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.PropertiesImage')
    AND name = 'IX_PropertiesImage_Property_Sort'
)
BEGIN
  CREATE INDEX IX_PropertiesImage_Property_Sort
    ON dbo.PropertiesImage(PropertyId, SortOrder, ImageId);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.VirtualTourRooms')
    AND name = 'IX_VirtualTourRooms_Tour_Sort'
)
BEGIN
  CREATE INDEX IX_VirtualTourRooms_Tour_Sort
    ON dbo.VirtualTourRooms(TourId, SortOrder, RoomId);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.VirtualTourHotspots')
    AND name = 'IX_VirtualTourHotspots_FromRoom_Sort'
)
BEGIN
  CREATE INDEX IX_VirtualTourHotspots_FromRoom_Sort
    ON dbo.VirtualTourHotspots(FromRoomId, SortOrder, HotspotId);
END;

PRINT 'Realo live media/tour schema migration completed.';
