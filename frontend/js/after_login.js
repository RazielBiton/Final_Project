/**
 * @fileoverview frontend/js/after_login.js
 * @description קובץ זה מנהל את מסך צי הרכבים לאחר ההתחברות (Fleet Overview). הוא מטפל בשליפת נתוני הרכבים של המשתמש מהשרת, חישוב ציון האמינות, תצוגת הכרטיסיות (Cards) ואינטראקציות של עריכה ומחיקת רכבים.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/* ── HELPER UTILS ───────────────────────────────────────────────────────────── */
/**
 * פונקציית עזר הבודקת האם תאריך נתון נמצא בעתיד ביחס להיום. משמשת בעיקר לבדיקת תוקף של ביטוחים או טסטים.
 * @param {string} dateStr - מחרוזת המייצגת תאריך.
 * @returns {boolean} - מחזיר אמת (true) אם התאריך בעתיד, אחרת שקר (false).
 */
function isDateFuture(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d > new Date();
}

/**
 * חישוב ציון האמינות של הרכב (Reliability Score) על סמך היסטוריית טיפולים, תוקף ביטוחים, תדלוקים, טסט ומד אוץ.
 * הציון משוקלל לאחוזים (0-100) ומוצג למשתמש כאינדיקציה לרמת התחזוקה של הרכב.
 * @param {Object} car - אובייקט הרכב המכיל את כלל הנתונים (טיפולים, ביטוח, תדלוקים וכו').
 * @returns {number} - ציון האמינות מחושב כמספר שלם בין 0 ל-100.
 */
