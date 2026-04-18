/**
 * --- AFTER LOGIN PREMIUM CONTROLLER ---
 * Fleet overview, personalized UX, and luxury interactions.
 */

/* ── HELPER UTILS ───────────────────────────────────────────────────────────── */
function isDateFuture(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d > new Date();
}

/**
 * Enhanced Reliability Calculation for Fleet View (Strict Logic)
 * Must match dashboard-overview.js logic 1:1
 */
window.calculateReliability = function (car) {
    let score = 0;

    const isDateFuture = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d > new Date();
    };

    // 1. Treatments with invoice (30%)
    const treatmentsWithInvoice = (car.treatments || []).filter(t => t.invoice).length;
    score += Math.min(treatmentsWithInvoice / 5, 1) * 30;

    // 2. Insurance (20%)
    const insObj = car.insurance || {};
    const hasMandatory = insObj.mandatory?.date && isDateFuture(insObj.mandatory.date) && insObj.mandatory.file;
    const hasCompOrThird = (insObj.comprehensive?.date && isDateFuture(insObj.comprehensive.date) && insObj.comprehensive.file)
        || (insObj.thirdparty?.date && isDateFuture(insObj.thirdparty.date) && insObj.thirdparty.file);
    
    if (hasMandatory) score += 10;
    if (hasCompOrThird) score += 10;

    // 3. Fuel Logs (20%)
    const fuelCount = (car.fuelLog || []).length;
    score += Math.min(fuelCount / 5, 1) * 20;

    // 4. Valid Test (15%)
    const testDone = !!(car.testDate && isDateFuture(car.testDate));
    if (testDone) score += 15;

    // 5. Mileage (15%)
    const kmDone = !!(car.km && car.km > 0);
    if (kmDone) score += 15;

    return Math.round(score);
};

/* ── DOM READY ─────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    initHeroGreeting();
    loadUserProfile();
    await fetchAndRenderFleet();
});

/* ── CORE LOGIC ────────────────────────────────────────────────────────────── */

async function fetchAndRenderFleet() {
    const row = document.getElementById('vehicleRow');
    const addWrapper = document.getElementById('addCardWrapper');
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('/api/vehicles', {
            headers: { 'userid': userId }
        });
        
        if (!res.ok) throw new Error('Failed to fetch vehicles');
        
        const savedCars = await res.json();
        
        // Map to internal format
        const memCars = savedCars.map(car => ({
            id: car.Id,
            brandHeb: car.BrandHeb,
            model: car.Model,
            year: car.Year,
            logo: car.Logo || 'images/logos/default.png',
            licensePlate: car.LicensePlate,
            km: car.Km,
            testDate: car.TestDate,
            // Full data now coming from the updated comprehensive API
            treatments: car.treatments || [],
            accidents: car.accidents || [],
            fuelLog: car.fuelLog || [],
            insurance: car.insurance || {},
            reliabilityScore: car.ReliabilityScore
        }));
        
        localStorage.setItem('userCars', JSON.stringify(memCars));

        // Clear existing injected cards
        document.querySelectorAll('.premium-card-wrapper:not(#addCardWrapper)').forEach(c => c.remove());

        let totalFleetScore = 0;

        memCars.forEach(car => {
            const relScore = window.calculateReliability(car);
            totalFleetScore += relScore;

            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4 col-xl-3 premium-card-wrapper fleet-item';
            col.setAttribute('data-search', `${car.brandHeb} ${car.model} ${car.licensePlate}`.toLowerCase());
            
            let statusColorClass = 'score-low';
            if (relScore >= 80) statusColorClass = 'score-high';
            else if (relScore >= 50) statusColorClass = 'score-mid';

            col.innerHTML = `
                <div class="premium-card">
                    <div class="reliability-ribbon ${statusColorClass}">
                        <i class="fas fa-microchip"></i>
                        <span>${relScore}% Reliability</span>
                    </div>

                    <div class="kebab-menu">
                        <button class="kebab-btn" onclick="toggleCardActions(event, this)">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="javascript:void(0)" onclick="editCar(${car.id})"><i class="fas fa-edit me-2"></i> עריכה</a>
                            <a href="javascript:void(0)" onclick="deleteCar(${car.id})" class="text-danger"><i class="fas fa-trash me-2"></i> מחיקה</a>
                        </div>
                    </div>

                    <div class="card-logo-container">
                        <img src="${car.logo}" onerror="this.src='images/logos/default.png'">
                    </div>

                    <div class="card-info">
                        <h3 class="car-name">${car.brandHeb} ${car.model}</h3>
                        <p class="car-year">${car.year} • ${car.licensePlate}</p>
                    </div>

                    <a class="btn-premium-enter" href="dashboard.html?id=${car.id}">
                        ניהול רכב <i class="fas fa-chevron-left ms-2" style="font-size: 0.8rem;"></i>
                    </a>
                </div>
            `;
            
            // Add individual hover 3D tilt
            addTiltEffect(col);

            row.insertBefore(col, addWrapper);
        });

        // Update stats
        document.getElementById('carCountStat').textContent = `${memCars.length} רכבים רשומים`;
        const avgScore = memCars.length > 0 ? Math.round(totalFleetScore / memCars.length) : 0;
        document.getElementById('avgReliabilityStat').textContent = `ציון אמינות צי: ${avgScore}%`;

    } catch (err) {
        console.error('Error fetching cars:', err);
    }
}

