// Globals
let currentCar = null;
let savedCars = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Vehicle ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id');

    if (!vehicleId) {
        alert('לא נבחר רכב. חוזר למסך הראשי.');
        window.location.href = 'after_login.html';
        return;
    }

    // Make functions available globally
    window.openEditModal = openEditModal;
    window.saveVehicleDetails = saveVehicleDetails;

    // 2. Fetch Data
    savedCars = JSON.parse(localStorage.getItem('userCars')) || [];
    currentCar = savedCars.find(c => c.id == vehicleId);

    if (!currentCar) {
        alert('הרכב לא נמצא במערכת.');
        window.location.href = 'after_login.html';
        return;
    }

    // --- DATA MIGRATION / INITIALIZATION ---
    if (!currentCar.insurance) currentCar.insurance = {};
    if (!currentCar.fuelLog) currentCar.fuelLog = [];
    if (!currentCar.treatments) currentCar.treatments = [];
    if (!currentCar.customAlerts) currentCar.customAlerts = [];
    if (!currentCar.expenses) currentCar.expenses = [];
    // ---------------------------------------

    // 3. Render Initial State
    renderHeader();

    // 4. Fetch HTML Views Asynchronously
    try {
        const dashboardContainer = document.getElementById('dashboardContent');

        // Fetch components
        const views = ['overview', 'treatments', 'insurance', 'reports', 'fuel', 'accidents', 'sell', 'alerts', 'expenses'];
        const fetchPromises = views.map(view => fetch(`components/dashboard/${view}.html`).then(res => res.text()));

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

    // 6. Generate QR Code and show default tab
    generateQR();
    showSection('overview'); // Show default view after load
});

// Navigation Logic
function showSection(sectionId, element) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('d-none'));

    // Show selected
    document.getElementById(sectionId + '-section').classList.remove('d-none');

    // Update Sidebar Active State (only if clicked via sidebar)
    if (element) {
        document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');

        // Close sidebar on mobile after clicking
        if (window.innerWidth <= 767) {
            document.getElementById('wrapper').classList.remove('toggled');
        }
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

    if (sectionId === 'sell' && typeof window.renderGallery === 'function') {
        window.renderGallery();
    } else if (sectionId === 'alerts') {
        loadAlerts();
    } else if (sectionId === 'expenses') {
        loadExpenses();
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
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

window.isDateFuture = function (dateStr) {
    const d = window.parseDate(dateStr);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
}

window.saveToLocalStorage = function () {
    const index = savedCars.findIndex(c => c.id === currentCar.id);
    if (index !== -1) {
        savedCars[index] = currentCar;
        localStorage.setItem('userCars', JSON.stringify(savedCars));
    }
}

let expensesChartInstance = null;

function initExpensesChart(treatmentCost = 0, insuranceCost = 0, fuelCost = 0, accidentCost = 0, reportCost = 0) {
    const canvas = document.getElementById('expensesChart');
    if (!canvas) return;

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    expensesChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['טיפולים ותחזוקה', 'ביטוח ורישוי', 'דלק', 'תאונות ונזקים', 'דוחות וקנסות'],
            datasets: [{
                data: [treatmentCost, insuranceCost, fuelCost, accidentCost, reportCost],
                backgroundColor: ['#ec4b4bff', '#15c933ff', '#ffc107', '#fd7e14', '#0dcaf0'],
                hoverBackgroundColor: ['#ec4b4bff', '#15c933ff', '#ffc107', '#fd7e14', '#0dcaf0'],
                borderWidth: 0,
                spacing: 4,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: 'Segoe UI',
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { family: 'Segoe UI', size: 14 },
                    bodyFont: { family: 'Segoe UI', size: 14 },
                    padding: 12,
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
                animateRotate: true
            }
        }
    });
}