window.calculateReliability = function (car) {
    let score = 0;

    const isDateFuture = (dateStr) => {
        if (!dateStr || dateStr === 'אין נתונים') return false;
        let d;
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            d = new Date(`${year}-${month}-${day}`);
        } else {
            d = new Date(dateStr);
        }
        return !isNaN(d.getTime()) && d > new Date();
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
/**
 * מאזין לאירוע טעינת ה-DOM. מפעיל את פונקציות האתחול המרכזיות בעת טעינת העמוד: ברכת שלום אישית, טעינת פרופיל משתמש, ושליפת צי הרכבים.
 * @param {Event} event - אירוע טעינת העמוד.
 */
document.addEventListener('DOMContentLoaded', async () => {
    initHeroGreeting();
    loadUserProfile();
    await fetchAndRenderFleet();
});

/* ── CORE LOGIC ────────────────────────────────────────────────────────────── */

/**
 * שליפת רשימת הרכבים של המשתמש מהשרת והצגתם ככרטיסיות ויזואליות במסך.
 * הפונקציה מפרמטת את הנתונים, שומרת עותק מקומי (Session Storage), ומזריקה אלמנטי HTML דינמיים עבור כל רכב.
 * @returns {Promise<void>} - אינו מחזיר ערך מפורש, אך מעדכן את ממשק המשתמש אסינכרונית.
 * @throws {Error} - זורק שגיאה אם השליפה מהשרת נכשלה.
 */
async function fetchAndRenderFleet() {
    const row = document.getElementById('vehicleRow');
    const addWrapper = document.getElementById('addCardWrapper');
    const userId = sessionStorage.getItem('userId');
    
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
            color: car.Color,
            fuelType: car.FuelType,
            testDate: car.TestDate,
            tireFront: car.TireFront,
            tireRear: car.TireRear,
            engineVolume: car.EngineVolume,
            horsePower: car.HorsePower,
            km: car.Km,
            status: car.Status,
            logo: car.Logo || 'images/logos/default.png',
            licensePlate: car.LicensePlate,
            reliabilityScore: car.ReliabilityScore,
            // Nested data
            treatments: car.treatments || [],
            accidents: car.accidents || [],
            fuelLog: car.fuelLog || [],
            insurance: car.insurance || {}
        }));
        
        sessionStorage.setItem('userCars', JSON.stringify(memCars));

        // Clear existing injected cards
        document.querySelectorAll('.premium-card-wrapper:not(#addCardWrapper)').forEach(c => c.remove());

        memCars.forEach(car => {

            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4 col-xl-3 premium-card-wrapper fleet-item';
            col.setAttribute('data-search', `${car.brandHeb} ${car.model} ${car.licensePlate}`.toLowerCase());

            col.innerHTML = `
                <div class="premium-card">

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

    } catch (err) {
        console.error('Error fetching cars:', err);
    } finally {
        const overlay = document.getElementById('fleetLoadingOverlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    }
}

/**
 * אתחול הודעת הברכה האישית בראש העמוד (Hero Greeting).
 * הפונקציה מחשבת את השעה ביום ומציגה ברכה תואמת (בוקר טוב, צהריים טובים וכו') יחד עם שמו הפרטי של המשתמש.
 */
function initHeroGreeting() {
    const greetingEl = document.getElementById('heroGreeting');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let text = "יום טוב";
    if (hour >= 5 && hour < 12) text = "בוקר טוב";
    else if (hour >= 12 && hour < 17) text = "צהריים טובים";
    else if (hour >= 17 && hour < 21) text = "ערב טוב";
    else text = "לילה טוב";

    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    const firstName = (user.fullName || "משתמש").split(' ')[0];

    greetingEl.textContent = `${text}, ${firstName}!`;
}

/* ── INTERACTIONS ───────────────────────────────────────────────────────────── */

/**
 * סינון חיפוש ברשימת הרכבים המוצגת.
 * עובר על כרטיסיות הרכבים ומציג או מסתיר אותן בהתאם לטקסט שהוזן בשדה החיפוש (לפי יצרן, מודל או מספר רישוי).
 */
function filterFleet() {
    const query = document.getElementById('fleetSearch').value.toLowerCase();
    const items = document.querySelectorAll('.fleet-item');
    items.forEach(item => {
        const text = item.getAttribute('data-search');
        item.style.display = text.includes(query) ? 'block' : 'none';
    });
}

/**
 * פתיחה וסגירה של תפריט הפעולות (Kebab Menu) בכרטיסיית רכב ספציפית.
 * סוגר תפריטים פתוחים אחרים לפני פתיחת התפריט הנוכחי.
 * @param {Event} e - אירוע הלחיצה (Click Event).
 * @param {HTMLElement} btn - כפתור התפריט עליו המשתמש לחץ.
 */
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
/**
 * מאזין לאירוע לחיצה (Click) על חלון הדפדפן כדי לסגור תפריטי פעולות פתוחים אם המשתמש לחץ מחוץ להם.
 * @param {Event} event - אירוע הלחיצה.
 */
window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
});

/**
 * הוספת אפקט הטיה תלת-ממדי (3D Tilt Effect) לכרטיסיות הרכב בעת מעבר עכבר (Hover).
 * משפר את חווית המשתמש (UX) ומקנה מראה יוקרתי (Premium Feel).
 * @param {HTMLElement} el - אלמנט ה-HTML של כרטיסיית הרכב שעליו יוחל האפקט.
 */
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

/**
 * מחיקת רכב ספציפי ממאגר הנתונים של המשתמש בשרת.
 * לאחר אישור מהמשתמש, שולח בקשת מחיקה ל-API ומרענן את העמוד בעת הצלחה.
 * @param {number} id - מזהה (ID) הרכב למחיקה.
 * @returns {Promise<void>} - אינו מחזיר ערך מפורש, אך מבצע בקשת רשת אסינכרונית.
 * @throws {Error} - מדפיס שגיאה לקונסול במידה ובקשת המחיקה נכשלת.
 */
async function deleteCar(id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הרכב מהצי?')) return;
    const userId = sessionStorage.getItem('userId');
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
/**
 * פתיחת מודאל (Modal) עריכת פרטי רכב עבור רכב קיים.
 * שולף את נתוני הרכב מהאחסון המקומי ומאכלס את שדות הטופס להמשך עריכה.
 * @param {number} id - מזהה (ID) הרכב לעריכה.
 */
function editCar(id) {
    const cars = JSON.parse(sessionStorage.getItem('userCars')) || [];
    const car = cars.find(c => c.id === id);
    if (!car) return;

    currentEditingCarId = id;
    document.getElementById('editBrand').value = car.brandHeb;
    document.getElementById('editModel').value = car.model;
    document.getElementById('editLogoPreview').src = car.logo || 'images/logos/default.png';

    const modal = new bootstrap.Modal(document.getElementById('editVehicleModal'));
    modal.show();
}

/**
 * שמירת פרטי הרכב המעודכנים (כגון שם יצרן, דגם ולוגו) מול השרת.
 * כולל תהליך העלאת תמונת לוגו מקומית (Base64) או השמה אוטומטית של לוגו באמצעות תרגום שם היצרן לאנגלית.
 * @returns {Promise<void>} - מעדכן אסינכרונית את הרכב ומרענן את העמוד בהצלחה.
 * @throws {Error} - מציג הודעת שגיאה בממשק המשתמש במידה והשמירה נכשלה.
 */
async function saveVehicleDetails() {
    const btn = document.getElementById('btnSaveVehicleDetails');
    const normalText = btn.querySelector('.normal-text');
    const loadingText = btn.querySelector('.loading-text');
    const errorMsg = document.getElementById('editVehicleErrorMsg');
    
    const brand = document.getElementById('editBrand').value.trim();
    const model = document.getElementById('editModel').value.trim();
    const userId = sessionStorage.getItem('userId');

    if (!brand || !model) {
        errorMsg.textContent = 'אנא מלא את כל שדות החובה.';
        errorMsg.classList.remove('d-none');
        return;
    }
    errorMsg.classList.add('d-none');

    btn.disabled = true;
    normalText.classList.add('d-none');
    loadingText.classList.remove('d-none');

    // Get the existing car to preserve other fields
    const cars = JSON.parse(sessionStorage.getItem('userCars')) || [];
    const car = cars.find(c => c.id === currentEditingCarId);
    
    let autoScore = 100;
    if (car && window.calculateReliability) {
        autoScore = window.calculateReliability(car);
    }

    const fileInput = document.getElementById('editLogoInput');
    const file = fileInput.files[0];

    const executeSave = async (logoData) => {
        try {
            const payload = { 
                ...car, // Preserve all existing fields (km, year, testDate, etc)
                brandHeb: brand, 
                model: model, 
                logo: logoData || (car ? car.logo : null),
                status: car ? car.status : 'פעיל',
                reliabilityScore: autoScore
            };
            
            const res = await fetch(`/api/vehicles/${currentEditingCarId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'userid': userId },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('שגיאה בעת שמירת הנתונים.');
            
            location.reload();
        } catch (err) { 
            console.error(err); 
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
    } else if (brand && (!car || brand !== car.brandHeb)) {
        // Auto-assign logo if brand changes
        const hebrewBrand = brand.split('-')[0].trim();
        try {
            const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${hebrewBrand}&langpair=he|en`);
            const data = await transRes.json();
            let englishBrand = data.responseData.translatedText.toLowerCase().trim();
            englishBrand = englishBrand.replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
            executeSave(`images/logos/${englishBrand}.png`);
        } catch(err) {
            executeSave(null);
        }
    } else {
        executeSave(null);
    }
}

/**
 * מאזין טעינת עמוד שמטרתו לאתחל את כפתור השמירה במודאל עריכת הרכב.
 * מקשר בין לחיצה על כפתור השמירה להפעלת הפונקציה saveVehicleDetails.
 * @param {Event} event - אירוע טעינת העמוד.
 */
document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btnSaveVehicleDetails');
    if (btnSave) {
        btnSave.addEventListener('click', saveVehicleDetails);
    }
});

/* ── PROFILE SYNC ───────────────────────────────────────────────────────────── */
/**
 * טעינת פרטי הפרופיל של המשתמש המחובר (שם ותמונת אווטאר) לתפריט הצד (Sidebar).
 * שואב נתונים מה-Session Storage ומשתמש בשירות חיצוני ליצירת אווטאר ברירת מחדל אם אין תמונה.
 */
function loadUserProfile() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    const nameEl = document.getElementById('sidebarUserName');
    const imgEl = document.getElementById('sidebarUserImg');

    if (nameEl) nameEl.textContent = user.fullName || "משתמש";
    if (imgEl) {
        imgEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=0071e3&color=fff&rounded=true`;
    }
}