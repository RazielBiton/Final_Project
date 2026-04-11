const sql = require('mssql');
require('dotenv').config();

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

async function migrate() {
    try {
        console.log("Connecting to Azure SQL using connection string...");
        let pool = await sql.connect(connectionString);
        
        console.log("Adding new insurance columns...");
        
        const alterQuery = `
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Insurance') AND name = 'Towing')
            BEGIN
                ALTER TABLE Insurance ADD 
                    Towing NVARCHAR(MAX),
                    Replacement NVARCHAR(MAX),
                    Glass NVARCHAR(MAX),
                    AgentName NVARCHAR(MAX),
                    AgentPhone NVARCHAR(MAX),
                    DriverLimit NVARCHAR(MAX),
                    Deductible NVARCHAR(MAX),
                    Protection NVARCHAR(MAX);
                PRINT 'Columns added successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Columns already exist.';
            END
        `;
        
        await pool.request().query(alterQuery);
        console.log("Migration completed.");
        await pool.close();
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrate();
