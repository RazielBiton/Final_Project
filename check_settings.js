const { sql, poolPromise } = require('./db');

async function check() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT TOP 1 Id, SellSettings FROM Vehicles ORDER BY UpdatedAt DESC");
        console.log(result.recordset);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
