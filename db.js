const sql = require('mssql');
require('dotenv').config();

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;



// Robust connection string parser to inject advanced tuning for Heavy I/O workloads (Base64)
const parseAzureConnectionString = (str) => {
    const config = { 
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
        if (keyLower === 'server') config.server = val.replace(/^tcp:/i, '').split(',')[0];
        if (keyLower === 'initial catalog' || keyLower === 'database') config.database = val;
        if (keyLower === 'user id' || keyLower === 'user') config.user = val;
        if (keyLower === 'password') config.password = val;
    });
    return config;
};

if (!connectionString) {
    console.error("❌ AZURE_SQL_CONNECTION_STRING is missing in .env");
}

let pool = null;

const getPool = async () => {
    if (pool) {
        return pool;
    }
    
    try {
        const enhancedConfig = parseAzureConnectionString(connectionString);
        pool = await new sql.ConnectionPool(enhancedConfig).connect();
        console.log('✅ Connected to Azure SQL Database (Enhanced Pool)');
        return pool;
    } catch (err) {
        console.error('❌ Database Connection Failed!', err.message);
        pool = null; // Reset pool so it retries next time
        throw err;
    }
};

// Create a proxy/getter object to maintain backward compatibility with server.js 'await poolPromise'
const poolPromise = {
    then: function(resolve, reject) {
        return getPool().then(resolve).catch(reject);
    }
};

// Global safety net – prevents Azure timeouts / transient errors from killing the process
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Unhandled Promise Rejection (server kept alive):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️  Uncaught Exception (server kept alive):', err.message);
});

module.exports = {
    sql,
    poolPromise
};
