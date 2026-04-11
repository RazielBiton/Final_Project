/**
 * ===================================================
 * Insurance Table Migration Script
 * ===================================================
 * Run this script once to ensure all required columns
 * exist in the Insurance table in Azure SQL.
 *
 * Usage: node migrate_insurance_columns.js
 * ===================================================
 */

require('dotenv').config();
const { sql, poolPromise } = require('./db');

// All columns that the Insurance table MUST have
const REQUIRED_COLUMNS = [
    { name: 'TowingService',      type: 'NVARCHAR(500)' },
    { name: 'ReplacementCar',     type: 'NVARCHAR(500)' },
    { name: 'GlassCoverage',      type: 'NVARCHAR(500)' },
    { name: 'AgentName',          type: 'NVARCHAR(255)' },
    { name: 'AgentPhone',         type: 'NVARCHAR(50)'  },
    { name: 'DriverLimit',        type: 'NVARCHAR(255)' },
    { name: 'Deductible',         type: 'NVARCHAR(255)' },
    { name: 'ProtectionMeasures', type: 'NVARCHAR(255)' },
    { name: 'DocumentBase64',     type: 'NVARCHAR(MAX)' },
    { name: 'Cost',               type: 'DECIMAL(10, 2)'},
    { name: 'CompanyName',        type: 'NVARCHAR(255)' },
    { name: 'PolicyNumber',       type: 'NVARCHAR(255)' },
    { name: 'ExpiryDate',         type: 'DATE'          },
    { name: 'Type',               type: 'NVARCHAR(50)'  },
];

async function migrate() {
    try {
        const pool = await poolPromise;
        console.log('✅ Connected to database.\n');

        // Get existing columns from the Insurance table
        const result = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Insurance'
        `);

        const existingColumns = result.recordset.map(r => r.COLUMN_NAME.toLowerCase());
        console.log(`📋 Existing Insurance columns: ${existingColumns.join(', ')}\n`);

        let addedCount = 0;
        let skippedCount = 0;

        for (const col of REQUIRED_COLUMNS) {
            if (existingColumns.includes(col.name.toLowerCase())) {
                console.log(`  ✔ ${col.name} — already exists, skipping.`);
                skippedCount++;
            } else {
                try {
                    await pool.request().query(`
                        ALTER TABLE Insurance 
                        ADD [${col.name}] ${col.type} NULL
                    `);
                    console.log(`  ➕ ${col.name} (${col.type}) — ADDED successfully.`);
                    addedCount++;
                } catch (alterErr) {
                    console.error(`  ❌ Failed to add ${col.name}: ${alterErr.message}`);
                }
            }
        }

        console.log(`\n===================================================`);
        console.log(`Migration complete: ${addedCount} column(s) added, ${skippedCount} already existed.`);
        console.log(`===================================================`);
        process.exit(0);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
