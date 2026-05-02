// Globals
let currentCar = null;
let savedCars = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Vehicle ID from URL or Session
    const urlParams = new URLSearchParams(window.location.search);
    let vehicleId = urlParams.get('id');

    if (!vehicleId) {
        vehicleId = sessionStorage.getItem('lastVehicleId');
        if (vehicleId) {
            // Rewrite URL to include ID transparently
            window.history.replaceState(null, null, `?id=${vehicleId}` + (window.location.hash || ''));
        }
    }

    // Build Global AutoComplete logic
    try {
        const vRes = await fetch('/api/vehicles/all');
        if (vRes.ok) {
            const allV = await vRes.json();
            attachAutocomplete('globalSearchInput', 'globalAutocompleteList', allV || []);
        }
    } catch(e) { console.warn("Failed to build autocomplete list", e); }

    if (!vehicleId) {
        alert('לא נבחר רכב. חוזר למסך הראשי.');
        window.location.href = 'after_login.html';
        return;
    }

    // Remember in session for future navigations (like coming back from search)
    sessionStorage.setItem('lastVehicleId', vehicleId);

    // Make functions available globally
    window.openEditModal = openEditModal;
    window.saveVehicleDetails = saveVehicleDetails;

    // 2. Fetch Data from Azure DB first (fallback to LocalStorage)
    try {
        const res = await fetch(`/api/vehicles/sync/${vehicleId}`);
        if (res.ok) {
            currentCar = await res.json();
            // initialize savedCars so saveToLocalStorage fallback still works
            savedCars = JSON.parse(localStorage.getItem('userCars')) || [];
        } else {
            savedCars = JSON.parse(localStorage.getItem('userCars')) || [];
            currentCar = savedCars.find(c => c.id == vehicleId);
        }
    } catch(e) {
        console.error("API Fetch failed, using LocalStorage fallback", e);
        savedCars = JSON.parse(localStorage.getItem('userCars')) || [];
        currentCar = savedCars.find(c => c.id == vehicleId);
    }

    if (!currentCar) {
        alert('הרכב לא נמצא במערכת.');
        window.location.href = 'after_login.html';
        return;
    }

    // --- DATA MIGRATION / INITIALIZATION ---
    if (!currentCar.insurance) currentCar.insurance = {};
    if (!currentCar.fuelLog) currentCar.fuelLog = [];
    if (!currentCar.treatments) currentCar.treatments = [];
    if (!currentCar.expenses) currentCar.expenses = [];
    if (!currentCar.accidents) currentCar.accidents = [];

    // Bridge DB 'alerts' array → 'customAlerts' used by the alerts module
    if (currentCar.alerts && currentCar.alerts.length > 0) {
        currentCar.customAlerts = currentCar.alerts.map(a => ({
            id: a.id ? String(a.id) : String(Date.now()),
            title: a.title || '',
            description: a.description || '',
            date: a.date || new Date().toISOString().slice(0, 10),
            priority: a.urgency === 'critical' ? 'danger' : (a.urgency === 'important' ? 'warning' : 'gray'),
            urgency: a.urgency || 'normal',
            frequency: a.frequency || 'once',
            createdAt: a.createdAt || null,
            done: a.isActive === false
        }));
    } else if (!currentCar.customAlerts) {
        currentCar.customAlerts = [];
    }
    // ---------------------------------------

    // Expose for chatbot
    window.currentCar = currentCar;

    // 3. Render Initial State
    renderHeader();
    loadUserProfile();

    // 4. Fetch HTML Views Asynchronously
    const sections = ['overview', 'treatments', 'insurance', 'reports', 'fuel', 'accidents', 'sell', 'alerts', 'expenses'];
    try {
        const dashboardContainer = document.getElementById('dashboardContent');

        // Fetch components
        const fetchPromises = sections.map(view => fetch(`components/dashboard/${view}.html`).then(res => res.text()));

        const htmlParts = await Promise.all(fetchPromises);

        // Inject parts
        dashboardContainer.innerHTML = htmlParts.join('\n');
    } catch (err) {
        console.error('Failed to load dashboard views:', err); alert('Error Loading Dashboard: ' + err.message);
        return;
    }

    // 5. Pre-Load Module Data & Execute Chart bindings
    loadOverview();
    loadTreatments();
    loadInsurance();
    loadReports();
    loadFuel();
    loadAccidents();
    if (typeof loadSell === 'function') loadSell();

    // 6. Generate QR Code
    generateQR();
    
    // Choose start section: URL Hash > localStorage > Default
    const getStartSection = () => {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            if (sections.includes(hash)) return hash;
        }
        return localStorage.getItem('lastDashboardSection') || 'overview';
    };

    const initialSection = getStartSection();
    showSection(initialSection);

    // Dynamic Hash Navigation Support (Back/Forward buttons)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (sections.includes(hash)) {
            showSection(hash);
        }
    });

    // ============================================
    // UNIVERSAL FORM AUTOSAVE DRAFT FEATURE
    // ============================================

});