function initHeroGreeting() {
    const greetingEl = document.getElementById('heroGreeting');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let text = "יום טוב";
    if (hour >= 5 && hour < 12) text = "בוקר טוב";
    else if (hour >= 12 && hour < 17) text = "צהריים טובים";
    else if (hour >= 17 && hour < 21) text = "ערב טוב";
    else text = "לילה טוב";

    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    const firstName = (user.fullName || "משתמש").split(' ')[0];

    greetingEl.textContent = `${text}, ${firstName}!`;
}

/* ── INTERACTIONS ───────────────────────────────────────────────────────────── */

function filterFleet() {
    const query = document.getElementById('fleetSearch').value.toLowerCase();
    const items = document.querySelectorAll('.fleet-item');
    items.forEach(item => {
        const text = item.getAttribute('data-search');
        item.style.display = text.includes(query) ? 'block' : 'none';
    });
}

function toggleCardActions(e, btn) {
    e.stopPropagation();
    const dropdown = btn.nextElementSibling;
    
    // Close others
    document.querySelectorAll('.dropdown-content').forEach(d => {
        if(d !== dropdown) d.classList.remove('show');
    });

    dropdown.classList.toggle('show');
}

// Click outside to close dropdowns
window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
});

function addTiltEffect(el) {
    const card = el.querySelector('.premium-card');
    el.addEventListener('mousemove', (e) => {
        const { left, top, width, height } = el.getBoundingClientRect();
        const x = (e.clientX - left) / width;
        const y = (e.clientY - top) / height;
        
        const tiltX = (y - 0.5) * 10; // degrees
        const tiltY = (x - 0.5) * -10; // degrees

        card.style.transform = `translateY(-12px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    el.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
    });
}

/* ── VEHICLE CRUD ────────────────────────────────────────────────────────────── */

async function deleteCar(id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הרכב מהצי?')) return;
    const userId = localStorage.getItem('userId');
    try {
        const res = await fetch(`/api/vehicles/${id}`, {
            method: 'DELETE',
            headers: { 'userid': userId }
        });
        if (res.ok) {
            location.reload();
        }
    } catch(err) { console.error(err); }
}

let currentEditingCarId = null;
function editCar(id) {
    const cars = JSON.parse(localStorage.getItem('userCars')) || [];
    const car = cars.find(c => c.id === id);
    if (!car) return;

    currentEditingCarId = id;
    document.getElementById('editBrand').value = car.brandHeb;
    document.getElementById('editModel').value = car.model;
    document.getElementById('editLogoPreview').src = car.logo || 'images/logos/default.png';

    const modal = new bootstrap.Modal(document.getElementById('editVehicleModal'));
    modal.show();
}

async function saveVehicleDetails() {
    const brand = document.getElementById('editBrand').value.trim();
    const model = document.getElementById('editModel').value.trim();
    const logoSrc = document.getElementById('editLogoPreview').src;
    const userId = localStorage.getItem('userId');

    try {
        const payload = { brandHeb: brand, model: model, logo: logoSrc };
        const res = await fetch(`/api/vehicles/${currentEditingCarId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'userid': userId },
            body: JSON.stringify(payload)
        });

        if (res.ok) location.reload();
    } catch (err) { console.error(err); }
}

/* ── PROFILE SYNC ───────────────────────────────────────────────────────────── */
function loadUserProfile() {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    const nameEl = document.getElementById('sidebarUserName');
    const imgEl = document.getElementById('sidebarUserImg');

    if (nameEl) nameEl.textContent = user.fullName || "משתמש";
    if (imgEl) {
        imgEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=0071e3&color=fff&rounded=true`;
    }
}