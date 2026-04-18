const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static directory where dashboard.html exists
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.5-flash"; 


// Initialize DB Connection
const { sql, poolPromise } = require('./db');

// Authentication middleware - expects 'userid' header
app.use((req, res, next) => {
    // Skip auth for login, register, and static files
    if (req.path === '/api/login' || req.path === '/api/register' || !req.path.startsWith('/api')) {
        return next();
    }
    const userId = req.headers['userid'];
    if (userId) {
        req.userId = parseInt(userId);
    } else {
        // Fallback for development (e.g., from old api.js logic)
        req.userId = 1;
    }
    next();
});

// ========================
// API ROUTES FOR AUTH
// ========================

// Register User
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const pool = await poolPromise;

        // Basic check if exists
        const check = await pool.request().input('Email', sql.NVarChar, email).query('SELECT Id FROM Users WHERE Email = @Email');
        if (check.recordset.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const fullName = `${firstName} ${lastName}`;
        // In production, encrypt password. For MVP, keeping plain or simple.
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, password)
            .input('FullName', sql.NVarChar, fullName)
            .query('INSERT INTO Users (Email, PasswordHash, FullName) VALUES (@Email, @PasswordHash, @FullName)');

        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login User
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, password)
            .query('SELECT Id, FullName FROM Users WHERE Email = @Email AND PasswordHash = @PasswordHash');

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