// Navigation Logic
function showSection(sectionId, element) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('d-none'));

    // Show selected
    const targetEl = document.getElementById(sectionId + '-section');
    if (targetEl) {
        targetEl.classList.remove('d-none');
    } else {
        console.warn(`Section element not found: ${sectionId}-section`);
        return; // Early return to avoid broken state
    }
    
    // Update hash so refresh remembers location
    if (window.location.hash !== '#' + sectionId) {
        window.history.replaceState(null, null, '#' + sectionId);
    }
    
    // Update localStorage as ultimate fallback
    localStorage.setItem('lastDashboardSection', sectionId);

    // Update Sidebar Active State
    document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
    
    // Find link even if element wasn't passed directly
    const linkEl = element || document.querySelector(`.db-list-group a[onclick*="'${sectionId}'"]`);
    if (linkEl) {
        linkEl.classList.add('active');
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 767) {
        const wrapper = document.getElementById('wrapper');
        if (wrapper) wrapper.classList.remove('toggled');
    }

    // Rename Header
    const titles = {
        'overview': 'מבט על',
        'treatments': 'טיפולים ותחזוקה',
        'insurance': 'ביטוחים ורישוי',
        'reports': 'דוחות וקנסות',
        'fuel': 'מעקב דלק',
        'accidents': 'תיק תאונות',
        'sell': 'דו״ח מכירה לרכב',
        'alerts': 'ניהול התראות ותזכורות',
        'expenses': 'הוצאות וניתוח סטטיסטי'
    };
    document.getElementById('pageTitle').textContent = titles[sectionId];

    // Trigger module-specific load functions to ensure data is fresh and DOM is populated
    if (sectionId === 'overview' && typeof window.loadOverview === 'function') {
        window.loadOverview();
    } else if (sectionId === 'treatments' && typeof window.loadTreatments === 'function') {
        window.loadTreatments();
    } else if (sectionId === 'insurance' && typeof window.loadInsurance === 'function') {
        window.loadInsurance();
    } else if (sectionId === 'reports' && typeof window.loadReports === 'function') {
        window.loadReports();
    } else if (sectionId === 'fuel' && typeof window.loadFuel === 'function') {
        window.loadFuel();
    } else if (sectionId === 'accidents' && typeof window.loadAccidents === 'function') {
        window.loadAccidents();
    } else if (sectionId === 'alerts' && typeof window.loadAlerts === 'function') {
        window.loadAlerts();
    } else if (sectionId === 'expenses' && typeof window.loadExpenses === 'function') {
        window.loadExpenses();
    } else if (sectionId === 'sell' && typeof window.renderGallery === 'function') {
        window.renderGallery();
        if (typeof window.loadSell === 'function') window.loadSell();
    }
}

// Programmatic navigation (e.g. from overview alert cards)
window.goToSection = function(sectionId) {
    showSection(sectionId);
    // Sync sidebar highlight
    document.querySelectorAll('.list-group-item').forEach(el => {
        const onclick = el.getAttribute('onclick') || '';
        if (onclick.includes(`'${sectionId}'`)) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function loadUserProfile() {
    try {
        let userStr = localStorage.getItem('loggedInUser');
        if (!userStr && localStorage.getItem('userId')) {
            // Backward compatibility for existing sessions
            const fallbackUser = {
                id: localStorage.getItem('userId'),
                fullName: localStorage.getItem('userName') || 'משתמש',
                email: localStorage.getItem('userEmail') || ''
            };
            userStr = JSON.stringify(fallbackUser);
            localStorage.setItem('loggedInUser', userStr);
        }

        if (userStr) {
            const user = JSON.parse(userStr);
            const nameEl = document.getElementById('sidebarUserName');
            const imgEl = document.getElementById('sidebarUserImg');
            
            if (nameEl) nameEl.textContent = user.fullName || user.email || 'משתמש לא ידוע';
            if (imgEl) {
                if (user.avatar) {
                    imgEl.src = user.avatar;
                } else {
                    imgEl.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || user.email || 'U') + '&background=2d74d7&color=fff&rounded=true';
                }
            }
            
            // Sync with DB
            if (user.id) {
                fetch('/api/user/me', { headers: { 'userid': user.id } })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.user) {
                            const u = data.user;
                            if (nameEl) nameEl.textContent = u.FullName || u.Email || 'משתמש לא ידוע';
                            if (imgEl) {
                                if (u.Avatar) {
                                    imgEl.src = u.Avatar;
                                } else {
                                    imgEl.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.FullName || u.Email || 'U') + '&background=2d74d7&color=fff&rounded=true';
                                }
                            }
                            
                            // Keep LocalStorage fresh
                            let localUser = JSON.parse(userStr);
                            localUser.fullName = u.FullName;
                            localUser.email = u.Email;
                            localUser.phone = u.Phone;
                            localUser.avatar = u.Avatar;
                            localStorage.setItem('loggedInUser', JSON.stringify(localUser));
                        }
                    }).catch(err => console.warn("Background profile sync failed", err));
            }
        } else {
            document.getElementById('sidebarUserName').textContent = 'אורח';
            document.getElementById('sidebarUserImg').src = 'https://ui-avatars.com/api/?name=Guest&background=bbbec5&color=fff&rounded=true';
        }
    } catch(e) {
        console.error("Failed to load user profile:", e);
    }
}

