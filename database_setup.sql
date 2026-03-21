-- 1. טבלת משתמשים
CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Email] NVARCHAR(255) NOT NULL UNIQUE,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [FullName] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME DEFAULT GETDATE()
);

-- 2. טבלת רכבים
CREATE TABLE [dbo].[Vehicles] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [LicensePlate] NVARCHAR(20) NOT NULL UNIQUE,
    [BrandHeb] NVARCHAR(50) NULL,
    [Model] NVARCHAR(50) NULL,
    [Year] INT NULL,
    [Color] NVARCHAR(30) NULL,
    [FuelType] NVARCHAR(30) NULL,
    [TestDate] NVARCHAR(20) NULL,
    [LicenseExpiry] NVARCHAR(20) NULL,
    [Pollution] NVARCHAR(30) NULL,
    [TireFront] NVARCHAR(30) NULL,
    [TireRear] NVARCHAR(30) NULL,
    [EngineVolume] NVARCHAR(20) NULL,
    [HorsePower] NVARCHAR(20) NULL,
    [Km] INT DEFAULT 0,
    [Status] NVARCHAR(50) NULL,
    [ReliabilityScore] INT NULL,
    [HasDisabledTag] BIT DEFAULT 0,
    [Logo] NVARCHAR(MAX) NULL, -- To support Base64 images for cars
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Vehicles_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
);

-- 3. טבלת טיפולים (Treatments)
CREATE TABLE [dbo].[Treatments] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Type] NVARCHAR(100) NULL,
    [Description] NVARCHAR(500) NOT NULL,
    [Cost] DECIMAL(10,2) NOT NULL,
    [GarageName] NVARCHAR(100) NULL,
    [Odometer] INT NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- To store base64 images of invoices/receipts
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Treatments_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 4. טבלת תדלוקים (FuelLogs)
CREATE TABLE [dbo].[FuelLogs] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Time] TIME NULL,
    [Liters] DECIMAL(8,2) NOT NULL,
    [PricePerLiter] DECIMAL(8,2) NOT NULL,
    [TotalCost] DECIMAL(10,2) NOT NULL,
    [Odometer] INT NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Receipt
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_FuelLogs_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 5. טבלת הוצאות (Expenses)
CREATE TABLE [dbo].[Expenses] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Category] NVARCHAR(50) NOT NULL,
    [Amount] DECIMAL(10,2) NOT NULL,
    [Description] NVARCHAR(255) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Receipt
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Expenses_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 6. טבלת תאונות (Accidents)
CREATE TABLE [dbo].[Accidents] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [Title] NVARCHAR(255) NULL,
    [Date] DATE NOT NULL,
    [Description] NVARCHAR(1000) NOT NULL,
    [DamageDetails] NVARCHAR(1000) NULL,
    [EstimatedCost] DECIMAL(10,2) NULL,
    [Cost] DECIMAL(10,2) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Photos of damage
    [ThirdPartyInvolved] BIT DEFAULT 0,
    [IsHandled] BIT DEFAULT 0,
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Accidents_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 7. טבלת התראות (Alerts)
CREATE TABLE [dbo].[Alerts] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [Title] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [Date] DATE NOT NULL,
    [Urgency] NVARCHAR(50) NULL,
    [Frequency] NVARCHAR(50) NULL,
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Alerts_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 8. טבלת ביטוח (Insurance - optionally linked to vehicle, but keeping it simple)
CREATE TABLE [dbo].[Insurance] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [CompanyName] NVARCHAR(100) NULL,
    [PolicyNumber] NVARCHAR(50) NULL,
    [ExpiryDate] DATE NULL,
    [Type] NVARCHAR(50) NULL, -- 'חובה', 'מקיף', 'צד ג'
    [Cost] DECIMAL(10,2) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Policy document/photo
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Insurance_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 9. טבלת דוחות וקנסות (Fines)
CREATE TABLE [dbo].[Fines] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [OffenseType] NVARCHAR(100) NOT NULL,
    [Date] DATE NOT NULL,
    [LastPaymentDate] DATE NULL,
    [Location] NVARCHAR(255) NULL,
    [Amount] DECIMAL(10,2) NULL,
    [Points] INT NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL,
    [IsHandled] BIT DEFAULT 0,
    [CreatedAt] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Fines_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);

-- 10. טבלת גלריית תמונות לדוח מכירה (VehicleGallery)
CREATE TABLE [dbo].[VehicleGallery] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VehicleId] INT NOT NULL,
    [ImageBase64] NVARCHAR(MAX) NOT NULL,
    [UploadDate] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_VehicleGallery_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
