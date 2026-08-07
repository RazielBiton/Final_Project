/**
 * @fileoverview backend/server.js
 * @description קובץ הליבה של צד השרת (Express.js Server). משמש כנקודת הכניסה לאפליקציה (Entry Point), אחראי על ניהול צינורות המידע (API Routes), יצירת ממשק התקשרות מאובטח (CORS/Middleware), אימות והרשמה של משתמשים דרך Supabase/Azure SQL, וכן מכיל מערכות אינטגרציה מול Google Gemini AI לצורכי פענוח פוליסות ביטוח מורכבות וניהול צ'אט (מוסכניק וירטואלי).
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, '../frontend')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.5-flash";

const { sql, poolPromise } = require('./db');

/**
 * מידלוור (Middleware) למערכת. בדרך כלל משמש לאימות (Authentication) וחילוץ ה-UserID מתוך ה-Headers של הלקוח.
 * @param {express.Request} req - בקשת הלקוח, בה יוזרק מזהה המשתמש לאחר האימות.
 * @param {express.Response} res - תשובת השרת.
 * @param {express.NextFunction} next - קריאה להעברת הבקשה ל-Route הבא.
 */
app.use((req, res, next) => {

    if (req.path === '/api/login' || req.path === '/api/register' || req.path.startsWith('/api/auth/') || !req.path.startsWith('/api')) {
        return next();
    }
    const userId = req.headers['userid'];
    if (userId) {
        req.userId = parseInt(userId);
    } else {
        return res.status(401).json({ error: "Unauthorized: Missing userid in headers" });
    }
    next();
});

