const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static directory where dashboard.html exists
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// ========================
// API ROUTES FOR VEHICLES
// ========================

// Get all vehicles for the logged-in user
app.get('/api/vehicles', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.userId)
            .query('SELECT * FROM Vehicles WHERE UserId = @UserId');
        
        // Let's also fetch related data (treatments, fuel, etc) to mimic the old `userCars` structure
        // For simplicity right now, we will return just the cars.
        const vehicles = result.recordset;

        // In the future we will loop over vehicles and fetch their Treatments, Expenses, etc.
        // so the frontend receives the same object structure.
        
        res.json(vehicles);
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
            .input('Amount', sql.Decimal(10,2), amount)
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
            .input('Cost', sql.Decimal(10,2), cost).input('GarageName', sql.NVarChar, garageName)
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
            .input('Liters', sql.Decimal(8,2), liters).input('PricePerLiter', sql.Decimal(8,2), pricePerLiter)
            .input('TotalCost', sql.Decimal(10,2), totalCost).input('Odometer', sql.Int, odometer)
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
            .input('Amount', sql.Decimal(10,2), amount).input('Description', sql.NVarChar, description)
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
            .input('EstimatedCost', sql.Decimal(10,2), estimatedCost).input('Cost', sql.Decimal(10,2), cost)
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
        const { vehicleId, companyName, policyNumber, expiryDate, type, cost, documentBase64 } = req.body;
        const result = await (await poolPromise).request()
            .input('VehicleId', sql.Int, vehicleId).input('CompanyName', sql.NVarChar, companyName)
            .input('PolicyNumber', sql.NVarChar, policyNumber).input('ExpiryDate', sql.Date, expiryDate)
            .input('Type', sql.NVarChar, type).input('Cost', sql.Decimal(10,2), cost)
            .input('DocumentBase64', sql.NVarChar, documentBase64)
            .query(`INSERT INTO Insurance (VehicleId, CompanyName, PolicyNumber, ExpiryDate, Type, Cost, DocumentBase64) 
                    OUTPUT INSERTED.Id VALUES (@VehicleId, @CompanyName, @PolicyNumber, @ExpiryDate, @Type, @Cost, @DocumentBase64)`);
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ========================
// MASS SYNC ENPOINT (FRONTEND FALLBACK)
// ========================
app.get('/api/vehicles/sync/:id', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const pool = await poolPromise;
        const vRes = await pool.request().input('Id', sql.Int, vehicleId).query('SELECT * FROM Vehicles WHERE Id = @Id');
        if (vRes.recordset.length === 0) return res.status(404).json({error: 'Not found'});
        
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
                mandatory: (() => { const i=car.insurance.find(x=>x.Type==='חובה'); return i ? {company: i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64} : null; })(),
                comprehensive: (() => { const i=car.insurance.find(x=>x.Type==='מקיף'); return i ? {company: i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64} : null; })(),
                thirdparty: (() => { const i=car.insurance.find(x=>x.Type==='צד ג'); return i ? {company: i.Company, policyNum: i.PolicyNumber, cost: i.Cost, date: i.ExpiryDate, file: i.DocumentBase64} : null; })()
            } : {},
            gallery: car.gallery.map(g => g.ImageBase64),
            reports: car.reports.map(r => ({ id: r.Id, offenseType: r.OffenseType, date: r.Date, amount: r.Amount, points: r.Points, location: r.Location, isHandled: r.IsHandled }))
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

        // 3. Insert fresh arrays
        if (car.treatments && car.treatments.length) {
            for (let t of car.treatments) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, t.date || new Date())
                    .input('Type', sql.NVarChar, t.type || 'Treatment').input('Description', sql.NVarChar, t.type || '')
                    .input('Garage', sql.NVarChar, t.garage || '').input('Cost', sql.Decimal(10,2), t.cost || 0).input('Km', sql.Int, t.km || 0).input('Doc', sql.NVarChar, t.invoice || '')
                    .query('INSERT INTO Treatments (VehicleId, Date, Type, Description, GarageName, Cost, Odometer, DocumentBase64) VALUES (@Vid, @Date, @Type, @Description, @Garage, @Cost, @Km, @Doc)');
            }
        }
        if (car.fuelLog && car.fuelLog.length) {
            for (let f of car.fuelLog) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, f.date || new Date())
                    .input('Liters', sql.Decimal(8,2), f.amount || 0).input('Cost', sql.Decimal(10,2), f.cost || 0).input('Price', sql.Decimal(8,2), 0)
                    .query('INSERT INTO FuelLogs (VehicleId, Date, Liters, PricePerLiter, TotalCost) VALUES (@Vid, @Date, @Liters, @Price, @Cost)');
            }
        }
        if (car.expenses && car.expenses.length) {
            for (let e of car.expenses) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, e.date || new Date())
                    .input('Cat', sql.NVarChar, e.type || e.typeOther || '').input('Amt', sql.Decimal(10,2), e.amount || 0).input('Desc', sql.NVarChar, e.notes || '')
                    .query('INSERT INTO Expenses (VehicleId, Date, Category, Amount, Description) VALUES (@Vid, @Date, @Cat, @Amt, @Desc)');
            }
        }
        if (car.accidents && car.accidents.length) {
            for (let a of car.accidents) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, a.date || new Date())
                    .input('Desc', sql.NVarChar, a.description || '').input('Cost', sql.Decimal(10,2), a.repairCost || 0)
                    .query('INSERT INTO Accidents (VehicleId, Date, Description, EstimatedCost) VALUES (@Vid, @Date, @Desc, @Cost)');
            }
        }
        if (car.reports && car.reports.length) {
            for (let r of car.reports) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, r.date || new Date())
                    .input('Type', sql.NVarChar, r.offenseType || '').input('Amt', sql.Decimal(10,2), r.amount || 0)
                    .input('Loc', sql.NVarChar, r.location || '').input('Pts', sql.Int, r.points || 0).input('Han', sql.Bit, r.isHandled ? 1:0)
                    .query('INSERT INTO Fines (VehicleId, Date, OffenseType, Amount, Location, Points, IsHandled) VALUES (@Vid, @Date, @Type, @Amt, @Loc, @Pts, @Han)');
            }
        }
        if (car.alerts && car.alerts.length) {
            for (let a of car.alerts) {
                await pool.request().input('Vid', sql.Int, vehicleId).input('Date', sql.Date, a.date || new Date())
                    .input('Title', sql.NVarChar, a.title || '').input('Urg', sql.NVarChar, a.urgency || '').input('Freq', sql.NVarChar, a.frequency || '')
                    .query('INSERT INTO Alerts (VehicleId, Date, Title, Urgency, Frequency) VALUES (@Vid, @Date, @Title, @Urg, @Freq)');
            }
        }
        if (car.insurance) {
            const insMap = { 'mandatory': 'חובה', 'comprehensive': 'מקיף', 'thirdparty': 'צד ג' };
            for (let [key, typeHebrew] of Object.entries(insMap)) {
                let ins = car.insurance[key];
                if (ins && ins.date) {
                    await pool.request().input('Vid', sql.Int, vehicleId).input('Type', sql.NVarChar, typeHebrew)
                        .input('Comp', sql.NVarChar, ins.company || '').input('Pol', sql.NVarChar, ins.policyNum || '').input('Exp', sql.NVarChar, ins.date || '')
                        .input('Cost', sql.Decimal(10,2), ins.cost || 0).input('Doc', sql.NVarChar, ins.file || '')
                        .query('INSERT INTO Insurance (VehicleId, Type, Company, PolicyNumber, ExpiryDate, Cost, DocumentBase64) VALUES (@Vid, @Type, @Comp, @Pol, @Exp, @Cost, @Doc)');
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

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const fullPrompt = `
        הוראות מערכת: אתה מוסכניק מומחה ועוזר וירטואלי של מערכת EasyCare.
        ${carContext}
        
        חוקי הברזל שלך לתשובה:
        1. קצר מאוד וקריא: מקסימום 3-4 נקודות קצרות. אל תכתוב פסקאות ארוכות.
        2. אל תעשה רווחים גדולים בין השורות. שמור על טקסט צפוף וקריא.
        3. השתמש באימוג'י אחד או שניים כדי להחיות את הטקסט.
        
        שאלת המשתמש: ${userMessage}
        `;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        res.json({ reply: responseText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "אופס! נתקלתי בבעיה. נסה שוב בעוד רגע." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Chatbot Server is running on http://localhost:${PORT}`);
});
