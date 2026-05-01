const sql = require('mssql');
require('dotenv').config();

const config = process.env.AZURE_SQL_CONNECTION_STRING;

async function runV2Migrations() {
    if (!config) {
        console.error("No Azure SQL connection string found in .env");
        process.exit(1);
    }
    
    try {
        // Robust connection config
        const parseAzureConnectionString = (str) => {
            const parsedConfig = { 
                server: '', database: '', user: '', password: '', 
                options: { encrypt: true, enableArithAbort: true, connectTimeout: 60000 }, 
                pool: { max: 50, min: 0, idleTimeoutMillis: 30000, acquireTimeoutMillis: 120000 }, 
                requestTimeout: 120000 
            };
            str.split(';').forEach(part => {
                const [key, ...vals] = part.split('=');
                if (!key) return;
                const val = vals.join('=');
                const keyLower = key.toLowerCase().trim();
                if (keyLower === 'server') parsedConfig.server = val.replace(/^tcp:/i, '').split(',')[0];
                if (keyLower === 'initial catalog' || keyLower === 'database') parsedConfig.database = val;
                if (keyLower === 'user id' || keyLower === 'user') parsedConfig.user = val;
                if (keyLower === 'password') parsedConfig.password = val;
            });
            return parsedConfig;
        };

        const enhancedConfig = parseAzureConnectionString(config);
        const pool = await sql.connect(enhancedConfig);
        console.log("Connected to DB, running V2 migrations...");

        const queries = [
            // 1. Users Additions
            "IF COL_LENGTH('dbo.Users', 'Phone') IS NULL ALTER TABLE [dbo].[Users] ADD [Phone] NVARCHAR(20) NULL;",
            "IF COL_LENGTH('dbo.Users', 'Preferences') IS NULL ALTER TABLE [dbo].[Users] ADD [Preferences] NVARCHAR(MAX) NULL;",
            "IF COL_LENGTH('dbo.Users', 'UpdatedAt') IS NULL ALTER TABLE [dbo].[Users] ADD [UpdatedAt] DATETIME2 DEFAULT GETDATE();",
            
            // 2. PasswordResetTokens Table
            `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResetTokens' AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[PasswordResetTokens] (
                    [Id] INT IDENTITY(1,1) PRIMARY KEY,
                    [UserId] INT NOT NULL,
                    [Token] NVARCHAR(255) NOT NULL,
                    [ExpiresAt] DATETIME2 NOT NULL,
                    [IsUsed] BIT DEFAULT 0,
                    [CreatedAt] DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT FK_Tokens_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
                );
            END
            `,

            // 3. Vehicles Additions
            "IF COL_LENGTH('dbo.Vehicles', 'LogoUrl') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [LogoUrl] NVARCHAR(500) NULL;",
            "IF COL_LENGTH('dbo.Vehicles', 'SellSettings') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [SellSettings] NVARCHAR(MAX) NULL;",
            "IF COL_LENGTH('dbo.Vehicles', 'UpdatedAt') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [UpdatedAt] DATETIME2 DEFAULT GETDATE();",

            // 4. Treatments Additions
            "IF COL_LENGTH('dbo.Treatments', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[Treatments] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",
            "IF COL_LENGTH('dbo.Treatments', 'UpdatedAt') IS NULL ALTER TABLE [dbo].[Treatments] ADD [UpdatedAt] DATETIME2 DEFAULT GETDATE();",

            // 5. FuelLogs Additions
            "IF COL_LENGTH('dbo.FuelLogs', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[FuelLogs] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",
            
            // 6. Expenses Additions
            "IF COL_LENGTH('dbo.Expenses', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[Expenses] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",

            // 7. Accidents Additions
            "IF COL_LENGTH('dbo.Accidents', 'RepairCost') IS NULL ALTER TABLE [dbo].[Accidents] ADD [RepairCost] DECIMAL(10,2) NULL;",
            "IF COL_LENGTH('dbo.Accidents', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[Accidents] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",

            // 8. Alerts Additions (N/A new mostly, but making sure IsActive is there)
            "IF COL_LENGTH('dbo.Alerts', 'IsActive') IS NULL ALTER TABLE [dbo].[Alerts] ADD [IsActive] BIT DEFAULT 1;",

            // 9. Insurance Additions
            "IF COL_LENGTH('dbo.Insurance', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[Insurance] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",

            // 10. Fines Additions
            "IF COL_LENGTH('dbo.Fines', 'IsPaid') IS NULL ALTER TABLE [dbo].[Fines] ADD [IsPaid] BIT DEFAULT 0;",
            "IF COL_LENGTH('dbo.Fines', 'DocumentUrl') IS NULL ALTER TABLE [dbo].[Fines] ADD [DocumentUrl] NVARCHAR(MAX) NULL;",

            // 11. VehicleGallery Additions
            "IF COL_LENGTH('dbo.VehicleGallery', 'ImageUrl') IS NULL ALTER TABLE [dbo].[VehicleGallery] ADD [ImageUrl] NVARCHAR(MAX) NULL;",
            "IF COL_LENGTH('dbo.VehicleGallery', 'SortOrder') IS NULL ALTER TABLE [dbo].[VehicleGallery] ADD [SortOrder] INT DEFAULT 0;"
        ];

        for (const query of queries) {
            try {
                await pool.request().query(query);
                console.log("Success: " + query.substring(0, 50) + "...");
            } catch (qErr) {
                console.error("Error executing query:", query.substring(0, 50) + "...", qErr.message);
            }
        }
        
        console.log("V2 Migrations applied successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runV2Migrations();
