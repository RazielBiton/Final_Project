-- ===================================================================
-- EasyCare Database Schema - Enterprise Architecture (Azure SQL)
-- ===================================================================

-- 1. טבלת משתמשים (Users - Tenants)
CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Email] NVARCHAR(255) NOT NULL,
    [PasswordHash] NVARCHAR(255) NULL,
    [FullName] NVARCHAR(100) NULL,
    [Phone] NVARCHAR(20) NULL,
    [Avatar] NVARCHAR(MAX) NULL,
    [Preferences] NVARCHAR(MAX) NULL, -- JSON (Theme, language, notifications)
    [AuthProvider] NVARCHAR(50) NULL DEFAULT 'local', -- 'local', 'google', 'apple'
    [ProviderId] NVARCHAR(255) NULL, -- OAuth provider ID
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [IsDeleted] BIT NOT NULL DEFAULT 0,
    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT UQ_Users_Email UNIQUE ([Email])
);
GO

-- 2. ניהול אבטחה (Password Reset Tokens)
CREATE TABLE [dbo].[PasswordResetTokens] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [UserId] INT NOT NULL,
    [Token] NVARCHAR(255) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [IsUsed] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PasswordResetTokens PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Tokens_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
);
GO
CREATE NONCLUSTERED INDEX IX_PasswordResetTokens_Token ON [dbo].[PasswordResetTokens]([Token]) WHERE [IsUsed] = 0;
GO

-- 3. טבלת רכבים (Vehicles - Core Entity)
CREATE TABLE [dbo].[Vehicles] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [UserId] INT NOT NULL,
    [LicensePlate] NVARCHAR(20) NOT NULL,
    [BrandHeb] NVARCHAR(50) NULL,
    [Model] NVARCHAR(50) NULL,
    [Year] INT NULL,
    [Color] NVARCHAR(30) NULL,
    [FuelType] NVARCHAR(30) NULL,
    [TestDate] DATE NULL,
    [LicenseExpiry] DATE NULL,
    [Pollution] INT NULL,
    [TireFront] NVARCHAR(30) NULL,
    [TireRear] NVARCHAR(30) NULL,
    [EngineVolume] INT NULL,
    [HorsePower] INT NULL,
    [Km] INT NOT NULL DEFAULT 0,
    [Status] NVARCHAR(50) NOT NULL DEFAULT N'פעיל',
    [ReliabilityScore] INT NOT NULL DEFAULT 100,
    [HasDisabledTag] BIT NOT NULL DEFAULT 0,
    [Logo] NVARCHAR(MAX) NULL, -- Legacy compatibility
    [LogoUrl] NVARCHAR(500) NULL,
    [SellSettings] NVARCHAR(MAX) NULL, -- JSON (e.g. {"showCosts":true, "sellerComment":""})
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [IsDeleted] BIT NOT NULL DEFAULT 0,
    CONSTRAINT PK_Vehicles PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Vehicles_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]),
    CONSTRAINT UQ_Vehicles_LicensePlate UNIQUE ([LicensePlate]),
    CONSTRAINT CHK_Vehicles_Km CHECK ([Km] >= 0),
    CONSTRAINT CHK_Vehicles_Status CHECK ([Status] IN (N'פעיל', N'נמכר', N'מושבת'))
);
GO
-- Composite Index for fast Tenant queries
CREATE NONCLUSTERED INDEX IX_Vehicles_UserId_Status ON [dbo].[Vehicles]([UserId], [Status]) WHERE [IsDeleted] = 0;
GO

-- 4. טיפולים (Treatments)
CREATE TABLE [dbo].[Treatments] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Type] NVARCHAR(100) NULL,
    [Description] NVARCHAR(500) NOT NULL,
    [Cost] DECIMAL(10,2) NOT NULL DEFAULT 0,
    [GarageName] NVARCHAR(100) NULL,
    [Odometer] INT NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL, 
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Treatments PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Treatments_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE,
    CONSTRAINT CHK_Treatments_Cost CHECK ([Cost] >= 0)
);
GO
CREATE NONCLUSTERED INDEX IX_Treatments_Vehicle_Date ON [dbo].[Treatments]([VehicleId], [Date] DESC);
GO

