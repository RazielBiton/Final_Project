require('dotenv').config();
const { poolPromise } = require('./db');
async function run() {
    try {
        const pool = await poolPromise;
        await pool.request().query("ALTER TABLE FuelLogs ADD FuelType nvarchar(50);");
        console.log("Added FuelType column to FuelLogs successfully.");
        process.exit(0);
    } catch(err) {
        if (err.message.includes("already exists")) {
            console.log("Column FuelType already exists.");
            process.exit(0);
        } else {
            console.error(err);
            process.exit(1);
        }
    }
}
run();
