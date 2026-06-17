const { sql, poolPromise } = require('./db');

async function test() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Vehicles'");
        console.log("Columns:", result.recordset.map(r => r.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
