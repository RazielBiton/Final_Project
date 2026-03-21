const sql = require('mssql');
require('dotenv').config();

const config = process.env.AZURE_SQL_CONNECTION_STRING;

async function runMigrations() {
    if (!config) {
        console.error("No Azure SQL connection string found in .env");
        process.exit(1);
    }
    
    try {
        const pool = await sql.connect(config);
        console.log("Connected to DB, running migrations...");

        const queries = [
            // Vehicles Additions
            "IF COL_LENGTH('dbo.Vehicles', 'Status') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [Status] NVARCHAR(50) NULL;",
            "IF COL_LENGTH('dbo.Vehicles', 'ReliabilityScore') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [ReliabilityScore] INT NULL;",
            
            // Alerts Additions
            "IF COL_LENGTH('dbo.Alerts', 'Description') IS NULL ALTER TABLE [dbo].[Alerts] ADD [Description] NVARCHAR(500) NULL;",
            "IF COL_LENGTH('dbo.Alerts', 'Urgency') IS NULL ALTER TABLE [dbo].[Alerts] ADD [Urgency] NVARCHAR(50) NULL;",
            "IF COL_LENGTH('dbo.Alerts', 'Frequency') IS NULL ALTER TABLE [dbo].[Alerts] ADD [Frequency] NVARCHAR(50) NULL;",
            
            // Treatments Additions
            "IF COL_LENGTH('dbo.Treatments', 'Type') IS NULL ALTER TABLE [dbo].[Treatments] ADD [Type] NVARCHAR(100) NULL;",
            
            // Accidents Additions
            "IF COL_LENGTH('dbo.Accidents', 'Title') IS NULL ALTER TABLE [dbo].[Accidents] ADD [Title] NVARCHAR(255) NULL;",
            "IF COL_LENGTH('dbo.Accidents', 'EstimatedCost') IS NULL ALTER TABLE [dbo].[Accidents] ADD [EstimatedCost] DECIMAL(10,2) NULL;",
            "IF COL_LENGTH('dbo.Accidents', 'ThirdPartyInvolved') IS NULL ALTER TABLE [dbo].[Accidents] ADD [ThirdPartyInvolved] BIT DEFAULT 0;",
            "IF COL_LENGTH('dbo.Accidents', 'IsHandled') IS NULL ALTER TABLE [dbo].[Accidents] ADD [IsHandled] BIT DEFAULT 0;",
            
            // FuelLogs Additions
            "IF COL_LENGTH('dbo.FuelLogs', 'Time') IS NULL ALTER TABLE [dbo].[FuelLogs] ADD [Time] TIME NULL;",
            
            // Drop UNIQUE constraint from Insurance.VehicleId if exists
            `
            DECLARE @ConstraintName nvarchar(200);
            SELECT @ConstraintName = Name 
            FROM sys.key_constraints 
            WHERE type = 'UQ' AND parent_object_id = Object_id('dbo.Insurance');

            IF @ConstraintName IS NOT NULL
            BEGIN
                DECLARE @dropQuery nvarchar(max) = 'ALTER TABLE [dbo].[Insurance] DROP CONSTRAINT [' + @ConstraintName + ']';
                EXEC sp_executesql @dropQuery;
                PRINT 'Dropped UNIQUE constraint on Insurance.VehicleId';
            END
            `,

            // New Fines table
            `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Fines' AND type = 'U')
            BEGIN
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
            END
            `,
            
            // New VehicleGallery table for photos and sales reports
            `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleGallery' AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[VehicleGallery] (
                    [Id] INT IDENTITY(1,1) PRIMARY KEY,
                    [VehicleId] INT NOT NULL,
                    [ImageBase64] NVARCHAR(MAX) NOT NULL,
                    [UploadDate] DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_VehicleGallery_Vehicles FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]) ON DELETE CASCADE
                );
            END
            `
        ];

        for (const query of queries) {
            try {
                await pool.request().query(query);
            } catch (qErr) {
                console.error("Error executing query:", query.substring(0, 50) + "...", qErr.message);
            }
        }
        
        console.log("Migrations applied successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigrations();
