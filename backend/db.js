/**
 * @fileoverview backend/db.js
 * @description מודול החיבור ושכבת הבסיס למסד הנתונים (Database Access Layer). אחראי על יצירה, החזקה ואופטימיזציה של ה-Connection Pool מול שרתי Azure SQL, תוך מתן דגש על עמידות בפני ניתוקים ואבטחת פעילות תקינה תחת עומסי נתונים גדולים (Heavy I/O).
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

const sql = require('mssql');
require('dotenv').config();

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

/**
 * מקבלת את מחרוזת ההתקשרות (Connection String) של Azure SQL, מפרקת אותה למרכיביה (שרת, מסד נתונים, משתמש וסיסמה) ובונה אובייקט הגדרות מתקדם לספריית mssql. הפונקציה מזריקה הגדרות Connection Pool מורחבות וטיימאאוטים כבדים שנועדו למנוע קריסות (Timeouts) בעת עומס I/O בעבודה מול רשומות Base64 ענקיות (תמונות, קבלות, מסמכי PDF).
 * @param {string} str - מחרוזת ההתקשרות המקורית מתוך משתני הסביבה (.env).
 * @returns {Object} - אובייקט הגדרות (Config Object) המותאם לספריית mssql.
 */
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

/**
 * פונקציה אסינכרונית (Singleton Pattern) לניהול אגן התקשרויות (Connection Pool) אל מסד הנתונים בענן (Azure SQL). מוודאת שלא נוצרת יותר מבריכה אחת לכל חיי השרת, ובמקרה של קריסה מחזירה שגיאה ומאפסת את הבריכה כדי שהבקשה הבאה תנסה להתחבר מחדש.
 * @returns {Promise<sql.ConnectionPool>} - הבטחה (Promise) המחזירה את הבריכה הפעילה לשימוש השאילתות.
 * @throws {Error} זורקת שגיאה אם חסרה מחרוזת ההתקשרות ב-.env או אם החיבור למסד הנתונים נכשל.
 */
const getPool = async () => {
    if (!connectionString) {
        throw new Error("Missing AZURE_SQL_CONNECTION_STRING. Check your .env file.");
    }
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

const poolPromise = {
    then: function(resolve, reject) {
        return getPool().then(resolve).catch(reject);
    }
};

process.on('unhandledRejection', (reason) => {
    console.error('⚠️  FATAL ERROR: Unhandled Promise Rejection:', reason);
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️  FATAL ERROR: Uncaught Exception:', err.message);
    console.error(err.stack);
    process.exit(1);
});

module.exports = {
    sql,
    poolPromise
};
