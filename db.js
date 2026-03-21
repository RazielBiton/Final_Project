const sql = require('mssql');
require('dotenv').config();

const config = {
    // We can parse the connection string or use the connection string directly
    // The mssql package supports connecting via a connection string
};

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

let poolPromise;

if (!connectionString) {
    console.error("❌ AZURE_SQL_CONNECTION_STRING is missing in .env");
} else {
    poolPromise = new sql.ConnectionPool(connectionString)
        .connect()
        .then(pool => {
            console.log('✅ Connected to Azure SQL Database');
            return pool;
        })
        .catch(err => {
            console.error('❌ Database Connection Failed! Bad Config: ', err);
            throw err;
        });
}

module.exports = {
    sql,
    poolPromise
};
