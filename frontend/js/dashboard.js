/**
 * @fileoverview frontend/js/dashboard.js
 * @description קובץ הליבה (Core) לניהול עמוד לוח הבקרה (Dashboard). מכיל את הלוגיקה החולשת על נתוני הרכב המרכזיים, מנגנון שמירת הנתונים וסנכרון מול שרת ה-API, פונקציות הניווט (SPA Navigation) וטעינת תתי-המודולים אסינכרונית, ואת פונקציות העזר הגלובליות לשערוך וחישוב תאריכים וגרפים במערכת.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

let currentCar = null;
let savedCars = [];

/**
 * מאזין הליבה של עמוד לוח הבקרה. בעת טעינת הדף, מחלץ את מזהה הרכב (מה-URL או מה-Session), מבצע Fetch לשרת כדי לסנכרן נתונים, מאכלס אוטומטית שדות חסרים, וטוען בצורה אסינכרונית את כלל ה-HTML של המודולים (Overview, Treatments, Reports וכו') לתוך העמוד ללא צורך בריענון.
 */
document.addEventListener('DOMContentLoaded', async () => {

    const urlParams = new URLSearchParams(window.location.search);
    let vehicleId = urlParams.get('id');

    if (!vehicleId) {
        vehicleId = sessionStorage.getItem('lastVehicleId');
        if (vehicleId) {

            window.history.replaceState(null, null, `?id=${vehicleId}` + (window.location.hash || ''));
        }
    }

    try {
        const vRes = await fetch('/api/vehicles/all', {
            headers: { 'userid': sessionStorage.getItem('userId') || '1' }
        });
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

    sessionStorage.setItem('lastVehicleId', vehicleId);

    window.openEditModal = openEditModal;
    window.saveVehicleDetails = saveVehicleDetails;

    try {
        const userId = sessionStorage.getItem('userId') || '1';
        const res = await fetch(`/api/vehicles/sync/${vehicleId}`, {
            headers: { 'userid': userId }
        });
        if (res.ok) {
            currentCar = await res.json();

            savedCars = JSON.parse(sessionStorage.getItem('userCars')) || [];
        } else {
            savedCars = JSON.parse(sessionStorage.getItem('userCars')) || [];
            currentCar = savedCars.find(c => c.id == vehicleId);
        }
    } catch(e) {
        console.error("API Fetch failed, using LocalStorage fallback", e);
        savedCars = JSON.parse(sessionStorage.getItem('userCars')) || [];
        currentCar = savedCars.find(c => c.id == vehicleId);
    }

    if (!currentCar) {
        alert('הרכב לא נמצא במערכת.');
        window.location.href = 'after_login.html';
        return;
    }

    if (!currentCar.insurance) currentCar.insurance = {};
    if (!currentCar.fuelLog) currentCar.fuelLog = [];
    if (!currentCar.treatments) currentCar.treatments = [];
    if (!currentCar.expenses) currentCar.expenses = [];
    if (!currentCar.accidents) currentCar.accidents = [];

    if (!currentCar.customAlerts || currentCar.customAlerts.length === 0) {
        if (currentCar.alerts && currentCar.alerts.length > 0) {
            currentCar.customAlerts = currentCar.alerts.map(a => ({
                id: a.id ? String(a.id) : String(Date.now()),
                title: a.title || '',
                description: a.description || '',
                date: a.date ? (typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
                priority: a.urgency === 'critical' ? 'danger' : (a.urgency === 'important' ? 'warning' : 'gray'),
                urgency: a.urgency || 'normal',
                frequency: a.frequency || 'once',
                done: a.isActive === false || a.isActive === 0
            }));
        } else {
            currentCar.customAlerts = [];
        }
    }

    if (!currentCar.reports) currentCar.reports = [];
    if (!currentCar.gallery) currentCar.gallery = [];

    window.currentCar = currentCar;

    renderHeader();
    loadUserProfile();

    const sections = ['overview', 'treatments', 'insurance', 'reports', 'fuel', 'accidents', 'sell', 'alerts', 'expenses'];
    try {
        const dashboardContainer = document.getElementById('dashboardContent');

        const fetchPromises = sections.map(view => fetch(`components/dashboard/${view}.html`, { cache: 'no-store' }).then(res => res.text()));

        const htmlParts = await Promise.all(fetchPromises);

        dashboardContainer.innerHTML = htmlParts.join('\n');
    } catch (err) {
        console.error('Failed to load dashboard views:', err); alert('Error Loading Dashboard: ' + err.message);
        return;
    }

    loadOverview();
    loadTreatments();
    loadInsurance();
    loadReports();
    loadFuel();
    loadAccidents();
    if (typeof loadSell === 'function') loadSell();

    generateQR();

    const getStartSection = () => {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            if (sections.includes(hash)) return hash;
        }
        return localStorage.getItem('lastDashboardSection') || 'overview';
    };

    const initialSection = getStartSection();
    showSection(initialSection);

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (sections.includes(hash)) {
            showSection(hash);
        }
    });

});

