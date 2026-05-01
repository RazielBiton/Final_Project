const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const configStr = process.env.AZURE_SQL_CONNECTION_STRING;

async function resetDB() {
    if (!configStr) {
        console.error("No Azure SQL connection string found in .env");
        process.exit(1);
    }
    
    const parseAzureConnectionString = (str) => {
        const parsedConfig = { 
            server: '', database: '', user: '', password: '', 
            options: { encrypt: true, enableArithAbort: true, connectTimeout: 120000 }, 
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

    try {
        const enhancedConfig = parseAzureConnectionString(configStr);
        const pool = await sql.connect(enhancedConfig);
        console.log("Connected to DB. Starting Full Reset...");

        // 1. Drop all Foreign Keys and Tables
        const dropAllQuery = `
            DECLARE @Sql NVARCHAR(500) DECLARE @Cursor CURSOR
            SET @Cursor = CURSOR FAST_FORWARD FOR
            SELECT DISTINCT sql = 'ALTER TABLE [' + tc2.TABLE_SCHEMA + '].[' +  tc2.TABLE_NAME + '] DROP [' + rc1.CONSTRAINT_NAME + '];'
            FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc1
            LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc2 ON tc2.CONSTRAINT_NAME =rc1.CONSTRAINT_NAME
            
            OPEN @Cursor FETCH NEXT FROM @Cursor INTO @Sql
            WHILE (@@FETCH_STATUS = 0)
            BEGIN
                Exec sp_executesql @Sql
                FETCH NEXT FROM @Cursor INTO @Sql
            END
            CLOSE @Cursor DEALLOCATE @Cursor
            
            -- Drop all tables using a cursor
            DECLARE @DropSql NVARCHAR(500) DECLARE @TableCursor CURSOR
            SET @TableCursor = CURSOR FAST_FORWARD FOR
            SELECT 'DROP TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + ']'
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            
            OPEN @TableCursor FETCH NEXT FROM @TableCursor INTO @DropSql
            WHILE (@@FETCH_STATUS = 0)
            BEGIN
                EXEC sp_executesql @DropSql
                FETCH NEXT FROM @TableCursor INTO @DropSql
            END
            CLOSE @TableCursor DEALLOCATE @TableCursor
        `;
        
        console.log("Dropping all existing tables and constraints...");
        await pool.request().query(dropAllQuery);
        console.log("All tables dropped.");

        // 2. Read database_setup.sql and split by 'GO'
        const setupPath = path.join(__dirname, 'database_setup.sql');
        const setupSql = fs.readFileSync(setupPath, 'utf8');
        
        // Remove comments that might cause issues and split by GO commands
        const queries = setupSql
            .split(/^GO\s*$/im) // Split by GO on its own line
            .map(q => q.trim())
            .filter(q => q.length > 0);

        console.log(`Executing ${queries.length} batches from database_setup.sql...`);
        for (let i = 0; i < queries.length; i++) {
            try {
                await pool.request().query(queries[i]);
                console.log(`Executed batch ${i + 1}/${queries.length}`);
            } catch (err) {
                console.error(`Error in batch ${i + 1}:`, err.message);
                console.error("Query was:", queries[i].substring(0, 100) + '...');
                process.exit(1);
            }
        }

        console.log("DATABASE RESET COMPLETELY. ALL TABLES CREATED.");
        process.exit(0);

    } catch (err) {
        console.error("Reset failed:", err);
        process.exit(1);
    }
}

resetDB();
