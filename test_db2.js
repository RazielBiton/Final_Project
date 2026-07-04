require('dotenv').config();
const { poolPromise } = require('./db');
async function run() {
    try {
        const pool = await poolPromise;
        let res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Vehicles'");
        console.log("Vehicles Schema:", res.recordset);
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