function renderHeader() {
    const fullName = `${currentCar.brandHeb || currentCar.brand} ${currentCar.model}`;
    const nameEl = document.getElementById('vehicleName');
    if (nameEl) {
        nameEl.textContent = fullName;
        nameEl.title = fullName;
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.maxWidth = '100%';
        if (fullName.length > 18) {
            nameEl.style.fontSize = '1.2rem';
        } else if (fullName.length > 14) {
            nameEl.style.fontSize = '1.5rem';
        } else {
            nameEl.style.fontSize = '';
        }
    }
    document.getElementById('vehicleLicense').textContent = currentCar.licensePlate || '12-345-67';

    const logoImg = document.getElementById('vehicleLogo');
    logoImg.src = currentCar.logo || 'images/logos/default.png';
    logoImg.onerror = () => { logoImg.src = 'images/logos/default.png'; };
}

// --- FEATURES ---

function generateQR() {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ''; // Clear prev
    // URL to current page
    const url = window.location.href;
    new QRCode(qrContainer, {
        text: url,
        width: 128,
        height: 128
    });
}

function exportToPDF() {
    // Select the element to export. For dashboard, usually the content wrapper.
    const element = document.getElementById('page-content-wrapper');
    const opt = {
        margin: 0.5,
        filename: `Vehicle_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    // Temporarily show all sections to print everything?
    // Or just print current view? User usually wants everything.
    // Making a "Print View" is complex, let's print current view or specific report.
    // User asked "Convert all vehicle details". Let's try to un-hide data for a sec or just print what's there.
    // Better approach: Alert user this prints current view.

    html2pdf().set(opt).from(element).save();
}

// --- UTILS ---
window.parseDate = function (dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

window.formatDate = function (dateInput) {
    if (!dateInput) return '--';
    const d = window.parseDate(dateInput);
    if (!d) return dateInput;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

window.toInputDate = function (dateInput) {
    if (!dateInput) return '';
    const d = window.parseDate(dateInput);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

window.isDateFuture = function (dateStr) {
    const d = window.parseDate(dateStr);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
}

let isSyncing = false;
let pendingSync = false;

window.saveToLocalStorage = async function () {
    const index = savedCars.findIndex(c => parseInt(c.id) === parseInt(currentCar.id));
    if (index !== -1) {
        savedCars[index] = currentCar;
        localStorage.setItem('userCars', JSON.stringify(savedCars));
    }
    
    // Queue synchronization to prevent Race Conditions dropping rows on fast typers/multiple images
    if (isSyncing) {
        pendingSync = true;
        return;
    }

    isSyncing = true;
    do {
        pendingSync = false;
        try {
            const userId = localStorage.getItem('userId') || '1';
            const resp = await fetch(`/api/vehicles/sync/${currentCar.id}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'userid': userId
                },
                body: JSON.stringify(currentCar)
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                console.error("Azure DB Sync failed:", errData.error || resp.status);
            } else {
                console.log("Successfully synced Vehicle Data to Azure DB.");
            }
        } catch (e) {
            console.error("Azure DB Sync failed (network error):", e);
        }
    } while (pendingSync);
    
    isSyncing = false;
}

let expensesChartInstance = null;