/**
 * מערכת הניווט הפנימית בלוח הבקרה (SPA - Single Page Application). מסתירה את כל המודולים, מציגה את המודול המבוקש לפי המזהה, מעדכנת את שורת הכתובת (Hash), משנה את הכותרת הראשית ומפעילה את פונקציות הטעינה הרלוונטיות של אותו מודול ספציפי.
 * @param {string} sectionId - מזהה המודול שיש להציג (לדוגמה 'overview', 'treatments').
 * @param {HTMLElement} [element] - אלמנט הכפתור שנלחץ בסיידבר לצורך סימון כפעיל (אופציונלי).
 */
function showSection(sectionId, element) {

    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('d-none'));

    const targetEl = document.getElementById(sectionId + '-section');
    if (targetEl) {
        targetEl.classList.remove('d-none');
    } else {
        console.warn(`Section element not found: ${sectionId}-section`);
        return; // Early return to avoid broken state
    }

    if (window.location.hash !== '#' + sectionId) {
        window.history.replaceState(null, null, '#' + sectionId);
    }

    localStorage.setItem('lastDashboardSection', sectionId);

    document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));

    const linkEl = element || document.querySelector(`.db-list-group a[onclick*="'${sectionId}'"]`);
    if (linkEl) {
        linkEl.classList.add('active');
    }

    if (window.innerWidth <= 767) {
        const wrapper = document.getElementById('wrapper');
        if (wrapper) wrapper.classList.remove('toggled');
    }

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

/**
 * פונקציית מעטפת פומבית למעבר בין מודולים, המאפשרת ניווט תכנותי (למשל מלחיצה על התראה בכרטיסיה מסוימת אל עמוד מפורט אחר), תוך סנכרון תפריט הצד (Sidebar) לסטטוס הפעיל הנכון.
 * @param {string} sectionId - מזהה המודול אליו יש לנווט.
 */
window.goToSection = function(sectionId) {
    showSection(sectionId);

    document.querySelectorAll('.list-group-item').forEach(el => {
        const onclick = el.getAttribute('onclick') || '';
        if (onclick.includes(`'${sectionId}'`)) el.classList.add('active');
        else el.classList.remove('active');
    });
}

/**
 * קוראת את נתוני המשתמש המחובר מהאחסון המקומי ומול שרת ה-API (בסנכרון רקע), ומציגה את שמו ותמונת הפרופיל שלו (Avatar) בתפריט הצד. במקרה של חוסר בתמונה, מייצרת דינמית תמונה המבוססת על אותיות שמו באמצעות שירות ui-avatars.
 */