// Forgot Password - Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const pool = await poolPromise;
        const check = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT Id FROM Users WHERE Email = @Email');

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'משתמש עם אימייל זה לא נמצא במערכת.' });
        }

        // Send OTP via Supabase (creating a mock user in Supabase auth if they don't exist there, strictly for email OTP)
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: { shouldCreateUser: true }
        });

        if (error) {
            console.error('Supabase OTP Error:', error);
            return res.status(500).json({ error: 'שגיאה בשליחת קוד לאימייל. ודא שהגדרות ה-Supabase תקינות.' });
        }

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('OTP send error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Forgot Password - Verify OTP & Reset
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) return res.status(400).json({ error: 'Missing parameters' });

        // Verify OTP via Supabase
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error) {
            console.error('OTP Verify Error:', error);
            return res.status(400).json({ error: 'קוד OTP שגוי או פג תוקף.' });
        }

        // OTP Valid! Update password in Azure SQL database
        const pool = await poolPromise;
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, newPassword)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE Email = @Email');

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('OTP verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Logged-in User Info
app.get('/api/user/me', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Id', sql.Int, req.userId)
            .query('SELECT Email, FullName FROM Users WHERE Id = @Id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user: result.recordset[0] });
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================
// API ROUTES FOR VEHICLES
// ========================

// Get all vehicles for the logged-in user with comprehensive data
app.get('/api/vehicles', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .query('SELECT * FROM Vehicles WHERE UserId = @UserId');

        const vehicles = result.recordset;

        // Fetch related data for each vehicle to enable accurate reliability scoring on the main dashboard
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
                    acc[key] = { date: ins.ExpiryDate, file: ins.DocumentBase64 };
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

// Get all vehicles globally (for Global Search)
app.get('/api/vehicles/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Vehicles');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Add a new vehicle
app.post('/api/vehicles', async (req, res) => {
    try {
        const car = req.body;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .input('LicensePlate', sql.NVarChar, car.licensePlate)
            .input('BrandHeb', sql.NVarChar, car.brandHeb)
            .input('Model', sql.NVarChar, car.model)
            .input('Year', sql.Int, car.year)
            .input('Color', sql.NVarChar, car.color)
            .input('FuelType', sql.NVarChar, car.fuelType)
            .input('TestDate', sql.NVarChar, car.testDate)
            .input('LicenseExpiry', sql.NVarChar, car.licenseExpiry)
            .input('Pollution', sql.NVarChar, car.pollution)
            .input('TireFront', sql.NVarChar, car.tireFront)
            .input('TireRear', sql.NVarChar, car.tireRear)
            .input('EngineVolume', sql.NVarChar, car.engineVolume)
            .input('HorsePower', sql.NVarChar, car.horsePower)
            .input('Km', sql.Int, car.km)
            .input('Status', sql.NVarChar, car.status || 'Active')
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
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit an existing vehicle (basic info)
app.put('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { brandHeb, model, logo, status, reliabilityScore } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('Id', sql.Int, id)
            .input('UserId', sql.Int, req.userId)
            .input('BrandHeb', sql.NVarChar, brandHeb)
            .input('Model', sql.NVarChar, model)
            .input('Status', sql.NVarChar, status)
            .input('ReliabilityScore', sql.Int, reliabilityScore)
            .input('Logo', sql.NVarChar, logo)
            .query(`
                UPDATE Vehicles 
                SET BrandHeb = @BrandHeb, Model = @Model, Logo = @Logo, Status = @Status, ReliabilityScore = @ReliabilityScore
                WHERE Id = @Id AND UserId = @UserId
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to update vehicle:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete a vehicle
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

// ========================
// API ROUTES FOR FINES
// ========================

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
            .input('DocumentBase64', sql.NVarChar, documentBase64)
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

// ========================
// API ROUTES FOR GALLERY
// ========================

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

// ========================
// API ROUTES FOR TREATMENTS
// ========================
app.get('/api/treatments/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Treatments WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/treatments', async (req, res) => {
    try {
        const { vehicleId, date, type, description, cost, garageName, odometer, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date)
            .input('Type', sql.NVarChar, type).input('Description', sql.NVarChar, description)
            .input('Cost', sql.Decimal(10, 2), cost).input('GarageName', sql.NVarChar, garageName)
            .input('Odometer', sql.Int, odometer).input('DocumentBase64', sql.NVarChar, documentBase64)
            .query(`INSERT INTO Treatments (VehicleId, Date, Type, Description, Cost, GarageName, Odometer, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Type, @Description, @Cost, @GarageName, @Odometer, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ========================
// API ROUTES FOR FUELLOGS
// ========================
app.get('/api/fuellogs/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM FuelLogs WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/fuellogs', async (req, res) => {
    try {
        const { vehicleId, date, time, liters, pricePerLiter, totalCost, odometer, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date).input('Time', sql.Time, time)
            .input('Liters', sql.Decimal(8, 2), liters).input('PricePerLiter', sql.Decimal(8, 2), pricePerLiter)
            .input('TotalCost', sql.Decimal(10, 2), totalCost).input('Odometer', sql.Int, odometer)
            .input('DocumentBase64', sql.NVarChar, documentBase64)
            .query(`INSERT INTO FuelLogs (VehicleId, Date, Time, Liters, PricePerLiter, TotalCost, Odometer, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Time, @Liters, @PricePerLiter, @TotalCost, @Odometer, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ========================
// API ROUTES FOR EXPENSES
// ========================
app.get('/api/expenses/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Expenses WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/expenses', async (req, res) => {
    try {
        const { vehicleId, date, category, amount, description, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Date', sql.Date, date).input('Category', sql.NVarChar, category)
            .input('Amount', sql.Decimal(10, 2), amount).input('Description', sql.NVarChar, description)
            .input('DocumentBase64', sql.NVarChar, documentBase64)
            .query(`INSERT INTO Expenses (VehicleId, Date, Category, Amount, Description, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Date, @Category, @Amount, @Description, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ========================
// API ROUTES FOR ACCIDENTS
// ========================
app.get('/api/accidents/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Accidents WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/accidents', async (req, res) => {
    try {
        const { vehicleId, title, date, description, damageDetails, estimatedCost, cost, documentBase64, thirdPartyInvolved, isHandled } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('Title', sql.NVarChar, title).input('Date', sql.Date, date)
            .input('Description', sql.NVarChar, description).input('DamageDetails', sql.NVarChar, damageDetails)
            .input('EstimatedCost', sql.Decimal(10, 2), estimatedCost).input('Cost', sql.Decimal(10, 2), cost)
            .input('DocumentBase64', sql.NVarChar, documentBase64).input('ThirdPartyInvolved', sql.Bit, thirdPartyInvolved ? 1 : 0)
            .input('IsHandled', sql.Bit, isHandled ? 1 : 0)
            .query(`INSERT INTO Accidents (VehicleId, Title, Date, Description, DamageDetails, EstimatedCost, Cost, DocumentBase64, ThirdPartyInvolved, IsHandled) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @Title, @Date, @Description, @DamageDetails, @EstimatedCost, @Cost, @DocumentBase64, @ThirdPartyInvolved, @IsHandled)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ========================
// API ROUTES FOR ALERTS
// ========================
app.get('/api/alerts/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Alerts WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
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

// ========================
// API ROUTES FOR INSURANCE
// ========================
app.get('/api/insurance/:vehicleId', async (req, res) => {
    try {
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, req.params.vehicleId)
            .query('SELECT * FROM Insurance WHERE VehicleId = @VehicleId');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/insurance', async (req, res) => {
    try {
        const { vehicleId, companyName, policyNumber, expiryDate, type, cost, documentBase64,
                towing, replacement, glass, agentName, agentPhone, driverLimit, deductible, protection } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('CompanyName', sql.NVarChar, companyName)
            .input('PolicyNumber', sql.NVarChar, policyNumber).input('ExpiryDate', sql.Date, expiryDate)
            .input('Type', sql.NVarChar, type).input('Cost', sql.Decimal(10, 2), cost)
            .input('DocumentBase64', sql.NVarChar, documentBase64)
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

// ========================
// MASS SYNC ENPOINT (FRONTEND FALLBACK)
// ========================
app.get('/api/vehicles/sync/:id', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const pool = await poolPromise;
        const vRes = await pool.request().input('Id', sql.Int, vehicleId).query('SELECT * FROM Vehicles WHERE Id = @Id');
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

        // Transform DB schema back to Frontend schema for seamless integration
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
            km: car.Km,
            status: car.Status,
            reliabilityScore: car.ReliabilityScore,
            hasDisabledTag: car.HasDisabledTag,
            logo: car.Logo,

            treatments: car.treatments.map(t => ({ id: t.Id, date: t.Date, type: t.Type || t.Description, garage: t.GarageName, km: t.Odometer, cost: t.Cost, invoice: t.DocumentBase64 })),
            fuelLog: car.fuelLog.map(f => ({ id: f.Id, date: f.Date, amount: f.Liters, cost: f.TotalCost, energyType: f.Liters ? 'fuel' : 'electricity' })),
            expenses: car.expenses.map(e => ({ id: e.Id, type: e.Category, date: e.Date, amount: e.Amount, notes: e.Description })),
            accidents: car.accidents.map(a => ({ id: a.Id, date: a.Date, description: a.Description, repairCost: a.EstimatedCost || a.Cost })),
            alerts: car.alerts.map(a => ({ id: a.Id, title: a.Title, date: a.Date, isActive: a.IsActive, urgency: a.Urgency, frequency: a.Frequency })),
            insurance: car.insurance.length > 0 ? {
                mandatory: (() => { 
                    const i = car.insurance.find(x => x.Type === 'חובה'); 
                    return i ? { 
                        company: i.CompanyName || i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64,
                        towing: i.TowingService, replacement: i.ReplacementCar, glass: i.GlassCoverage, agentName: i.AgentName, 
                        agentPhone: i.AgentPhone, driverLimit: i.DriverLimit, deductible: i.Deductible, protection: i.ProtectionMeasures
                    } : null; 
                })(),
                comprehensive: (() => { 
                    const i = car.insurance.find(x => x.Type === 'מקיף'); 
                    return i ? { 
                        company: i.CompanyName || i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64,
                        towing: i.TowingService, replacement: i.ReplacementCar, glass: i.GlassCoverage, agentName: i.AgentName, 
                        agentPhone: i.AgentPhone, driverLimit: i.DriverLimit, deductible: i.Deductible, protection: i.ProtectionMeasures
                    } : null; 
                })(),
                thirdparty: (() => { 
                    const i = car.insurance.find(x => x.Type === 'צד ג'); 
                    return i ? { 
                        company: i.CompanyName || i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64,
                        towing: i.TowingService, replacement: i.ReplacementCar, glass: i.GlassCoverage, agentName: i.AgentName, 
                        agentPhone: i.AgentPhone, driverLimit: i.DriverLimit, deductible: i.Deductible, protection: i.ProtectionMeasures
                    } : null; 
                })()
            } : {},
            gallery: car.gallery.map(g => g.ImageBase64),
            reports: car.reports.map(r => {
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
                    amount: r.Amount,
                    points: r.Points,
                    location: r.Location,
                    status: r.IsHandled ? 'paid' : 'unpaid',
                    images: r.DocumentBase64 ? [r.DocumentBase64] : []
                };
            })
        };

        res.json(frontendCar);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/vehicles/sync/:id', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const car = req.body;
        const pool = await poolPromise;

        // 1. Update Vehicle basic fields
        await pool.request()
            .input('Id', sql.Int, vehicleId).input('Km', sql.Int, car.km || 0)
            .input('Status', sql.NVarChar, car.status || '').input('ReliabilityScore', sql.Int, car.reliabilityScore || 100)
            .query('UPDATE Vehicles SET Km=@Km, Status=@Status, ReliabilityScore=@ReliabilityScore WHERE Id=@Id');

        // 2. Clear old children to perform full sync from frontend array
        await pool.request().input('Vid', sql.Int, vehicleId).query(`
            DELETE FROM Treatments WHERE VehicleId = @Vid;
            DELETE FROM FuelLogs WHERE VehicleId = @Vid;
            DELETE FROM Expenses WHERE VehicleId = @Vid;
            DELETE FROM Accidents WHERE VehicleId = @Vid;
            DELETE FROM Alerts WHERE VehicleId = @Vid;
            DELETE FROM Fines WHERE VehicleId = @Vid;
            DELETE FROM Insurance WHERE VehicleId = @Vid;
            DELETE FROM VehicleGallery WHERE VehicleId = @Vid;
        `);

        // Helper to convert DD/MM/YYYY or YYYY-MM-DD to SQL valid format
        const parseDateForSql = (d) => {
            if (!d) return new Date();
            if (typeof d === 'string' && d.includes('/')) return d.split('/').reverse().join('-');
            return d;
        };

        // 3. Insert fresh arrays
        if (car.treatments && car.treatments.length) {
            for (let t of car.treatments) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(t.date))
                    .input('Type', sql.NVarChar, t.type || 'Treatment').input('Description', sql.NVarChar, t.type || '')
                    .input('Garage', sql.NVarChar, t.garage || '').input('Cost', sql.Decimal(10, 2), t.cost || 0).input('Km', sql.Int, t.km || 0).input('Doc', sql.NVarChar, t.invoice || '')
                    .query('INSERT INTO Treatments (VehicleId, Date, Type, Description, GarageName, Cost, Odometer, DocumentBase64) VALUES (@Vid, @Date, @Type, @Description, @Garage, @Cost, @Km, @Doc)');
            }
        }
        if (car.fuelLog && car.fuelLog.length) {
            for (let f of car.fuelLog) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(f.date))
                    .input('Liters', sql.Decimal(8, 2), f.amount || 0).input('Cost', sql.Decimal(10, 2), f.cost || 0).input('Price', sql.Decimal(8, 2), 0)
                    .query('INSERT INTO FuelLogs (VehicleId, Date, Liters, PricePerLiter, TotalCost) VALUES (@Vid, @Date, @Liters, @Price, @Cost)');
            }
        }
        if (car.expenses && car.expenses.length) {
            for (let e of car.expenses) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(e.date))
                    .input('Cat', sql.NVarChar, e.type || e.typeOther || '').input('Amt', sql.Decimal(10, 2), e.amount || 0).input('Desc', sql.NVarChar, e.notes || '')
                    .query('INSERT INTO Expenses (VehicleId, Date, Category, Amount, Description) VALUES (@Vid, @Date, @Cat, @Amt, @Desc)');
            }
        }
        if (car.accidents && car.accidents.length) {
            for (let a of car.accidents) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(a.date))
                    .input('Desc', sql.NVarChar, a.description || '').input('Cost', sql.Decimal(10, 2), a.repairCost || 0)
                    .query('INSERT INTO Accidents (VehicleId, Date, Description, EstimatedCost) VALUES (@Vid, @Date, @Desc, @Cost)');
            }
        }
        if (car.reports && car.reports.length) {
            for (let r of car.reports) {
                const reportType = r.typeVal || r.offenseType || '';
                const isPaid = (r.status === 'paid' || r.isHandled === true);
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(r.date))
                    .input('Type', sql.NVarChar, reportType).input('Amt', sql.Decimal(10, 2), r.amount || 0)
                    .input('Loc', sql.NVarChar, r.location || '').input('Pts', sql.Int, r.points || 0).input('Han', sql.Bit, isPaid ? 1 : 0)
                    .input('Doc', sql.NVarChar, (r.images && r.images.length ? r.images[0] : ''))
                    .query('INSERT INTO Fines (VehicleId, Date, OffenseType, Amount, Location, Points, IsHandled, DocumentBase64) VALUES (@Vid, @Date, @Type, @Amt, @Loc, @Pts, @Han, @Doc)');
            }
        }
        if (car.alerts && car.alerts.length) {
            for (let a of car.alerts) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, parseDateForSql(a.date))
                    .input('Title', sql.NVarChar, a.title || '').input('Urg', sql.NVarChar, a.urgency || '').input('Freq', sql.NVarChar, a.frequency || '')
                    .query('INSERT INTO Alerts (VehicleId, Date, Title, Urgency, Frequency) VALUES (@Vid, @Date, @Title, @Urg, @Freq)');
            }
        }
        if (car.insurance) {
            const insMap = { 'mandatory': 'חובה', 'comprehensive': 'מקיף', 'thirdparty': 'צד ג' };
            for (let [key, typeHebrew] of Object.entries(insMap)) {
                let ins = car.insurance[key];
                if (ins && (ins.date || ins.expiryDate)) {
                    const expiry = ins.date || ins.expiryDate;
                    await pool.request().input('Vid', sql.Int, vehicleId).input('Type', sql.NVarChar, typeHebrew)
                        .input('Comp', sql.NVarChar, ins.company || ins.companyName || '')
                        .input('Pol', sql.NVarChar, ins.policyNum || ins.policyNumber || '')
                        .input('Exp', sql.Date, expiry ? 
                            (String(expiry).includes('/') ? String(expiry).split('/').reverse().join('-') : expiry) : null)
                        .input('Cost', sql.Decimal(10, 2), ins.cost || 0).input('Doc', sql.NVarChar, ins.file || ins.documentBase64 || '')
                        .input('Towing', sql.NVarChar, ins.towing || ins.towingService || '')
                        .input('Replacement', sql.NVarChar, ins.replacement || ins.replacementCar || '')
                        .input('Glass', sql.NVarChar, ins.glass || ins.glassCoverage || '')
                        .input('AgentName', sql.NVarChar, ins.agentName || '')
                        .input('AgentPhone', sql.NVarChar, ins.agentPhone || '')
                        .input('DriverLimit', sql.NVarChar, ins.driverLimit || '')
                        .input('Deductible', sql.NVarChar, ins.deductible || '')
                        .input('Protection', sql.NVarChar, ins.protection || ins.protectionMeasures || '')
                        .query(`INSERT INTO Insurance (VehicleId, Type, CompanyName, PolicyNumber, ExpiryDate, Cost, DocumentBase64,
                                                      TowingService, ReplacementCar, GlassCoverage, AgentName, AgentPhone, DriverLimit, Deductible, ProtectionMeasures) 
                                VALUES (@Vid, @Type, @Comp, @Pol, @Exp, @Cost, @Doc, @Towing, @Replacement, @Glass, @AgentName, @AgentPhone, @DriverLimit, @Deductible, @Protection)`);
                }
            }
        }
        if (car.gallery && car.gallery.length) {
            for (let g of car.gallery) {
                if (g) {
                    await pool.request().input('Vid', sql.Int, vehicleId).input('Img', sql.NVarChar, g)
                        .query('INSERT INTO VehicleGallery (VehicleId, ImageBase64) VALUES (@Vid, @Img)');
                }
            }
        }

        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const carContext = req.body.carContext || 'אין נתונים זמינים לרכב זה כרגע.';
        const historyContext = req.body.history || [];

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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
                historyFormatted.push({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                });
            });
        }

        const chat = model.startChat({
            history: historyFormatted
        });

        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        res.json({ reply: responseText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "אופס! נתקלתי בבעיה. נסה שוב בעוד רגע." });
    }
});

// ========================
// API ROUTES FOR CONTACT FORM
// ========================

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            replyTo: email,
            subject: `התקבלה פנייה חדשה מ - ${name} דרך אתר EasyCare`,
            html: `
          <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background-color: #ffffff;">
            
            <div style="background-color: #007bff; color: white; padding: 25px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 600;">התקבלה פנייה חדשה באתר</h2>
              <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">EasyCare - Lead Management System</p>
            </div>

            <div style="padding: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #666; width: 35%;"><strong>שם הלקוח:</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #333; font-weight: 500;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #666;"><strong>אימייל לחזרה:</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
                    <a href="mailto:${email}" style="color: #007bff; text-decoration: none; font-weight: 500;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #666;"><strong>מספר טלפון:</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #333; font-weight: 500;">${phone || 'לא הוזן'}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 20px 12px 10px 12px; color: #666;"><strong>תוכן ההודעה:</strong></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 15px; color: #444; line-height: 1.6; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
                    ${message.replace(/\\n/g, '<br>')}
                  </td>
                </tr>
              </table>
            </div>

            <div style="padding: 25px; background-color: #fdfdfd; text-align: center; border-top: 1px solid #f0f0f0;">
              <a href="mailto:${email}" style="background-color: #28a745; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">השב ללקוח במייל</a>
              <div style="margin-top: 20px; font-size: 12px; color: #999;">
                <p style="margin: 0;">נשלח באופן אוטומטי דרך EasyCare</p>
                <p style="margin: 5px 0 0 0;">${new Date().toLocaleString('he-IL')}</p>
              </div>
            </div>

          </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Nodemailer Error:', error);
                return res.status(500).json({ error: 'תקלה בשליחת האימייל. נסה שוב מאוחר יותר.' });
            }
            res.json({ success: true, message: 'Message sent successfully.' });
        });
    } catch (err) {
        console.error('Contact endpoint error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- AI INSURANCE PARSING ---
app.post('/api/ai/parse-insurance', async (req, res) => {
    try {
        const { mimeType, base64Data, insuranceType } = req.body;
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        // Build a type-specific prompt for better extraction accuracy
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
        // Clean JSON formatting
        text = text.replace(/```json|```/g, '').trim();
        // Find the JSON object if there's extra text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No valid JSON in response');
        
        const data = JSON.parse(jsonMatch[0]);
        res.json({ success: true, data: data });
    } catch (err) {
        console.error("Insurance parsing error:", err.message);
        res.status(500).json({ success: false, error: "Failed to parse document", details: err.message });
    }
});

// --- ENERGY PRICE CACHING ---
const CACHE_FILE = path.join(__dirname, 'fuel_cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

let isFetchingAI = false;

app.get('/api/current-fuel-ai', async (req, res) => {
    let cache = { fuel95: "8.05", fuel98: "9.80", elecKwh: "0.6186", lastFetch: 0 };
    
    // 1. Try to load from file
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            cache = JSON.parse(data);
        } catch (e) { console.error("Cache read error", e); }
    }

    const now = Date.now();
    // 2. If valid cache exists, return it
    if (now - cache.lastFetch < CACHE_DURATION && cache.lastFetch !== 0) {
        return res.json({ fuel95: cache.fuel95, fuel98: cache.fuel98, elecKwh: cache.elecKwh });
    }

    // 3. If already fetching, return current cache to avoid concurrency issues
    if (isFetchingAI) {
        return res.json({ fuel95: cache.fuel95, fuel98: cache.fuel98, elecKwh: cache.elecKwh });
    }

    // 4. Fetch fresh data from Gemini
    isFetchingAI = true;
    const FALLBACK_PRICES = { fuel95: "8.05", fuel98: "9.80", elecKwh: "0.6186" };
    try {
        console.log("Fetching fresh Energy Prices from Gemini...");
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `You are an Israeli fuel price assistant. Reply ONLY with a valid JSON object containing the latest known official fuel prices in Israel. Use only numeric string values (no N/A, no text). Example format: {"fuel95": "8.05", "fuel98": "9.80", "elecKwh": "0.6186"}`;
        const result = await model.generateContent(prompt);
        const rawText = (await result.response).text().trim().replace(/\`\`\`json|\`\`\`/g, '').trim();
        
        // Extract JSON object from response
        const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('No valid JSON found in Gemini response');
        
        const newPrices = JSON.parse(jsonMatch[0]);
        
        // Validate each value - reject N/A or non-numeric, use fallback
        const validated = {
            fuel95:  (newPrices.fuel95  && String(newPrices.fuel95)  !== 'N/A' && !isNaN(parseFloat(newPrices.fuel95)))  ? String(newPrices.fuel95)  : FALLBACK_PRICES.fuel95,
            fuel98:  (newPrices.fuel98  && String(newPrices.fuel98)  !== 'N/A' && !isNaN(parseFloat(newPrices.fuel98)))  ? String(newPrices.fuel98)  : FALLBACK_PRICES.fuel98,
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
        // On error, return cached values if valid, otherwise use hardcoded fallback
        const safeResponse = {
            fuel95:  (cache.fuel95  && cache.fuel95  !== 'N/A' && !isNaN(parseFloat(cache.fuel95)))  ? cache.fuel95  : FALLBACK_PRICES.fuel95,
            fuel98:  (cache.fuel98  && cache.fuel98  !== 'N/A' && !isNaN(parseFloat(cache.fuel98)))  ? cache.fuel98  : FALLBACK_PRICES.fuel98,
            elecKwh: (cache.elecKwh && cache.elecKwh !== 'N/A' && !isNaN(parseFloat(cache.elecKwh))) ? cache.elecKwh : FALLBACK_PRICES.elecKwh
        };
        res.json(safeResponse);
    } finally {
        isFetchingAI = false;
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Chatbot Server is running on http://localhost:${PORT}`);
});