/**
 * מספק לממשק הלקוח (Client) את מפתח ה-API הציבורי של מפות גוגל (Google Maps) מתוך משתני הסביבה המוגנים של השרת, ללא צורך בהזדהות.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {void} - מבצע פעולה אסינכרונית או החזרת JSON.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/config/maps', (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY || '' });
});

/**
 * מבצעת הרשמה של משתמש חדש במערכת על ידי בדיקת כפילות מול מסד הנתונים (Azure SQL) ויצירת רשומה תחת הטבלה Users.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const pool = await poolPromise;
        const normalizedEmail = email.trim().toLowerCase();

        const check = await pool.request().input('Email', sql.NVarChar, normalizedEmail).query('SELECT Id FROM Users WHERE LOWER(TRIM(Email)) = @Email');
        if (check.recordset.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
            .input('PasswordHash', sql.NVarChar, password)
            .input('FullName', sql.NVarChar, fullName)
            .query('INSERT INTO Users (Email, PasswordHash, FullName) VALUES (@Email, @PasswordHash, @FullName)');

        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מאמתת (Authentication) את פרטי ההתחברות של המשתמש (אימייל וסיסמה) אל מול מסד הנתונים, ומחזירה את מזהה המשתמש הבלעדי במידה ונמצאה התאמה.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const pool = await poolPromise;
        const normalizedEmail = email.trim().toLowerCase();
        const result = await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
            .input('PasswordHash', sql.NVarChar, password)
            .query('SELECT Id, FullName FROM Users WHERE LOWER(TRIM(Email)) = @Email AND PasswordHash = @PasswordHash');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.recordset[0];
        res.json({ success: true, userId: user.Id, fullName: user.FullName });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מנהלת תהליך התחברות דרך ספקים חברתיים (Google/Apple). במידה והמשתמש לא קיים, היא מקימה עבורו חשבון חדש באופן אוטומטי. מזהה כפילויות לפי כתובת הדוא"ל ומקשרת לחשבון הקיים או העשיר ביותר מבחינת היסטוריה.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/auth/social-login', async (req, res) => {
    try {
        const { email, fullName, provider, providerId } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required for social login' });
        }

        const pool = await poolPromise;
        const normalizedEmail = email.trim().toLowerCase();

        const result = await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
            .query(`
                SELECT u.Id, u.FullName, u.AuthProvider, 
                (SELECT COUNT(*) FROM Vehicles v WHERE v.UserId = u.Id AND v.IsDeleted = 0) as VehicleCount
                FROM Users u 
                WHERE LOWER(TRIM(u.Email)) = @Email
                ORDER BY VehicleCount DESC, u.CreatedAt ASC
            `);

        if (result.recordset.length > 0) {

            const user = result.recordset[0];

            await pool.request()
                .input('Id', sql.Int, user.Id)
                .input('AuthProvider', sql.NVarChar, provider)
                .input('ProviderId', sql.NVarChar, providerId)
                .query('UPDATE Users SET AuthProvider = @AuthProvider, ProviderId = @ProviderId WHERE Id = @Id');

            return res.json({ success: true, userId: user.Id, fullName: user.FullName });
        } else {

            const newFullName = fullName || normalizedEmail.split('@')[0];
            const insertResult = await pool.request()
                .input('Email', sql.NVarChar, normalizedEmail)
                .input('FullName', sql.NVarChar, newFullName)
                .input('AuthProvider', sql.NVarChar, provider)
                .input('ProviderId', sql.NVarChar, providerId)
                .query(`
                    INSERT INTO Users (Email, FullName, AuthProvider, ProviderId) 
                    OUTPUT INSERTED.Id 
                    VALUES (@Email, @FullName, @AuthProvider, @ProviderId)
                `);

            const newUserId = insertResult.recordset[0].Id;
            return res.json({ success: true, userId: newUserId, fullName: newFullName });
        }
    } catch (err) {
        console.error('Social login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * חשיפת נתוני ההתחברות לשירות Supabase לטובת מודולים ב-Frontend (כגון טפסי יצירת קשר ושירותי OTP).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {void} - מבצע פעולה אסינכרונית או החזרת JSON.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/config/supabase', (req, res) => {
    res.json({
        url: supabaseUrl,
        key: supabaseKey
    });
});

/**
 * מספק לממשק הלקוח (Client) את מפתח ה-API הציבורי של מפות גוגל (Google Maps) מתוך משתני הסביבה המוגנים של השרת, ללא צורך בהזדהות.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {void} - מבצע פעולה אסינכרונית או החזרת JSON.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/config/maps', (req, res) => {
    res.json({
        key: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

/**
 * שולחת למשתמש קוד חד-פעמי (OTP) לכתובת האימייל לצורך אימות או שחזור סיסמה דרך שירותי Supabase Auth.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const pool = await poolPromise;
        const normalizedEmail = email.trim().toLowerCase();
        const check = await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
            .query('SELECT Id FROM Users WHERE LOWER(TRIM(Email)) = @Email');

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'משתמש עם אימייל זה לא נמצא במערכת.' });
        }

        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: { shouldCreateUser: true }
        });

        if (error) {
            console.error('Supabase OTP Send Error:', error);
            return res.status(500).json({ error: 'שגיאה בשליחת קוד לאימייל: ' + error.message });
        }

        console.log('OTP sent successfully to:', email);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('OTP send error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מאמתת את קוד ה-OTP מול Supabase. במידה והקוד תקין, הפונקציה מנצלת את האישור כדי לדרוס את הסיסמה הישנה של המשתמש במסד הנתונים של Azure SQL בסיסמה חדשה.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) return res.status(400).json({ error: 'Missing parameters' });

        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token,
            type: 'email'
        });

        if (error) {
            console.error('OTP Verify Error:', error);
            return res.status(400).json({ error: 'קוד OTP שגוי או פג תוקף: ' + error.message });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('Email', sql.NVarChar, normalizedEmail)
            .input('PasswordHash', sql.NVarChar, newPassword)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE LOWER(TRIM(Email)) = @Email');

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('OTP verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מאמתת בלבד את קוד ה-OTP (ללא שינוי סיסמה בפועל) ומשמשת כשלב וידוא אבטחה בעת עדכון פרטי חשבון רגישים (כגון אימייל חלופי).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/auth/verify-otp-only', async (req, res) => {
    try {
        const { email, token } = req.body;
        if (!email || !token) return res.status(400).json({ error: 'Missing parameters' });

        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error) {
            console.error('OTP Verify-Only Error:', error);
            return res.status(400).json({ error: 'קוד OTP שגוי או פג תוקף: ' + error.message });
        }

        console.log('OTP verified successfully for:', email);
        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (err) {
        console.error('OTP verify-only error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מאפשרת שינוי סיסמה מתוך פרופיל המשתמש, באמצעות דרישת הזנת הסיסמה הנוכחית לשם וידוא והחלפתה בחדשה במסד הנתונים.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/auth/reset-password-direct', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing parameters' });

        const pool = await poolPromise;

        const user = await pool.request()
            .input('Id', sql.Int, req.userId)
            .query('SELECT PasswordHash FROM Users WHERE Id = @Id');

        if (user.recordset.length === 0) return res.status(404).json({ error: 'User not found' });

        const storedPassword = user.recordset[0].PasswordHash;
        if (storedPassword !== currentPassword) {
            return res.status(401).json({ error: 'הסיסמה הנוכחית שהזנת אינה נכונה.' });
        }

        await pool.request()
            .input('Id', sql.Int, req.userId)
            .input('PasswordHash', sql.NVarChar, newPassword)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE Id = @Id');

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Direct password reset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * שולפת את פרטי הפרופיל הבסיסיים (אימייל, שם, טלפון, ותמונת פרופיל) של המשתמש הנוכחי על סמך מזהה ה-userId המועבר ב-Headers.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/user/me', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Id', sql.Int, req.userId)
            .query('SELECT Email, FullName, Phone, Avatar FROM Users WHERE Id = @Id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user: result.recordset[0] });
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * מעדכנת את פרטי הפרופיל של המשתמש המחובר, לרבות הזרקת תמונת פרופיל בפורמט Base64 אל תוך בסיס הנתונים.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/user/update', async (req, res) => {
    try {
        const { fullName, email, phone, avatar } = req.body;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const pool = await poolPromise;
        await pool.request()
            .input('Id', sql.Int, userId)
            .input('FullName', sql.NVarChar, fullName || null)
            .input('Email', sql.NVarChar, email || null)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Avatar', sql.NVarChar(sql.MAX), avatar || null)
            .query(`UPDATE Users 
                   SET FullName = @FullName, Email = @Email, Phone = @Phone, Avatar = @Avatar, UpdatedAt = GETDATE() 
                   WHERE Id = @Id`);

        res.json({ success: true });
    } catch (err) {
        console.error('Profile update failed:', err);
        res.status(500).json({ error: 'Update failed' });
    }
});

/**
 * מושכת את רשימת כלל כלי הרכב המשויכים למשתמש המחובר (IsDeleted = 0). בנוסף, שולפת באופן מעמיק את כלל ההיסטוריה (טיפולים, ביטוחים, תאונות) לכל רכב במטרה לספק לוח בקרה הוליסטי.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/vehicles', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .query('SELECT * FROM Vehicles WHERE UserId = @UserId AND IsDeleted = 0');

        const vehicles = result.recordset;

        const comprehensiveVehicles = await Promise.all(vehicles.map(async (car) => {
            const vehicleId = car.Id;

            const treatments = await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Treatments WHERE VehicleId=@Vid');
            const fuelLog = await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM FuelLogs WHERE VehicleId=@Vid');
            const insurance = await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Insurance WHERE VehicleId=@Vid');
            const accidents = await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Accidents WHERE VehicleId=@Vid');
            const alerts = await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Alerts WHERE VehicleId=@Vid');

            return {
                ...car,
                treatments: treatments.recordset.map(t => ({ id: t.Id, date: t.Date, cost: t.Cost, invoice: t.DocumentBase64 })),
                fuelLog: fuelLog.recordset.map(f => ({ id: f.Id, date: f.Date, cost: f.TotalCost })),
                insurance: insurance.recordset.reduce((acc, ins) => {
                    const typeMap = { 'חובה': 'mandatory', 'מקיף': 'comprehensive', 'צד ג': 'thirdparty' };
                    const key = typeMap[ins.Type] || ins.Type.toLowerCase();
                    acc[key] = {
                        company: ins.CompanyName || '',
                        policyNum: ins.PolicyNumber || '',
                        cost: parseFloat(ins.Cost) || 0,
                        date: ins.ExpiryDate,
                        file: ins.DocumentBase64,
                        towing: ins.TowingService || '',
                        replacement: ins.ReplacementCar || '',
                        glass: ins.GlassCoverage || '',
                        agentName: ins.AgentName || '',
                        agentPhone: ins.AgentPhone || '',
                        driverLimit: ins.DriverLimit || '',
                        deductible: ins.Deductible || '',
                        protection: ins.ProtectionMeasures || ''
                    };
                    return acc;
                }, {}),
                accidents: accidents.recordset.map(a => ({ id: a.Id, date: a.Date, cost: a.Cost })),
                alerts: alerts.recordset.map(a => ({ id: a.Id, title: a.Title, date: a.Date, isActive: a.IsActive }))
            };
        }));

        res.json(comprehensiveVehicles);
    } catch (err) {
        console.error('Failed to get vehicles:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * מספקת באופן גלובלי את פרטיהם הבסיסיים של כל רכבי המשתמש לצורכי מנגנוני השלמה אוטומטית (Autocomplete) במסכי החיפוש הכלליים.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/vehicles/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .query('SELECT * FROM Vehicles WHERE UserId = @UserId AND IsDeleted = 0');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * רושמת ומוסיפה כלי רכב חדש לתיק המשתמש (CREATE). מבצעת ולידציות של לוחית הרישוי בכדי למנוע שיוך כפול בבסיס הנתונים, ומחזירה את המזהה החדש שנוצר.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/vehicles', async (req, res) => {
    try {
        const car = req.body;
        const pool = await poolPromise;

        const parseDateForSql = (d) => {
            if (!d || d === '' || d === 'אין נתונים') return null;
            if (typeof d === 'string' && d.includes('/')) return d.split('/').reverse().join('-');
            return d;
        };

        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .input('LicensePlate', sql.NVarChar, car.licensePlate)
            .input('BrandHeb', sql.NVarChar, car.brandHeb)
            .input('Model', sql.NVarChar, car.model)
            .input('Year', sql.Int, car.year)
            .input('Color', sql.NVarChar, car.color)
            .input('FuelType', sql.NVarChar, car.fuelType)
            .input('TestDate', sql.Date, parseDateForSql(car.testDate))
            .input('LicenseExpiry', sql.Date, parseDateForSql(car.licenseExpiry))
            .input('Pollution', sql.Int, car.pollution ? parseInt(car.pollution) : null)
            .input('TireFront', sql.NVarChar, car.tireFront)
            .input('TireRear', sql.NVarChar, car.tireRear)
            .input('EngineVolume', sql.Int, car.engineVolume ? parseInt(car.engineVolume) : null)
            .input('HorsePower', sql.Int, car.horsePower ? parseInt(car.horsePower) : null)
            .input('Km', sql.Int, car.km ? parseInt(car.km) : 0)
            .input('Status', sql.NVarChar, car.status || 'פעיל')
            .input('ReliabilityScore', sql.Int, car.reliabilityScore || 100)
            .input('HasDisabledTag', sql.Bit, car.hasDisabledTag ? 1 : 0)
            .input('Logo', sql.NVarChar, car.logo)
            .query(`
                INSERT INTO Vehicles 
                (UserId, LicensePlate, BrandHeb, Model, Year, Color, FuelType, TestDate, LicenseExpiry, Pollution, TireFront, TireRear, EngineVolume, HorsePower, Km, Status, ReliabilityScore, HasDisabledTag, Logo)
                OUTPUT INSERTED.Id
                VALUES
                (@UserId, @LicensePlate, @BrandHeb, @Model, @Year, @Color, @FuelType, @TestDate, @LicenseExpiry, @Pollution, @TireFront, @TireRear, @EngineVolume, @HorsePower, @Km, @Status, @ReliabilityScore, @HasDisabledTag, @Logo)
            `);

        res.json({ success: true, vehicleId: result.recordset[0].Id });
    } catch (err) {
        console.error('Failed to add vehicle:', err);

        if (err.number === 2627 || (err.originalError && err.originalError.info && err.originalError.info.number === 2627)) {
            try {
                const pool = await poolPromise;
                const ownerQuery = await pool.request()
                    .input('LicensePlate', sql.NVarChar, req.body.licensePlate)
                    .query(`
                        SELECT u.FullName 
                        FROM Vehicles v
                        JOIN Users u ON v.UserId = u.Id
                        WHERE v.LicensePlate = @LicensePlate
                    `);
                
                if (ownerQuery.recordset.length > 0) {
                    const ownerName = ownerQuery.recordset[0].FullName;
                    return res.status(400).json({ 
                        error: `הרכב עם מספר הרישוי ${req.body.licensePlate} כבר רשום במערכת תחת המשתמש: ${ownerName}.` 
                    });
                }
            } catch (innerErr) {
                console.error('Error fetching owner info:', innerErr);
            }
            return res.status(400).json({ error: 'רכב עם מספר רישוי זה כבר קיים במערכת.' });
        }

        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * מעדכנת רשומת רכב קיימת (UPDATE) על סמך זיהוי ב-Params, תומכת בעדכון חלקי של פרטים טכניים, קילומטראז׳ ולוגו במאגר.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.put('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { brandHeb, model, logo, status, reliabilityScore, year, color, fuelType, testDate, pollution, tireFront, tireRear, engineVolume, horsePower, km } = req.body;
        const pool = await poolPromise;

        const parseDateForSql = (d) => {
            if (d === undefined) return undefined; 
            if (!d || d === '' || d === 'אין נתונים') return null;
            if (typeof d === 'string' && d.includes('/')) return d.split('/').reverse().join('-');
            return d;
        };

        const parsedTestDate = parseDateForSql(testDate);

        await pool.request()
            .input('Id', sql.Int, id)
            .input('UserId', sql.Int, req.userId)
            .input('BrandHeb', sql.NVarChar, brandHeb)
            .input('Model', sql.NVarChar, model)
            .input('Year', sql.Int, year !== undefined ? (year ? parseInt(year) : null) : undefined)
            .input('Color', sql.NVarChar, color !== undefined ? color : undefined)
            .input('FuelType', sql.NVarChar, fuelType !== undefined ? fuelType : undefined)
            .input('TestDate', sql.Date, parsedTestDate)
            .input('TireFront', sql.NVarChar, tireFront !== undefined ? tireFront : undefined)
            .input('TireRear', sql.NVarChar, tireRear !== undefined ? tireRear : undefined)
            .input('EngineVolume', sql.Int, engineVolume !== undefined ? (engineVolume ? parseInt(engineVolume) : null) : undefined)
            .input('HorsePower', sql.Int, horsePower !== undefined ? (horsePower ? parseInt(horsePower) : null) : undefined)
            .input('Km', sql.Int, km !== undefined ? (km ? parseInt(km) : 0) : undefined)
            .input('Status', sql.NVarChar, status !== undefined ? (status || 'פעיל') : undefined)
            .input('ReliabilityScore', sql.Int, reliabilityScore !== undefined ? (!isNaN(parseInt(reliabilityScore)) ? parseInt(reliabilityScore) : 100) : undefined)
            .input('Logo', sql.NVarChar, logo !== undefined ? logo : undefined)
            .query(`
                UPDATE Vehicles 
                SET BrandHeb = ISNULL(@BrandHeb, BrandHeb), 
                    Model = ISNULL(@Model, Model), 
                    Year = ISNULL(@Year, Year), 
                    Color = ISNULL(@Color, Color), 
                    FuelType = ISNULL(@FuelType, FuelType), 
                    TestDate = ISNULL(@TestDate, TestDate), 
                    TireFront = ISNULL(@TireFront, TireFront), 
                    TireRear = ISNULL(@TireRear, TireRear), 
                    EngineVolume = ISNULL(@EngineVolume, EngineVolume), 
                    HorsePower = ISNULL(@HorsePower, HorsePower), 
                    Km = ISNULL(@Km, Km), 
                    Logo = ISNULL(@Logo, Logo), 
                    Status = ISNULL(@Status, Status), 
                    ReliabilityScore = ISNULL(@ReliabilityScore, ReliabilityScore), 
                    UpdatedAt = GETDATE()
                WHERE Id = @Id AND UserId = @UserId
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to update vehicle:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * מסירה רכב ספציפי מהמערכת (Soft או Hard Delete בהתאם למנגנון) תוך וידוא כי מזהה המשתמש מבקש המחיקה הוא אכן בעל הרכב.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        await pool.request()
            .input('Id', sql.Int, id)
            .input('UserId', sql.Int, req.userId)
            .query('DELETE FROM Vehicles WHERE Id = @Id AND UserId = @UserId');

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to delete vehicle:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * קוראת ושולפת את מערך הדוחות והקנסות הרשומים על מזהה רכב ספציפי מתוך מסד הנתונים של הקנסות.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/fines/:vehicleId', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Fines WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * קולטת ומכניסה דוח/קנס תנועה חדש לטבלת Fines המשויכת לרכב ספציפי, ושומרת את תצלומו.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/fines', async (req, res) => {
    try {
        const { vehicleId, offenseType, date, lastPaymentDate, location, amount, points, documentBase64, isHandled } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('VehicleId', sql.Int, vehicleId)
            .input('OffenseType', sql.NVarChar, offenseType)
            .input('Date', sql.Date, date)
            .input('LastPaymentDate', sql.Date, lastPaymentDate)
            .input('Location', sql.NVarChar, location)
            .input('Amount', sql.Decimal(10, 2), amount)
            .input('Points', sql.Int, points)
            .input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64)
            .input('IsHandled', sql.Bit, isHandled ? 1 : 0)
            .query(`
                INSERT INTO Fines (VehicleId, OffenseType, Date, LastPaymentDate, Location, Amount, Points, DocumentBase64, IsHandled)
                OUTPUT INSERTED.Id
                VALUES (@VehicleId, @OffenseType, @Date, @LastPaymentDate, @Location, @Amount, @Points, @DocumentBase64, @IsHandled)
            `);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * מושכת את כלל התמונות שהועלו במערך Base64 לגלריית הרכב (לצורכי דוחות ופומביות) על סמך מזהה הרכב המבוקש.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/gallery/:vehicleId', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM VehicleGallery WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * מכניסה תמונה חדשה לטבלת הגלריה הפרטית של רכב נבחר במערכת על מנת להציגה בדוח הפרימיום.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/gallery', async (req, res) => {
    try {
        const { vehicleId, imageBase64 } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('VehicleId', sql.Int, vehicleId)
            .input('ImageBase64', sql.NVarChar, imageBase64)
            .query(`
                INSERT INTO VehicleGallery (VehicleId, ImageBase64) 
                OUTPUT INSERTED.Id 
                VALUES (@VehicleId, @ImageBase64)
            `);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * שולפת מהמאגר המרכזי את רשימת הטיפולים, התיקונים והתחזוקה המשויכים למזהה רכב ספציפי במסד הנתונים.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/treatments/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Treatments WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * מקבלת נתוני טיפול חדש מהלקוח (כולל קילומטראז׳ ועלות) ורושמת אותם היסטורית למאגר הטיפולים של הרכב הנתון.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/treatments', async (req, res) => {
    try {
        const { vehicleId, date, type, description, cost, garageName, odometer, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date)
            .input('Type', sql.NVarChar, type).input('Description', sql.NVarChar, description)
            .input('Cost', sql.Decimal(10, 2), cost).input('GarageName', sql.NVarChar, garageName)
            .input('Odometer', sql.Int, odometer).input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64)
            .query(`INSERT INTO Treatments (VehicleId, Date, Type, Description, Cost, GarageName, Odometer, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Type, @Description, @Cost, @GarageName, @Odometer, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

/**
 * מוציאה את היסטוריית התדלוקים ו/או טעינות החשמל של הרכב הנידון מתוך טבלת FuelLogs לאנליזה מצד הממשק.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/fuellogs/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM FuelLogs WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * מעבדת ורושמת אירוע תדלוק או טעינה חשמלית חדש. מתעדת כמות ליטרים, עלויות מדויקות וקילומטראז׳ עבור ניטור חכם.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/fuellogs', async (req, res) => {
    try {
        const { vehicleId, date, time, liters, pricePerLiter, totalCost, odometer, documentBase64, fuelType } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date).input('Time', sql.Time, time)
            .input('Liters', sql.Decimal(8, 2), liters).input('PricePerLiter', sql.Decimal(8, 2), pricePerLiter)
            .input('TotalCost', sql.Decimal(10, 2), totalCost).input('Odometer', sql.Int, odometer)
            .input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64)
            .input('FuelType', sql.NVarChar, fuelType)
            .query(`INSERT INTO FuelLogs (VehicleId, Date, Time, Liters, PricePerLiter, TotalCost, Odometer, DocumentBase64, FuelType) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Time, @Liters, @PricePerLiter, @TotalCost, @Odometer, @DocumentBase64, @FuelType)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

/**
 * מאתרת מחזירה את תדפיס ההוצאות החופשיות (ניקויון, אביזרים, אגרות) המשויכות למזהה הרכב הנדרש.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/expenses/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Expenses WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * שומרת רשומת הוצאה ספציפית ומקטלגת אותה בטבלת Expenses מול מזהה הרכב.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/expenses', async (req, res) => {
    try {
        const { vehicleId, date, category, amount, description, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date).input('Category', sql.NVarChar, category)
            .input('Amount', sql.Decimal(10, 2), amount).input('Description', sql.NVarChar, description)
            .input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64)
            .query(`INSERT INTO Expenses (VehicleId, Date, Category, Amount, Description, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Category, @Amount, @Description, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

/**
 * שולפת את התיק הביטוחי/תאונות המצטבר (Accidents Table) תחת מספר הרכב הייעודי מהשרת.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/accidents/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Accidents WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * מוסיפה דיווח על נזק או תאונה (כולל מעורבות צד ג׳ ופרטי מיקום) להיסטוריית הרכב, במטרה לשקפו בזמן מכירה.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/accidents', async (req, res) => {
    try {
        const { vehicleId, title, date, description, damageDetails, estimatedCost, cost, documentBase64, thirdPartyInvolved, isHandled, location } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Title', sql.NVarChar, title).input('Date', sql.Date, date)
            .input('Description', sql.NVarChar, description).input('DamageDetails', sql.NVarChar, damageDetails)
            .input('EstimatedCost', sql.Decimal(10, 2), estimatedCost).input('Cost', sql.Decimal(10, 2), cost)
            .input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64).input('ThirdPartyInvolved', sql.Bit, thirdPartyInvolved ? 1 : 0)
            .input('IsHandled', sql.Bit, isHandled ? 1 : 0).input('Location', sql.NVarChar, location || '')
            .query(`INSERT INTO Accidents (VehicleId, Title, Date, Description, DamageDetails, EstimatedCost, Cost, DocumentBase64, ThirdPartyInvolved, IsHandled, Location) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Title, @Date, @Description, @DamageDetails, @EstimatedCost, @Cost, @DocumentBase64, @ThirdPartyInvolved, @IsHandled, @Location)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

/**
 * קוראת את מערך ההתראות המותאמות אישית והתזכורות האקטיביות הרשומות עבור רכב נבחר במערכת.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/alerts/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Alerts WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * מייצרת רשומת התראה או תזכורת פנימית ומוסיפה אותה לטבלת Alerts (כולל סיווג דחיפות).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/alerts', async (req, res) => {
    try {
        const { vehicleId, title, description, date, urgency, frequency, isActive } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Title', sql.NVarChar, title).input('Description', sql.NVarChar, description)
            .input('Date', sql.Date, date).input('Urgency', sql.NVarChar, urgency).input('Frequency', sql.NVarChar, frequency)
            .input('IsActive', sql.Bit, isActive !== false ? 1 : 0)
            .query(`INSERT INTO Alerts (VehicleId, Title, Description, Date, Urgency, Frequency, IsActive) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Title, @Description, @Date, @Urgency, @Frequency, @IsActive)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

/**
 * שולפת פוליסות ורישיונות ביטוח רכב השמורים תחת המזהה, לרבות מזהה תוקף ותנאי השתתפות עצמית.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/insurance/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Insurance WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
/**
 * טוענת אל בסיס הנתונים פוליסת ביטוח חדשה למערכת (מקיף/חובה/צד ג׳), הכוללת כיסויים דוגמת שמשות, גרירה ותוספות.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/insurance', async (req, res) => {
    try {
        const { vehicleId, companyName, policyNumber, expiryDate, type, cost, documentBase64,
            towing, replacement, glass, agentName, agentPhone, driverLimit, deductible, protection } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('CompanyName', sql.NVarChar, companyName)
            .input('PolicyNumber', sql.NVarChar, policyNumber).input('ExpiryDate', sql.Date, expiryDate)
            .input('Type', sql.NVarChar, type).input('Cost', sql.Decimal(10, 2), cost)
            .input('DocumentBase64', sql.NVarChar(sql.MAX), documentBase64)
            .input('Towing', sql.NVarChar, towing).input('Replacement', sql.NVarChar, replacement)
            .input('Glass', sql.NVarChar, glass).input('AgentName', sql.NVarChar, agentName)
            .input('AgentPhone', sql.NVarChar, agentPhone).input('DriverLimit', sql.NVarChar, driverLimit)
            .input('Deductible', sql.NVarChar, deductible).input('Protection', sql.NVarChar, protection)
            .query(`INSERT INTO Insurance (VehicleId, CompanyName, PolicyNumber, ExpiryDate, Type, Cost, DocumentBase64, 
                                          TowingService, ReplacementCar, GlassCoverage, AgentName, AgentPhone, DriverLimit, Deductible, ProtectionMeasures) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @CompanyName, @PolicyNumber, @ExpiryDate, @Type, @Cost, @DocumentBase64,
                                              @Towing, @Replacement, @Glass, @AgentName, @AgentPhone, @DriverLimit, @Deductible, @Protection)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

/**
 * נקודת קצה אינטנסיבית (Mass Sync - GET). מבצעת גיבוי ושליפה מסיבית מקושרת של כלל נתוני הרכב (טיפולים, ביטוחים, הוצאות, גלריה וכו׳) מטבלאות המסד חזרה לכדי JSON שטוח בפורמט שהצד-לקוח מצפה לקבל כמענה לסנכרון.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/vehicles/sync/:id', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const pool = await poolPromise;
        const vRes = await pool.request()
            .input('Id', sql.Int, vehicleId)
            .query('SELECT * FROM Vehicles WHERE Id = @Id AND IsDeleted = 0');
        if (vRes.recordset.length === 0) return res.status(404).json({ error: 'Not found' });

        const car = vRes.recordset[0];

        car.treatments = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Treatments WHERE VehicleId=@Vid')).recordset;
        car.fuelLog = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM FuelLogs WHERE VehicleId=@Vid')).recordset;
        car.expenses = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Expenses WHERE VehicleId=@Vid')).recordset;
        car.accidents = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Accidents WHERE VehicleId=@Vid')).recordset;
        car.alerts = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Alerts WHERE VehicleId=@Vid')).recordset;
        car.insurance = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Insurance WHERE VehicleId=@Vid')).recordset;
        car.reports = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM Fines WHERE VehicleId=@Vid')).recordset;
        car.gallery = (await pool.request().input('Vid', sql.Int, vehicleId).query('SELECT * FROM VehicleGallery WHERE VehicleId=@Vid')).recordset;

        const frontendCar = {
            id: car.Id,
            brandHeb: car.BrandHeb,
            model: car.Model,
            year: car.Year,
            licensePlate: car.LicensePlate,
            color: car.Color,
            fuelType: car.FuelType,
            testDate: car.TestDate,
            licenseExpiry: car.LicenseExpiry,
            pollution: car.Pollution,
            tireFront: car.TireFront,
            tireRear: car.TireRear,
            engineVolume: car.EngineVolume,
            horsePower: car.HorsePower,
            km: car.Km || 0,
            status: car.Status,
            reliabilityScore: car.ReliabilityScore,
            hasDisabledTag: car.HasDisabledTag,
            logo: car.Logo,
            sellSettings: (() => { try { return car.SellSettings ? JSON.parse(car.SellSettings) : null; } catch(e) { return null; } })(),

            treatments: (car.treatments || []).map(t => ({
                id: t.Id,
                date: t.Date,
                type: t.Type || t.Description || '',
                garage: t.GarageName || '',
                km: t.Odometer || 0,
                cost: parseFloat(t.Cost) || 0,
                invoice: t.DocumentBase64 || null
            })),

            fuelLog: (car.fuelLog || []).map(f => ({
                id: f.Id,
                date: f.Date,
                amount: parseFloat(f.Liters) || null,
                cost: parseFloat(f.TotalCost) || 0,
                pricePerLiter: parseFloat(f.PricePerLiter) || null,
                odometer: f.Odometer || null,
                energyType: f.FuelType || ((f.Liters && parseFloat(f.Liters) > 0) ? 'fuel' : 'electricity')
            })),

            expenses: (car.expenses || []).map(e => ({
                id: e.Id,
                type: e.Category || '',
                date: e.Date,
                amount: parseFloat(e.Amount) || 0,
                notes: e.Description || ''
            })),

            accidents: (car.accidents || []).map(a => ({
                id: a.Id,
                title: a.Title || '',
                date: a.Date,
                description: a.Description || '',
                location: a.Location || '',
                damageDetails: a.DamageDetails || '',
                repairCost: parseFloat(a.EstimatedCost || a.RepairCost || a.Cost) || 0,
                cost: parseFloat(a.EstimatedCost || a.RepairCost || a.Cost) || 0,
                thirdPartyInvolved: !!a.ThirdPartyInvolved,
                isHandled: !!a.IsHandled,
                status: a.IsHandled ? 'resolved' : 'unresolved',
                involvedVehicles: (() => { try { const p = JSON.parse(a.DamageDetails); return Array.isArray(p) ? p : []; } catch(e) { return []; } })(),
                images: (() => { try { const p = JSON.parse(a.DocumentBase64); return Array.isArray(p) ? p : (a.DocumentBase64 ? [a.DocumentBase64] : []); } catch(e) { return a.DocumentBase64 ? [a.DocumentBase64] : []; } })()
            })),

            customAlerts: (car.alerts || []).map(a => ({
                id: String(a.Id),
                title: a.Title || '',
                description: a.Description || '',
                date: a.Date ? (typeof a.Date === 'string' ? a.Date.split('T')[0] : new Date(a.Date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
                priority: a.Urgency || 'gray',
                urgency: a.Urgency || 'gray',
                frequency: a.Frequency || 'once',
                done: a.IsActive === false || a.IsActive === 0
            })),
            alerts: (car.alerts || []).map(a => ({
                id: a.Id,
                title: a.Title || '',
                date: a.Date,
                isActive: a.IsActive,
                urgency: a.Urgency,
                frequency: a.Frequency
            })),

            insurance: (car.insurance || []).length > 0 ? {
                mandatory: (() => {
                    const i = car.insurance.find(x => x.Type === 'חובה');
                    return i ? {
                        company: i.CompanyName || '', policyNum: i.PolicyNumber || '',
                        cost: parseFloat(i.Cost) || 0, date: i.ExpiryDate, file: i.DocumentBase64 || null,
                        towing: i.TowingService || '', replacement: i.ReplacementCar || '',
                        glass: i.GlassCoverage || '', agentName: i.AgentName || '',
                        agentPhone: i.AgentPhone || '', driverLimit: i.DriverLimit || '',
                        deductible: i.Deductible || '', protection: i.ProtectionMeasures || ''
                    } : null;
                })(),
                comprehensive: (() => {
                    const i = car.insurance.find(x => x.Type === 'מקיף');
                    return i ? {
                        company: i.CompanyName || '', policyNum: i.PolicyNumber || '',
                        cost: parseFloat(i.Cost) || 0, date: i.ExpiryDate, file: i.DocumentBase64 || null,
                        towing: i.TowingService || '', replacement: i.ReplacementCar || '',
                        glass: i.GlassCoverage || '', agentName: i.AgentName || '',
                        agentPhone: i.AgentPhone || '', driverLimit: i.DriverLimit || '',
                        deductible: i.Deductible || '', protection: i.ProtectionMeasures || ''
                    } : null;
                })(),
                thirdparty: (() => {
                    const i = car.insurance.find(x => x.Type === 'צד ג');
                    return i ? {
                        company: i.CompanyName || '', policyNum: i.PolicyNumber || '',
                        cost: parseFloat(i.Cost) || 0, date: i.ExpiryDate, file: i.DocumentBase64 || null,
                        towing: i.TowingService || '', replacement: i.ReplacementCar || '',
                        glass: i.GlassCoverage || '', agentName: i.AgentName || '',
                        agentPhone: i.AgentPhone || '', driverLimit: i.DriverLimit || '',
                        deductible: i.Deductible || '', protection: i.ProtectionMeasures || ''
                    } : null;
                })()
            } : {},

            gallery: (car.gallery || []).map(g => g.ImageBase64).filter(Boolean),

            reports: (car.reports || []).map(r => {
                let typeVal = r.OffenseType || 'other';
                let title = '';
                if (typeVal === 'parking') title = 'חניה במקום אסור';
                else if (typeVal === 'speeding') title = 'מהירות מופרזת';
                else if (typeVal === 'phone') title = 'שימוש בטלפון נייד';
                else title = typeVal.startsWith('other:') ? typeVal.substring(6) : typeVal;
                return {
                    id: r.Id,
                    typeVal: typeVal,
                    title: title,
                    date: r.Date,
                    dueDate: r.LastPaymentDate,
                    amount: parseFloat(r.Amount) || 0,
                    points: parseInt(r.Points) || 0,
                    location: r.Location || '',
                    status: r.IsHandled ? 'paid' : 'unpaid',
                    images: (() => { try { const p = JSON.parse(r.DocumentBase64); return Array.isArray(p) ? p : (r.DocumentBase64 ? [r.DocumentBase64] : []); } catch(e) { return r.DocumentBase64 ? [r.DocumentBase64] : []; } })()
                };
            })
        };

        res.json(frontendCar);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

/**
 * ליבת תהליך הסנכרון והשמירה (Mass Sync - POST). מנוהלת דרך Transaction על מסד הנתונים כדי למנוע קריסה חלקית (Data Corruption). מרוקנת באופן בטוח טבלאות ילד (טיפולים, דלק, ביטוח וכו׳) ומחליפה אותם במידע העדכני ביותר שהתקבל, תוך בדיקת שייכות (Tenant Isolation) קפדנית.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/vehicles/sync/:id', async (req, res) => {
    let transaction;
    try {
        const vehicleId = parseInt(req.params.id);
        const car = req.body;
        const pool = await poolPromise;

        const checkOwnership = await pool.request()
            .input('Id', sql.Int, vehicleId)
            .input('UserId', sql.Int, req.userId)
            .query('SELECT Id FROM Vehicles WHERE Id = @Id AND UserId = @UserId AND IsDeleted = 0');
        
        if (checkOwnership.recordset.length === 0) {
            return res.status(403).json({ error: 'Access denied or vehicle deleted' });
        }

        const parseDateForSql = (d) => {
            if (!d) return null;
            if (typeof d === 'string' && d.includes('/')) return d.split('/').reverse().join('-');
            return d;
        };

        transaction = new sql.Transaction(pool);
        await transaction.begin();
        const req2 = () => new sql.Request(transaction);

        await req2()
            .input('Id', sql.Int, vehicleId)
            .input('Km', sql.Int, car.km || 0)
            .input('Status', sql.NVarChar, car.status || 'פעיל')
            .input('ReliabilityScore', sql.Int, car.reliabilityScore || 100)
            .input('SellSettings', sql.NVarChar(sql.MAX), car.sellSettings ? JSON.stringify(car.sellSettings) : null)
            .query('UPDATE Vehicles SET Km=@Km, Status=@Status, ReliabilityScore=@ReliabilityScore, SellSettings=@SellSettings, UpdatedAt=GETDATE() WHERE Id=@Id');

        if (Array.isArray(car.treatments)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Treatments WHERE VehicleId = @Vid');
            for (const t of car.treatments) {
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Date', sql.Date, parseDateForSql(t.date) || new Date())
                    .input('Type', sql.NVarChar, t.type || 'Treatment')
                    .input('Description', sql.NVarChar, t.type || '')
                    .input('Garage', sql.NVarChar, t.garage || '')
                    .input('Cost', sql.Decimal(10, 2), parseFloat(t.cost) || 0)
                    .input('Km', sql.Int, parseInt(t.km) || 0)
                    .input('Doc', sql.NVarChar(sql.MAX), t.invoice || null)
                    .query('INSERT INTO Treatments (VehicleId, Date, Type, Description, GarageName, Cost, Odometer, DocumentBase64) VALUES (@Vid, @Date, @Type, @Description, @Garage, @Cost, @Km, @Doc)');
            }
        }

        if (Array.isArray(car.fuelLog)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM FuelLogs WHERE VehicleId = @Vid');
            for (const f of car.fuelLog) {
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Date', sql.Date, parseDateForSql(f.date) || new Date())
                    .input('Liters', sql.Decimal(8, 2), parseFloat(f.amount) || 0)
                    .input('Cost', sql.Decimal(10, 2), parseFloat(f.cost) || 0)
                    .input('Price', sql.Decimal(8, 2), parseFloat(f.pricePerLiter) || 0)
                    .input('Odometer', sql.Int, parseInt(f.odometer) || null)
                    .input('FuelType', sql.NVarChar, f.energyType || null)
                    .query('INSERT INTO FuelLogs (VehicleId, Date, Liters, PricePerLiter, TotalCost, Odometer, FuelType) VALUES (@Vid, @Date, @Liters, @Price, @Cost, @Odometer, @FuelType)');
            }
        }

        if (Array.isArray(car.expenses)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Expenses WHERE VehicleId = @Vid');
            for (const e of car.expenses) {
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Date', sql.Date, parseDateForSql(e.date) || new Date())
                    .input('Cat', sql.NVarChar, e.type || e.typeOther || e.category || '')
                    .input('Amt', sql.Decimal(10, 2), parseFloat(e.amount) || 0)
                    .input('Desc', sql.NVarChar, e.notes || e.description || '')
                    .query('INSERT INTO Expenses (VehicleId, Date, Category, Amount, Description) VALUES (@Vid, @Date, @Cat, @Amt, @Desc)');
            }
        }

        if (Array.isArray(car.accidents)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Accidents WHERE VehicleId = @Vid');
            for (const a of car.accidents) {
                const repairCostVal = parseFloat(a.repairCost || a.cost || a.estimatedCost) || 0;

                const dmgDetails = a.damageDetails || 
                    (a.involvedVehicles && a.involvedVehicles.length > 0 ? JSON.stringify(a.involvedVehicles) : '') || '';
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Title', sql.NVarChar, a.title || '')
                    .input('Date', sql.Date, parseDateForSql(a.date) || new Date())
                    .input('Desc', sql.NVarChar, a.description || '')
                    .input('DmgDetails', sql.NVarChar(sql.MAX), dmgDetails)
                    .input('Cost', sql.Decimal(10, 2), repairCostVal)
                    .input('ThirdParty', sql.Bit, (a.thirdPartyInvolved || (a.involvedVehicles && a.involvedVehicles.length > 0)) ? 1 : 0)
                    .input('Handled', sql.Bit, (a.isHandled || a.status === 'resolved' || a.done === true) ? 1 : 0)
                    .input('Location', sql.NVarChar, a.location || '')
                    .input('Doc', sql.NVarChar(sql.MAX), (a.images && a.images.length ? JSON.stringify(a.images) : null))
                    .query('INSERT INTO Accidents (VehicleId, Title, Date, Description, DamageDetails, EstimatedCost, ThirdPartyInvolved, IsHandled, Location, DocumentBase64) VALUES (@Vid, @Title, @Date, @Desc, @DmgDetails, @Cost, @ThirdParty, @Handled, @Location, @Doc)');
            }
        }

        if (Array.isArray(car.reports)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Fines WHERE VehicleId = @Vid');
            for (const r of car.reports) {
                const reportType = r.typeVal || r.offenseType || '';
                const isPaid = (r.status === 'paid' || r.isHandled === true);
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Date', sql.Date, parseDateForSql(r.date) || new Date())
                    .input('Due', sql.Date, parseDateForSql(r.dueDate) || null)
                    .input('Type', sql.NVarChar, reportType)
                    .input('Amt', sql.Decimal(10, 2), parseFloat(r.amount) || 0)
                    .input('Loc', sql.NVarChar, r.location || '')
                    .input('Pts', sql.Int, parseInt(r.points) || 0)
                    .input('Han', sql.Bit, isPaid ? 1 : 0)
                    .input('Doc', sql.NVarChar(sql.MAX), (r.images && r.images.length ? JSON.stringify(r.images) : (r.file || null)))
                    .query('INSERT INTO Fines (VehicleId, Date, LastPaymentDate, OffenseType, Amount, Location, Points, IsHandled, DocumentBase64) VALUES (@Vid, @Date, @Due, @Type, @Amt, @Loc, @Pts, @Han, @Doc)');
            }
        }

        const alertsArray = car.customAlerts || car.alerts;
        if (Array.isArray(alertsArray)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Alerts WHERE VehicleId = @Vid');
            for (const a of alertsArray) {
                await req2()
                    .input('Vid', sql.Int, vehicleId)
                    .input('Date', sql.Date, parseDateForSql(a.date) || new Date())
                    .input('Title', sql.NVarChar, a.title || '')
                    .input('Desc', sql.NVarChar, a.description || '')
                    .input('Urg', sql.NVarChar, a.urgency || a.priority || 'normal')
                    .input('Freq', sql.NVarChar, a.frequency || 'once')
                    .input('IsActive', sql.Bit, a.done ? 0 : 1)
                    .query('INSERT INTO Alerts (VehicleId, Date, Title, Description, Urgency, Frequency, IsActive) VALUES (@Vid, @Date, @Title, @Desc, @Urg, @Freq, @IsActive)');
            }
        }

        if (car.insurance && typeof car.insurance === 'object') {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM Insurance WHERE VehicleId = @Vid');
            const insMap = { 'mandatory': 'חובה', 'comprehensive': 'מקיף', 'thirdparty': 'צד ג' };
            for (const [key, typeHebrew] of Object.entries(insMap)) {
                const ins = car.insurance[key];
                if (ins && (ins.date || ins.expiryDate || ins.cost || ins.company)) {
                    const expiry = ins.date || ins.expiryDate;
                    await req2()
                        .input('Vid', sql.Int, vehicleId)
                        .input('Type', sql.NVarChar, typeHebrew)
                        .input('Comp', sql.NVarChar, ins.company || ins.companyName || '')
                        .input('Pol', sql.NVarChar, ins.policyNum || ins.policyNumber || '')
                        .input('Exp', sql.Date, expiry ? (String(expiry).includes('/') ? String(expiry).split('/').reverse().join('-') : expiry) : null)
                        .input('Cost', sql.Decimal(10, 2), parseFloat(ins.cost) || 0)
                        .input('Doc', sql.NVarChar(sql.MAX), ins.file || ins.documentBase64 || null)
                        .input('Towing', sql.NVarChar, ins.towing || ins.towingService || '')
                        .input('Replacement', sql.NVarChar, ins.replacement || ins.replacementCar || '')
                        .input('Glass', sql.NVarChar, ins.glass || ins.glassCoverage || '')
                        .input('AgentName', sql.NVarChar, ins.agentName || '')
                        .input('AgentPhone', sql.NVarChar, ins.agentPhone || '')
                        .input('DriverLimit', sql.NVarChar, ins.driverLimit || '')
                        .input('Deductible', sql.NVarChar, ins.deductible || '')
                        .input('Protection', sql.NVarChar, ins.protection || ins.protectionMeasures || '')
                        .query(`INSERT INTO Insurance 
                            (VehicleId, Type, CompanyName, PolicyNumber, ExpiryDate, Cost, DocumentBase64, TowingService, ReplacementCar, GlassCoverage, AgentName, AgentPhone, DriverLimit, Deductible, ProtectionMeasures) 
                            VALUES (@Vid, @Type, @Comp, @Pol, @Exp, @Cost, @Doc, @Towing, @Replacement, @Glass, @AgentName, @AgentPhone, @DriverLimit, @Deductible, @Protection)`);
                }
            }
        }

        if (Array.isArray(car.gallery)) {
            await req2().input('Vid', sql.Int, vehicleId).query('DELETE FROM VehicleGallery WHERE VehicleId = @Vid');
            for (const g of car.gallery) {
                if (g) {
                    await req2()
                        .input('Vid', sql.Int, vehicleId)
                        .input('Img', sql.NVarChar(sql.MAX), g)
                        .query('INSERT INTO VehicleGallery (VehicleId, ImageBase64) VALUES (@Vid, @Img)');
                }
            }
        }

        await transaction.commit();
        res.json({ success: true });

    } catch (err) {

        if (transaction) {
            try { await transaction.rollback(); } catch(rbErr) { console.error('Rollback failed:', rbErr); }
        }
        console.error(`❌ Sync Error for Vehicle ${req.params.id}:`, err);
        res.status(500).json({ 
            success: false, 
            error: 'Database synchronization failed', 
            details: err.message
        });
    }
});

/**
 * מפעילה את מנוע הבינה המלאכותית (Gemini-2.5-Flash) לשם תפעול הצ׳אט הווירטואלי (מוסכניק וירטואלי). מוודאת הזרקת קונטקסט ההיסטוריה המלא ומפעילה Timeout למניעת תקיעת השרת בקריאות ארוכות.
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const carContext = req.body.carContext || 'אין נתונים זמינים לרכב זה כרגע.';
        const historyContext = req.body.history || [];

        const GEMINI_MODEL_CORRECT = "gemini-2.5-flash"; // Use the correct available model
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_CORRECT });

        let historyFormatted = [];
        historyFormatted.push({
            role: "user",
            parts: [{ text: `הוראות מערכת: אתה מוסכניק מומחה ועוזר וירטואלי של מערכת EasyCare ויש לך ידע נרחב ברכבים.\n\nלהלן כלל פרטי הרכב והמשתמש המלאים כולל הכל (אסור לך לשכוח כלום, זהו מידע קריטי):\n${carContext}\n\nחוקי הברזל שלך לתשובה:\n1. קצר מאוד וקריא: מקסימום 3-4 נקודות קצרות. אל תכתוב פסקאות ארוכות.\n2. אל תעשה רווחים גדולים בין השורות. שמור על טקסט צפוף וקריא.\n3. השתמש באימוג'י אחד או שניים כדי להחיות את הטקסט.\n\nהאם הבנת את ההוראות ואת נתוני המשתמש והרכב?` }]
        });
        historyFormatted.push({
            role: "model",
            parts: [{ text: "הבנתי, קראתי את כלל נתוני המשתמש והרכב השלמים ואני מוכן לעזור על פיהם. תשובותיי יהיו קצרות וקריאות עם אימוג'י כמבוקש." }]
        });

        if (historyContext.length > 0) {
            historyContext.forEach(msg => {
                let role = msg.sender === 'user' ? 'user' : 'model';
                let lastMsg = historyFormatted[historyFormatted.length - 1];
                if (lastMsg.role === role) {
                    lastMsg.parts[0].text += "\n" + msg.text;
                } else {
                    historyFormatted.push({
                        role: role,
                        parts: [{ text: msg.text }]
                    });
                }
            });
        }

        if (historyFormatted[historyFormatted.length - 1].role === 'user') {
            historyFormatted.push({
                role: "model",
                parts: [{ text: "ממתין להמשך..." }]
            });
        }

        const chat = model.startChat({
            history: historyFormatted
        });

        console.log(`[Chat API] Sending message to Gemini: "${userMessage}"`);

        const result = await Promise.race([
            chat.sendMessage(userMessage),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API Timeout after 45 seconds")), 45000))
        ]);
        
        const responseText = result.response.text();
        console.log(`[Chat API] Received response from Gemini! Length: ${responseText.length}`);

        res.json({ reply: responseText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "שגיאה מהשרת: " + error.message });
    }
});

/**
 * מקשרת בין טופס יצירת הקשר באתר לבין Supabase Edge Function האחראית לשליחת מיילים, עוקפת הגבלות SMTP ישירות משרת ההרצה (Render).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/contact-us`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ name, email, message })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Supabase Edge Function Error:', errorData);
            return res.status(500).json({ error: 'תקלה בשליחת הפנייה. נסה שוב מאוחר יותר.' });
        }

        res.json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
        console.error('Contact endpoint error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * אחראית על פענוח מסמכי PDF ותמונות של פוליסות ביטוח. משתמשת במנוע ה-AI על מנת לחלץ את שדות הביטוח (פרמיות, תאריכים, סוכנים וכד׳) בפורמט JSON בלבד (OCR חכם).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.post('/api/ai/parse-insurance', async (req, res) => {
    try {
        const { mimeType, base64Data, insuranceType } = req.body;
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        let typeContext = '';
        if (insuranceType === 'mandatory') {
            typeContext = `זהו ביטוח חובה (RCA) ישראלי. שים לב: החברה המנפיקה עשויה להיות "קרנית", ישיר, מנורה, הפניקס, כלל וכד'. 
            השדות הקריטיים לביטוח חובה הם: company (שם החברה/קרן), policyNum (מספר פוליסה/אסמכתא), 
            cost (פרמיה שנתית), date (תוקף הפוליסה), agentName (שם הסוכן או מוקד שירות), agentPhone (טלפון).`;
        } else if (insuranceType === 'comprehensive') {
            typeContext = `זהו ביטוח מקיף לרכב. השדות הקריטיים הם: company, policyNum, cost, date,
            towing (גרירה/סיוע דרך), replacement (רכב חלופי), glass (שמשות/זכוכיות),
            agentName, agentPhone, driverLimit (מגבלת גיל נהגים), deductible (השתתפות עצמית), protection (מיגון נדרש).`;
        } else if (insuranceType === 'thirdparty') {
            typeContext = `זהו ביטוח צד ג' לרכב. השדות הקריטיים הם: company, policyNum, cost, date,
            agentName, agentPhone, driverLimit (מגבלת גיל נהגים), deductible (השתתפות עצמית).`;
        } else {
            typeContext = `ביטוח רכב כללי.`;
        }

        const prompt = `אתה מערכת חכמה לפענוח פוליסות ביטוח רכב בישראל.
        
${typeContext}

צרפתי מסמך ביטוח. חלץ ממנו את הפרטים ב-JSON בלבד.

חוקים מחייבים:
1. "date" = תאריך תפוגה/תוקף הפוליסה בלבד (לא תאריך הנפקה/כתיבה) - בפורמט DD/MM/YYYY. חפש מונחים כמו: "תוקף הפוליסה", "בתוקף עד", "valid until", "expiry", "תאריך סיום".
2. "cost" = פרמיה שנתית סופית לתשלום - מספרים בלבד ללא ₪ או פסיקים.
3. אל תמציא נתונים. אם שדה לא קיים במסמך = ערך ריק "".

{
  "company": "",
  "policyNum": "",
  "cost": "",
  "date": "",
  "towing": "",
  "replacement": "",
  "glass": "",
  "agentName": "",
  "agentPhone": "",
  "driverLimit": "",
  "deductible": "",
  "protection": ""
}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: mimeType } }
        ]);

        let text = result.response.text().trim();

        text = text.replace(/```json|```/g, '').trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No valid JSON in response');

        const data = JSON.parse(jsonMatch[0]);
        res.json({ success: true, data: data });
    } catch (err) {
        console.error("Insurance parsing error:", err.message);
        res.status(500).json({ success: false, error: "Failed to parse document", details: err.message });
    }
});

const CACHE_FILE = path.join(__dirname, 'fuel_cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

let isFetchingAI = false;

/**
 * פונה למנוע Gemini לחילוץ מחירי הדלק והחשמל הרשמיים העדכניים בישראל. שומרת את הנתון כמטמון (Cache) קובץ כדי לחסוך קריאות API ונופלת להגדרות גיבוי במקרה חריגת מכסה (Quota).
 * @param {express.Request} req - אובייקט הבקשה, כולל את כל הפרמטרים (Params) וגוף הבקשה (Body).
 * @param {express.Response} res - אובייקט התשובה שדרכו מוחזר המידע ללקוח (Client).
 * @returns {Promise<void>} - מבטיח החזרת סיום ריצה או קוד סטטוס מתאים.
 * @throws {Error} - זורקת שגיאה המחזירה קוד 500 או הודעת שגיאה מסודרת למשתמש על גבי JSON.
 */