function initExpensesChart(treatmentCost = 0, insuranceCost = 0, fuelCost = 0, accidentCost = 0, reportCost = 0) {
    const canvas = document.getElementById('expensesChart');
    if (!canvas) return;

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    // Modern, vibrant colors for the pie chart
    const colors = {
        treatments: '#ef4444', // Vivid Red
        insurance: '#10b981',  // Emerald Green
        fuel: '#f59e0b',       // Amber/Yellow
        accidents: '#f97316',  // Bright Orange
        reports: '#3b82f6'     // Vivid Blue
    };

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    expensesChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['טיפולים ותחזוקה', 'ביטוח ורישוי', 'דלק', 'תאונות ונזקים', 'דוחות וקנסות'],
            datasets: [{
                data: [treatmentCost, insuranceCost, fuelCost, accidentCost, reportCost],
                backgroundColor: [colors.treatments, colors.insurance, colors.fuel, colors.accidents, colors.reports],
                hoverBackgroundColor: [colors.treatments, colors.insurance, colors.fuel, colors.accidents, colors.reports],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 12,
                borderRadius: 8,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            layout: {
                padding: 10
            },
            plugins: {
                datalabels: {
                    display: false
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: 'Segoe UI, system-ui, sans-serif',
                            size: 13,
                            weight: '500'
                        },
                        color: '#475569'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Segoe UI, system-ui, sans-serif', size: 14, weight: 'bold' },
                    bodyFont: { family: 'Segoe UI, system-ui, sans-serif', size: 14 },
                    padding: 14,
                    cornerRadius: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('he-IL').format(context.parsed) + ' ₪';
                            }
                            return label;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1200,
                easing: 'easeOutQuart'
            }
        }
    });
}

function calculateReliability(carData) {
    let score = 100;
    
    // Penalty for missing or expired test
    if (!carData.testDate || carData.testDate === 'אין נתונים') {
        score -= 15;
    } else {
        const today = new Date();
        let testD;
        if (typeof carData.testDate === 'string' && carData.testDate.includes('/')) {
            const [d, m, y] = carData.testDate.split('/');
            testD = new Date(`${y}-${m}-${d}`);
        } else {
            testD = new Date(carData.testDate);
        }
        
        if (isNaN(testD.getTime()) || testD < today) score -= 15;
    }
    
    // Penalty for high km
    const mileage = parseInt(carData.km);
    if (!isNaN(mileage)) {
        const kmPenalty = Math.floor(mileage / 100000) * 5;
        score -= kmPenalty;
    }
    
    // Penalty for accidents
    if (carData.accidents && Array.isArray(carData.accidents)) {
        score -= (carData.accidents.length * 10);
    }
    
    return Math.max(0, score);
}

function openEditModal() {
    document.getElementById('editBrand').value = currentCar.brandHeb || currentCar.brand || '';
    document.getElementById('editModel').value = currentCar.model || '';
    document.getElementById('editYear').value = currentCar.year || '';
    document.getElementById('editColor').value = currentCar.color || '';
    document.getElementById('editKm').value = currentCar.km || '';
    
    let parsedTestDate = '';
    if (currentCar.testDate && currentCar.testDate !== 'אין נתונים') {
        if (currentCar.testDate.includes('/')) {
            parsedTestDate = currentCar.testDate.split('/').reverse().join('-');
        } else {
            parsedTestDate = currentCar.testDate.split('T')[0];
        }
    }
    document.getElementById('editTestDate').value = parsedTestDate;
    document.getElementById('editStatus').value = currentCar.status || 'פעיל';
    
    const newScore = calculateReliability(currentCar);
    document.getElementById('editReliabilityScore').value = newScore;

    document.getElementById('editFuel').value = currentCar.fuelType || '';
    document.getElementById('editHP').value = currentCar.horsePower || '';
    document.getElementById('editEngine').value = currentCar.engineVolume || '';
    document.getElementById('editTireF').value = currentCar.tireFront || '';
    document.getElementById('editTireR').value = currentCar.tireRear || '';

    const preview = document.getElementById('editLogoPreview');
    preview.src = currentCar.logo || 'https://ui-avatars.com/api/?name=Car&background=random';
    preview.onerror = () => { preview.src = 'https://ui-avatars.com/api/?name=Car&background=random'; };

    const errorMsg = document.getElementById('editVehicleErrorMsg');
    if(errorMsg) errorMsg.classList.add('d-none');
    
    new bootstrap.Modal(document.getElementById('editVehicleModal')).show();
}