function loadUserProfile() {
    try {
        let userStr = sessionStorage.getItem('loggedInUser');
        if (!userStr && sessionStorage.getItem('userId')) {

            const fallbackUser = {
                id: sessionStorage.getItem('userId'),
                fullName: sessionStorage.getItem('userName') || 'משתמש',
                email: sessionStorage.getItem('userEmail') || ''
            };
            userStr = JSON.stringify(fallbackUser);
            sessionStorage.setItem('loggedInUser', userStr);
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

                            let localUser = JSON.parse(userStr);
                            localUser.fullName = u.FullName;
                            localUser.email = u.Email;
                            localUser.phone = u.Phone;
                            localUser.avatar = u.Avatar;
                            sessionStorage.setItem('loggedInUser', JSON.stringify(localUser));
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

/**
 * מרנדרת את הרכיב העליון (Header) בלוח הבקרה עם פרטי הרכב הנבחר, לרבות שילוב דינמי של יצרן ודגם, התאמת גודל הגופן אופטית למחרוזות ארוכות, והצגת לוגו הרכב.
 */
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

/**
 * מייצרת באופן לוקאלי קוד סריקה (QR Code) בסיסי לקישור הדף הנוכחי, ושותלת אותו בקונטיינר הייעודי בממשק (תלוי בספריית QRCode.js).
 */
function generateQR() {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ''; // Clear prev

    const url = window.location.href;
    new QRCode(qrContainer, {
        text: url,
        width: 128,
        height: 128
    });
}

/**
 * מתודת גיבוי שנועדה להמיר את תכולת עמוד לוח הבקרה כולו (Page Wrapper) למסמך PDF ברזולוציה גבוהה לצורכי הדפסה או ארכיון (תלויה בספריות html2canvas ו-jsPDF).
 */
function exportToPDF() {

    const element = document.getElementById('page-content-wrapper');
    const opt = {
        margin: 0.5,
        filename: `Vehicle_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
}

/**
 * פונקציית עזר גלובלית המקבלת מחרוזת תאריך בפורמט ישראלי (DD/MM/YYYY) או פורמט ISO תקין, וממירה אותו לאובייקט Date תקני של JavaScript.
 * @param {string} dateStr - תאריך כמחרוזת טקסט.
 * @returns {Date|null} - אובייקט תאריך, או null אם המחרוזת ריקה/שגויה.
 */
window.parseDate = function (dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * פונקציית עזר גלובלית להמרת אובייקט Date או מחרוזת תאריך לייצוג מחרוזתי תקין ואחיד בפורמט התצוגה הישראלי הקלאסי (DD/MM/YYYY).
 * @param {Date|string} dateInput - התאריך שיש לפרמט.
 * @returns {string} - מחרוזת התאריך המפורמטת, או כפולה ('--') אם הנתון חסר.
 */
window.formatDate = function (dateInput) {
    if (!dateInput) return '--';
    const d = window.parseDate(dateInput);
    if (!d) return dateInput;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * פונקציית עזר גלובלית המכינה אובייקטי או מחרוזות תאריכים להזרקה תקינה לתוך אלמנט מסוג `<input type="date">` הדורש פורמט ISO מחמיר של YYYY-MM-DD.
 * @param {Date|string} dateInput - התאריך להמרה.
 * @returns {string} - המחרוזת המותאמת לקלט הדפדפן.
 */
window.toInputDate = function (dateInput) {
    if (!dateInput) return '';
    const d = window.parseDate(dateInput);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

/**
 * פונקציית עזר גלובלית הבודקת האם תאריך נתון מסוים הינו תאריך עתידי (או היום הנוכחי) ביחס לשעון המערכת (מנוקה משעות/דקות). משמשת רבות לבדיקת תוקף טסט וביטוח.
 * @param {string} dateStr - תאריך במחרוזת.
 * @returns {boolean} - אמת אם התאריך גדול או שווה להיום.
 */
window.isDateFuture = function (dateStr) {
    const d = window.parseDate(dateStr);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
}

let isSyncing = false;
let pendingSync = false;

/**
 * מתודת הסנכרון והשמירה הגלובלית המרכזית. מעדכנת את אובייקט הרכב בזיכרון המקומי (sessionStorage) ומיד משגרת קריאת POST/PUT אסינכרונית כדי לסנכרן את השינויים לבסיס הנתונים (Azure DB) בשרת. מיישמת מנגנון תור (Queue/Debounce) למניעת מצבי Race Condition בעת רצף לחיצות/עדכונים מהיר.
 * @returns {Promise<void>}
 */
window.saveToLocalStorage = async function () {
    const index = savedCars.findIndex(c => parseInt(c.id) === parseInt(currentCar.id));
    if (index !== -1) {
        savedCars[index] = currentCar;
        sessionStorage.setItem('userCars', JSON.stringify(savedCars));
    }

    if (isSyncing) {
        pendingSync = true;
        return;
    }

    isSyncing = true;
    
    let syncInd = document.getElementById('globalSyncInd');
    if (!syncInd) {
        syncInd = document.createElement('div');
        syncInd.id = 'globalSyncInd';
        syncInd.innerHTML = '<i class="fas fa-cloud-upload-alt me-2"></i> שומר נתונים בענן...';
        syncInd.style.cssText = 'position:fixed;bottom:20px;left:20px;background:#2563eb;color:#fff;padding:10px 20px;border-radius:50px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;font-size:0.9rem;font-weight:600;display:flex;align-items:center;opacity:0;';
        document.body.appendChild(syncInd);
    }
    syncInd.style.opacity = '1';

    do {
        pendingSync = false;
        try {
            const userId = sessionStorage.getItem('userId') || '1';
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
                const errMsg = errData.details || errData.error || 'שגיאת רשת';
                console.error("Azure DB Sync failed:", errMsg);
                if (syncInd) {
                    syncInd.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> שגיאה: ${errMsg.substring(0, 50)}...`;
                    syncInd.style.background = '#dc2626'; // red
                    setTimeout(() => { syncInd.style.opacity = '0'; }, 8000);
                }
            } else {
                console.log("Successfully synced Vehicle Data to Azure DB.");
                if (syncInd) {
                    syncInd.innerHTML = '<i class="fas fa-check-circle me-2"></i> נשמר בהצלחה';
                    syncInd.style.background = '#16a34a'; // green
                    setTimeout(() => { syncInd.style.opacity = '0'; }, 2000);
                }
            }
        } catch (e) {
            console.error("Azure DB Sync failed (network error):", e);
            if (syncInd) {
                syncInd.innerHTML = '<i class="fas fa-wifi me-2"></i> התנתקות מהשרת, הנתונים ישמרו כשהחיבור יחזור';
                syncInd.style.background = '#f59e0b'; // orange
                setTimeout(() => { syncInd.style.opacity = '0'; }, 3000);
            }
        }
    } while (pendingSync);
    
    isSyncing = false;
}