app.get('/api/current-fuel-ai', async (req, res) => {
    let cache = { fuel95: "8.05", fuel98: "9.80", diesel: "7.70", elecKwh: "0.6186", lastFetch: 0 };

    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            cache = JSON.parse(data);
        } catch (e) { console.error("Cache read error", e); }
    }

    const now = Date.now();

    if (now - cache.lastFetch < CACHE_DURATION && cache.lastFetch !== 0) {
        return res.json({ fuel95: cache.fuel95, fuel98: cache.fuel98, diesel: cache.diesel, elecKwh: cache.elecKwh });
    }

    if (isFetchingAI) {
        return res.json({ fuel95: cache.fuel95, fuel98: cache.fuel98, diesel: cache.diesel, elecKwh: cache.elecKwh });
    }

    isFetchingAI = true;
    const FALLBACK_PRICES = { fuel95: "8.05", fuel98: "9.80", diesel: "7.70", elecKwh: "0.6186" };
    try {
        console.log("Fetching fresh Energy Prices from Gemini...");
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `You are an Israeli fuel price assistant. Reply ONLY with a valid JSON object containing the latest known official fuel prices in Israel (in ILS). Include diesel. Use only numeric string values (no N/A, no text). Example format: {"fuel95": "8.05", "fuel98": "9.80", "diesel": "7.70", "elecKwh": "0.6186"}`;
        const result = await model.generateContent(prompt);
        const rawText = (await result.response).text().trim().replace(/\`\`\`json|\`\`\`/g, '').trim();

        const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('No valid JSON found in Gemini response');

        const newPrices = JSON.parse(jsonMatch[0]);

        const validated = {
            fuel95: (newPrices.fuel95 && String(newPrices.fuel95) !== 'N/A' && !isNaN(parseFloat(newPrices.fuel95))) ? String(newPrices.fuel95) : FALLBACK_PRICES.fuel95,
            fuel98: (newPrices.fuel98 && String(newPrices.fuel98) !== 'N/A' && !isNaN(parseFloat(newPrices.fuel98))) ? String(newPrices.fuel98) : FALLBACK_PRICES.fuel98,
            diesel: (newPrices.diesel && String(newPrices.diesel) !== 'N/A' && !isNaN(parseFloat(newPrices.diesel))) ? String(newPrices.diesel) : FALLBACK_PRICES.diesel,
            elecKwh: (newPrices.elecKwh && String(newPrices.elecKwh) !== 'N/A' && !isNaN(parseFloat(newPrices.elecKwh))) ? String(newPrices.elecKwh) : FALLBACK_PRICES.elecKwh
        };

        cache = { ...validated, lastFetch: now };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log("Gemini Price Cache updated:", validated);
        res.json(validated);
    } catch (error) {
        if (error.message.includes('429')) {
            console.log("Gemini Quota Exceeded for prices - Serving fallback data.");
        } else {
            console.error("Gemini Energy Price Error:", error.message);
        }

        const safeResponse = {
            fuel95: (cache.fuel95 && cache.fuel95 !== 'N/A' && !isNaN(parseFloat(cache.fuel95))) ? cache.fuel95 : FALLBACK_PRICES.fuel95,
            fuel98: (cache.fuel98 && cache.fuel98 !== 'N/A' && !isNaN(parseFloat(cache.fuel98))) ? cache.fuel98 : FALLBACK_PRICES.fuel98,
            elecKwh: (cache.elecKwh && cache.elecKwh !== 'N/A' && !isNaN(parseFloat(cache.elecKwh))) ? cache.elecKwh : FALLBACK_PRICES.elecKwh
        };
        res.json(safeResponse);
    } finally {
        isFetchingAI = false;
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📂 Working Directory: ${process.cwd()}`);
    console.log(`📦 Node Version: ${process.version}`);

    try {
        await poolPromise;
    } catch (err) {
        console.error("Failed to connect to database on startup (server still running):", err.message);
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close the other process or use a different port.`);
        process.exit(1);
    } else {
        console.error(`❌ Server startup error:`, err.message);
        process.exit(1);
    }
});