async function saveVehicleDetails() {
    const btn = document.getElementById('btnSaveVehicleDetails');
    const normalText = btn.querySelector('.normal-text');
    const loadingText = btn.querySelector('.loading-text');
    const errorMsg = document.getElementById('editVehicleErrorMsg');
    
    const brand = document.getElementById('editBrand').value.trim();
    const model = document.getElementById('editModel').value.trim();
    const km = parseInt(document.getElementById('editKm').value) || 0;
    
    if (!brand || !model) {
        errorMsg.textContent = 'שדות יצרן ודגם הם חובה.';
        errorMsg.classList.remove('d-none');
        return;
    }
    if (km < 0) {
        errorMsg.textContent = 'קילומטראז לא יכול להיות שלילי.';
        errorMsg.classList.remove('d-none');
        return;
    }
    errorMsg.classList.add('d-none');
    
    btn.disabled = true;
    normalText.classList.add('d-none');
    loadingText.classList.remove('d-none');

    const newTestDate = document.getElementById('editTestDate').value;
    const tempCar = { ...currentCar, testDate: newTestDate, km: km };
    const autoScore = calculateReliability(tempCar);

    const fileInput = document.getElementById('editLogoInput');
    const file = fileInput.files[0];

    const executeSave = async (logoData) => {
        try {
            const payload = {
                brandHeb: brand,
                model: model,
                year: parseInt(document.getElementById('editYear').value) || currentCar.year,
                color: document.getElementById('editColor').value,
                km: km,
                testDate: newTestDate,
                status: document.getElementById('editStatus').value || 'פעיל',
                reliabilityScore: autoScore,
                fuelType: document.getElementById('editFuel').value,
                horsePower: document.getElementById('editHP').value,
                engineVolume: document.getElementById('editEngine').value,
                tireFront: document.getElementById('editTireF').value,
                tireRear: document.getElementById('editTireR').value,
                logo: logoData || currentCar.logo
            };

            // Call the direct PUT endpoint
            const res = await fetch(`/api/vehicles/${currentCar.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'userid': localStorage.getItem('userId') || 1
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('שגיאה בשמירת הנתונים במסד הנתונים.');

            // Update local memory and UI
            Object.assign(currentCar, payload);
            renderHeader(); 
            if (typeof window.loadOverview === 'function') window.loadOverview();
            
            // Full Sync for background
            saveToLocalStorage();
            
            bootstrap.Modal.getInstance(document.getElementById('editVehicleModal')).hide();
        } catch (err) {
            console.error('Save Error:', err);
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('d-none');
        } finally {
            btn.disabled = false;
            normalText.classList.remove('d-none');
            loadingText.classList.add('d-none');
        }
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            executeSave(e.target.result);
        };
        reader.readAsDataURL(file);
    } else if (brand && brand !== (currentCar.brandHeb || '')) {
        const hebrewBrand = brand.split('-')[0].trim();
        const brandOverrides = { 'לינק אנד קו': 'lynk-and-co' };
        if (brandOverrides[hebrewBrand]) {
            executeSave(`images/logos/${brandOverrides[hebrewBrand]}.png`);
            return;
        }

        try {
            const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${hebrewBrand}&langpair=he|en`);
            const data = await transRes.json();
            let englishBrand = data.responseData.translatedText.toLowerCase().trim();
            englishBrand = englishBrand.replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
            executeSave(`images/logos/${englishBrand}.png`);
        } catch (err) {
            console.error('Translation error:', err);
            executeSave(null);
        }
    } else {
        executeSave(null);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btnSaveVehicleDetails');
    if (btnSave) {
        btnSave.addEventListener('click', saveVehicleDetails);
    }
});

function attachAutocomplete(inputId, listId, allVehiclesArr) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if(!input || !list) return;

    input.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!val) {
            list.classList.add('d-none');
            return;
        }

        const matches = allVehiclesArr.filter(v => {
            const plate = (v.LicensePlate || '');
            const brandHeb = (v.BrandHeb || '').toLowerCase();
            const brandEn = (v.Brand || '').toLowerCase();
            return plate.startsWith(val) || brandHeb.startsWith(val) || brandEn.startsWith(val);
        });

        if (matches.length > 0) {
            matches.slice(0, 8).forEach(v => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action fw-bold';
                li.style.cursor = 'pointer';
                li.innerHTML = `<span class="text-primary">${v.LicensePlate}</span> - <span class="text-muted fw-normal">${v.BrandHeb || ''} ${v.Model || ''}</span>`;
                li.onmousedown = () => {
                    input.value = v.LicensePlate;
                    list.classList.add('d-none');
                    window.location.href = 'search_results.html?q=' + encodeURIComponent(v.LicensePlate);
                };
                list.appendChild(li);
            });
            list.classList.remove('d-none');
        } else {
            list.classList.add('d-none');
        }
    });

    input.addEventListener('blur', () => { setTimeout(() => list.classList.add('d-none'), 150); });
    input.addEventListener('focus', function() { if(this.value && list.innerHTML !== '') list.classList.remove('d-none'); });
}