let expensesChartInstance = null;

/**
 * מאתחלת, רושמת ומרנדרת את תרשים ההוצאות הטבעתי (Doughnut Chart) המרכזי באמצעות ספריית Chart.js. אחראית על הגדרת הפלטות הצבעוניות החדשניות (Tailwind-like), האנימציות ועיצוב הטולטיפים המשוכלל להצגת מטבע השקל.
 * @param {number} treatmentCost - סך הוצאות טיפולים.
 * @param {number} insuranceCost - סך הוצאות ביטוח.
 * @param {number} fuelCost - סך הוצאות דלק.
 * @param {number} accidentCost - סך הוצאות תאונות.
 * @param {number} reportCost - סך הוצאות דוחות.
 * @param {number} otherCost - סך הוצאות נוספות/אחרות.
 */
function initExpensesChart(treatmentCost = 0, insuranceCost = 0, fuelCost = 0, accidentCost = 0, reportCost = 0, otherCost = 0) {
    const canvas = document.getElementById('expensesChart');
    if (!canvas) return;

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    const colors = {
        treatments: '#ef4444', // Vivid Red
        insurance: '#10b981',  // Emerald Green
        fuel: '#f59e0b',       // Amber/Yellow
        accidents: '#f97316',  // Bright Orange
        reports: '#3b82f6',    // Vivid Blue
        other: '#8b5cf6'       // Violet/Purple
    };

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    expensesChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['טיפולים ותחזוקה', 'ביטוח ורישוי', 'דלק', 'תאונות ונזקים', 'דוחות וקנסות', 'הוצאות שונות'],
            datasets: [{
                data: [treatmentCost, insuranceCost, fuelCost, accidentCost, reportCost, otherCost],
                backgroundColor: [colors.treatments, colors.insurance, colors.fuel, colors.accidents, colors.reports, colors.other],
                hoverBackgroundColor: [colors.treatments, colors.insurance, colors.fuel, colors.accidents, colors.reports, colors.other],
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

/**
 * אלגוריתם שקלול הציון הכללי המסורתי של האפליקציה בטווח (0-100). מוריד נקודות (קנסות) מהציון על סמך היעדר טסט בתוקף (-15), קילומטראז' חריג ביחס לשנים, והיסטוריה מרובת תאונות בתיק הרכב (-10 לכל תאונה).
 * @param {Object} carData - אובייקט הרכב המכיל את המידע עליו יופעל החישוב.
 * @returns {number} - הציון המחושב לאחר שקלול כלל ההפחתות.
 */
function calculateReliability(carData) {
    let score = 100;

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

    const mileage = parseInt(carData.km);
    if (!isNaN(mileage)) {
        const kmPenalty = Math.floor(mileage / 100000) * 5;
        score -= kmPenalty;
    }

    if (carData.accidents && Array.isArray(carData.accidents)) {
        score -= (carData.accidents.length * 10);
    }
    
    return Math.max(0, score);
}

/**
 * פותחת את מודאל ההגדרות והעריכה של פרטי הרכב הכלליים (יצרן, דגם, שנת ייצור, קילומטראז' גלובלי, צבע, טסט ועוד). מאכלסת טרם הפתיחה את השדות מתוך נתוני הרכב ומכינה אותם לעריכת המשתמש.
 */
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

/**
 * שומרת באופן רשמי ואסינכרוני את פרטי הרכב הכלליים שנערכו במודאל. מבצעת ולידציות מחמירות על שדות קריטיים, מטפלת בהעלאת והחלפת לוגו הרכב, פונה בעת הצורך ל-API חיצוני לתרגום השם מול מאגר הלוגואים, ולאחר מכן משדרת את העדכון העבה (Payload) אל ה-API המרכזי (PUT request).
 * @returns {Promise<void>}
 */
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

            const res = await fetch(`/api/vehicles/${currentCar.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'userid': sessionStorage.getItem('userId') || 1
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('שגיאה בשמירת הנתונים במסד הנתונים.');

            Object.assign(currentCar, payload);
            renderHeader(); 
            if (typeof window.loadOverview === 'function') window.loadOverview();

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

/**
 * מאזין צדדי הממתין לטעינת ה-DOM על מנת להצמיד את אירוע השמירה לכפתור העדכון בחלון עריכת הרכב הכללי.
 */
document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btnSaveVehicleDetails');
    if (btnSave) {
        btnSave.addEventListener('click', saveVehicleDetails);
    }
});

/**
 * מנגנון השלמה אוטומטית (Autocomplete) גלובלי לחיפוש רכבים בתוך מערכת לוח הבקרה הראשי. מחפש בזמן אמת לפי לוחית רישוי או דגם רכב מתוך מערך נתונים כללי, מקפיץ תוצאות ומאפשר בלחיצה ניווט מהיר אל עמוד התוצאות או המעבר המהיר ביניהם.
 * @param {string} inputId - מזהה אלמנט ה-Input לחיפוש.
 * @param {string} listId - מזהה הרשימה (UL/DIV) להצגת ההשלמות.
 * @param {Array} allVehiclesArr - מערך כלל כלי הרכב שעל בסיסם יבוצע החיפוש.
 */
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