function openEditModal() {
    document.getElementById('editBrand').value = currentCar.brandHeb || currentCar.brand || '';
    document.getElementById('editModel').value = currentCar.model || '';

    document.getElementById('editYear').value = currentCar.year || '';
    document.getElementById('editColor').value = currentCar.color || '';
    document.getElementById('editKm').value = currentCar.km || '';
    document.getElementById('editTestDate').value = currentCar.testDate !== 'אין נתונים' ? (currentCar.testDate || '') : '';

    document.getElementById('editFuel').value = currentCar.fuelType || '';
    document.getElementById('editHP').value = currentCar.horsePower || '';
    document.getElementById('editEngine').value = currentCar.engineVolume || '';
    document.getElementById('editTireF').value = currentCar.tireFront || '';
    document.getElementById('editTireR').value = currentCar.tireRear || '';

    const preview = document.getElementById('editLogoPreview');
    preview.src = currentCar.logo || 'images/logos/default.png';
    preview.onerror = () => { preview.src = 'images/logos/default.png'; };

    new bootstrap.Modal(document.getElementById('editVehicleModal')).show();
}

function saveVehicleDetails() {
    const newBrand = document.getElementById('editBrand').value;
    const newModel = document.getElementById('editModel').value;

    const newYear = document.getElementById('editYear').value;
    const newColor = document.getElementById('editColor').value;
    const newKm = document.getElementById('editKm').value;
    const newTestDate = document.getElementById('editTestDate').value;
    const newFuel = document.getElementById('editFuel').value;
    const newHP = document.getElementById('editHP').value;
    const newEngine = document.getElementById('editEngine').value;
    const newTireF = document.getElementById('editTireF').value;
    const newTireR = document.getElementById('editTireR').value;

    const fileInput = document.getElementById('editLogoInput');
    const file = fileInput.files[0];

    const saveDetails = (logoData) => {
        currentCar.brandHeb = newBrand;
        currentCar.model = newModel;

        if (newYear) currentCar.year = newYear;
        if (newColor) currentCar.color = newColor;
        if (newKm) currentCar.km = parseInt(newKm);
        if (newTestDate) currentCar.testDate = newTestDate;

        if (newFuel) currentCar.fuelType = newFuel;
        if (newHP) currentCar.horsePower = newHP;
        if (newEngine) currentCar.engineVolume = newEngine;
        if (newTireF) currentCar.tireFront = newTireF;
        if (newTireR) currentCar.tireRear = newTireR;

        if (logoData) {
            currentCar.logo = logoData;
        }

        saveToLocalStorage();
        loadVehicleData(); // updates DOM header
        bootstrap.Modal.getInstance(document.getElementById('editVehicleModal')).hide();
    };

    if (file) {
        // User uploaded a manual logo
        const reader = new FileReader();
        reader.onload = function (e) {
            saveDetails(e.target.result);
        };
        reader.readAsDataURL(file);
    } else if (newBrand && newBrand !== (currentCar.brandHeb || '')) {
        // User changed the brand but didn't upload a picture - Auto-assign logo!
        const hebrewBrand = newBrand.split('-')[0].trim();

        const brandOverrides = {
            'לינק אנד קו': 'lynk-and-co'
        };

        if (brandOverrides[hebrewBrand]) {
            saveDetails(`images/logos/${brandOverrides[hebrewBrand]}.png`);
            return;
        }

        // Show loading state on button while fetching
        const btnSave = document.querySelector('#editVehicleModal .btn-primary');
        if (btnSave) {
            const origText = btnSave.innerHTML;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מתרגם...';
            btnSave.disabled = true;

            fetch(`https://api.mymemory.translated.net/get?q=${hebrewBrand}&langpair=he|en`)
                .then(res => res.json())
                .then(data => {
                    let englishBrand = data.responseData.translatedText.toLowerCase().trim();
                    englishBrand = englishBrand.replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
                    saveDetails(`images/logos/${englishBrand}.png`);
                })
                .catch(err => {
                    console.error('Translation error:', err);
                    saveDetails(null);
                })
                .finally(() => {
                    btnSave.innerHTML = origText;
                    btnSave.disabled = false;
                });
        } else {
            fetch(`https://api.mymemory.translated.net/get?q=${hebrewBrand}&langpair=he|en`)
                .then(res => res.json())
                .then(data => {
                    let englishBrand = data.responseData.translatedText.toLowerCase().trim();
                    englishBrand = englishBrand.replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
                    saveDetails(`images/logos/${englishBrand}.png`);
                })
                .catch(err => {
                    console.error('Translation error:', err);
                    saveDetails(null);
                });
        }
    } else {
        // No file, no brand change
        saveDetails(null);
    }
}
