require('dotenv').config();
const { sql, poolPromise } = require('./db');

async function updateSchema() {
    try {
        const pool = await poolPromise;
        
        console.log('Altering Users table...');
        
        // 1. Make PasswordHash nullable
        await pool.request().query(`ALTER TABLE [dbo].[Users] ALTER COLUMN [PasswordHash] NVARCHAR(255) NULL`);
        console.log('PasswordHash is now nullable.');

        // 2. Add AuthProvider column
        try {
            await pool.request().query(`ALTER TABLE [dbo].[Users] ADD [AuthProvider] NVARCHAR(50) NULL DEFAULT 'local'`);
            console.log('Added AuthProvider column.');
        } catch (e) {
            console.log('AuthProvider column might already exist:', e.message);
        }

        // 3. Add ProviderId column
        try {
            await pool.request().query(`ALTER TABLE [dbo].[Users] ADD [ProviderId] NVARCHAR(255) NULL`);
            console.log('Added ProviderId column.');
        } catch (e) {
            console.log('ProviderId column might already exist:', e.message);
        }

        console.log('Schema update complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    }
}

updateSchema();
