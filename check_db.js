const sql = require('mssql');
require('dotenv').config();

const config = process.env.AZURE_SQL_CONNECTION_STRING;

async function checkSchema() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('Vehicles', 'Alerts', 'Fines', 'Insurance', 'Accidents', 'Treatments', 'FuelLogs')
            ORDER BY TABLE_NAME, COLUMN_NAME
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