-- 5. תדלוקים (FuelLogs)
CREATE TABLE [dbo].[FuelLogs] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Time] TIME NULL,
    [Liters] DECIMAL(8,2) NOT NULL,
    [PricePerLiter] DECIMAL(8,2) NOT NULL,
    [TotalCost] DECIMAL(10,2) NOT NULL,
    [Odometer] INT NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_FuelLogs PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_FuelLogs_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE,
    CONSTRAINT CHK_FuelLogs_Cost CHECK ([TotalCost] >= 0 AND [Liters] >= 0)
);
GO
CREATE NONCLUSTERED INDEX IX_FuelLogs_Vehicle_Date ON [dbo].[FuelLogs]([VehicleId], [Date] DESC);
GO

-- 6. הוצאות שונות (Expenses)
CREATE TABLE [dbo].[Expenses] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Date] DATE NOT NULL,
    [Category] NVARCHAR(50) NOT NULL,
    [Amount] DECIMAL(10,2) NOT NULL,
    [Description] NVARCHAR(255) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Expenses PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Expenses_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE,
    CONSTRAINT CHK_Expenses_Amount CHECK ([Amount] >= 0)
);
GO

-- 7. תאונות (Accidents)
CREATE TABLE [dbo].[Accidents] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Title] NVARCHAR(255) NULL,
    [Date] DATE NOT NULL,
    [Description] NVARCHAR(1000) NOT NULL,
    [DamageDetails] NVARCHAR(1000) NULL,
    [EstimatedCost] DECIMAL(10,2) NULL,
    [Cost] DECIMAL(10,2) NULL, -- Legacy
    [RepairCost] DECIMAL(10,2) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL,
    [Location] NVARCHAR(255) NULL,
    [ThirdPartyInvolved] BIT NOT NULL DEFAULT 0,
    [IsHandled] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Accidents PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Accidents_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
GO

-- 8. התראות (Alerts)
CREATE TABLE [dbo].[Alerts] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Title] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [Date] DATE NOT NULL,
    [Urgency] NVARCHAR(50) NULL,
    [Frequency] NVARCHAR(50) NULL,
    [IsActive] BIT NOT NULL DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Alerts PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Alerts_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
GO

-- 9. ביטוחים (Insurance)
CREATE TABLE [dbo].[Insurance] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [Type] NVARCHAR(50) NOT NULL,
    [CompanyName] NVARCHAR(100) NULL,
    [PolicyNumber] NVARCHAR(50) NULL,
    [ExpiryDate] DATE NULL,
    [Cost] DECIMAL(10,2) NULL,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL,
    [TowingService] NVARCHAR(255) NULL,
    [ReplacementCar] NVARCHAR(255) NULL,
    [GlassCoverage] NVARCHAR(255) NULL,
    [AgentName] NVARCHAR(255) NULL,
    [AgentPhone] NVARCHAR(50) NULL,
    [DriverLimit] NVARCHAR(255) NULL,
    [Deductible] NVARCHAR(255) NULL,
    [ProtectionMeasures] NVARCHAR(255) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Insurance PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Insurance_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
GO

-- 10. דוחות וקנסות (Fines)
CREATE TABLE [dbo].[Fines] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [OffenseType] NVARCHAR(100) NOT NULL,
    [Date] DATE NOT NULL,
    [LastPaymentDate] DATE NULL,
    [Location] NVARCHAR(255) NULL,
    [Amount] DECIMAL(10,2) NULL,
    [Points] INT NOT NULL DEFAULT 0,
    [IsHandled] BIT NOT NULL DEFAULT 0,
    [IsPaid] BIT NOT NULL DEFAULT 0,
    [DocumentBase64] NVARCHAR(MAX) NULL, -- Legacy
    [DocumentUrl] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Fines PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_Fines_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
GO

-- 11. גלריית רכב (VehicleGallery)
CREATE TABLE [dbo].[VehicleGallery] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [VehicleId] INT NOT NULL,
    [ImageBase64] NVARCHAR(MAX) NULL, -- Legacy
    [ImageUrl] NVARCHAR(MAX) NULL,
    [SortOrder] INT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [UploadDate] DATETIME2 NOT NULL DEFAULT GETDATE(), -- Legacy compatibility
    CONSTRAINT PK_VehicleGallery PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT FK_VehicleGallery_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
);
GO
