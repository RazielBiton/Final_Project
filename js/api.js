document.addEventListener('DOMContentLoaded', async () => {
    // 1. חילוץ מספר הרכב מה-URL
    const urlParams = new URLSearchParams(window.location.search);
    const plate = urlParams.get('plate');

    if (!plate) {
        alert("לא הוזן מספר רכב");
        window.location.href = 'search.html';
        return;
    }

    try {
        // 2. קריאה ל-API של פרטי הרכב
        const carResId = '053cea08-09bc-40ec-8f7a-156f0677aff3';
        const carUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${carResId}&q=${plate}`;

        const carResponse = await fetch(carUrl);
        const carData = await carResponse.json();

        if (carData.success && carData.result.records.length > 0) {
            const car = carData.result.records[0];

            // מילוי השדות בדף
            document.getElementById('res_plate').value = car.mispar_rechev;
            document.getElementById('res_make').value = car.tozeret_nm;
            document.getElementById('res_model').value = car.degem_nm;
            document.getElementById('res_year').value = car.shnat_yitzur;
            document.getElementById('res_color').value = car.tzeva_rechev;
            document.getElementById('res_fuel').value = car.sug_delek_nm;

            // --- חישוב תאריך טסט (שנה קדימה מהמבחן האחרון) ---
            document.getElementById('res_test').value = formatNextTestDate(car.mivchan_acharon_dt);

            // --- עיצוב תאריך תוקף רישיון רכב (פורמט DD/MM/YYYY) ---
            document.getElementById('res_license').value = formatDateOnly(car.tokef_dt);

            document.getElementById('res_pollution').value = car.kvutzat_zihum;
            document.getElementById('res_tire_f').value = car.zmig_kidmi;
            document.getElementById('res_tire_r').value = car.zmig_ahori;

            // Try to pre-fill volume and horsepower if available
            if (car.nefah_manoa) document.getElementById('manual_volume').value = car.nefah_manoa;
            // Note: koah_sus is often not in the basic record, but if it is:
            if (car.koah_sus) document.getElementById('manual_hp').value = car.koah_sus;
        } else {
            alert("רכב לא נמצא במאגר");
        }

        // 3. בדיקת תו נכה
        const tagResId = 'c8b9f9c8-4612-4068-934f-d4acd2e3c06e';
        const tagUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${tagResId}&q=${plate}`;

        const tagResponse = await fetch(tagUrl);
        const tagData = await tagResponse.json();
        const hasTag = tagData.result.records.length > 0;

        const tagBox = document.getElementById('disabledTagBox');
        const tagText = document.getElementById('tagText');

        if (hasTag) {
            tagBox.classList.add('has-tag');
            tagText.innerText = "♿ לרכב זה יש תו נכה פעיל במאגר";
        } else {
            tagBox.classList.add('no-tag');
            tagText.innerText = "לרכב זה אין תו נכה במאגר";
        }

    } catch (error) {
        console.error("Error fetching data:", error);
        alert("אירעה שגיאה בחיבור למאגרי הממשלה");
    } finally {
        // הסרת מסך הטעינה
        document.getElementById('loading').style.display = 'none';
    }
});

/**
 * פונקציה להצגת תאריך בפורמט DD/MM/YYYY ללא שינוי שנה
 */
function formatDateOnly(dateStr) {
    if (!dateStr) return "אין נתונים";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * פונקציה שמוסיפה שנה לתאריך המבחן האחרון ומעצבת לפורמט DD/MM/YYYY
 */
function formatNextTestDate(dateStr) {
    if (!dateStr) return "אין נתונים";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    // הוספת שנה אחת לטסט הבא
    date.setFullYear(date.getFullYear() + 1);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * פונקציית תרגום אוטומטית ושמירת הרכב ל-LocalStorage
 */
async function translateAndSave() {
    const addBtn = document.getElementById('addBtn');
    addBtn.innerText = "מעבד...";
    addBtn.disabled = true;

    const makeFull = document.getElementById('res_make').value;
    const model = document.getElementById('res_model').value;
    const year = document.getElementById('res_year').value;

    // חילוץ המילה הראשונה בעברית (למשל "סוזוקי" מתוך "סוזוקי-יפן")
    const hebrewBrand = makeFull.split('-')[0].trim();

    try {
        // Use the unified local brand mapping system
        let englishBrand = typeof window.getEnglishBrandName === 'function'
            ? window.getEnglishBrandName(hebrewBrand)
            : 'default';

        // יצירת אובייקט הרכב החדש
        const newCar = {
            id: Date.now(),
            brandHeb: hebrewBrand,
            model: model,
            year: year,
            logo: `images/logos/${englishBrand}.png`,

            // שדות נוספים שנשמרים כעת
            licensePlate: document.getElementById('res_plate').value,
            testDate: document.getElementById('res_test').value,
            licenseExpiry: document.getElementById('res_license').value,
            color: document.getElementById('res_color').value,
            fuelType: document.getElementById('res_fuel').value,
            pollution: document.getElementById('res_pollution').value,
            tireFront: document.getElementById('res_tire_f').value,
            tireRear: document.getElementById('res_tire_r').value,
            hasDisabledTag: document.getElementById('disabledTagBox').classList.contains('has-tag'),

            // New Fields
            km: parseInt(document.getElementById('res_km').value) || 0,
            engineVolume: document.getElementById('manual_volume').value || '',
            horsePower: document.getElementById('manual_hp').value || '',

            // אתחול מערכים למודולים
            treatments: [],
            accidents: [],
            fuelLog: [],
            reports: []
        };

        // שמירה לתוך רשימת הרכבים הקיימת בזיכרון
        const existingCars = JSON.parse(localStorage.getItem('userCars')) || [];
        existingCars.push(newCar);
        localStorage.setItem('userCars', JSON.stringify(existingCars));

        // מעבר לדף הניהול (after_login.html)
        window.location.href = 'after_login.html';

    } catch (error) {
        console.error("Translation failed", error);
        alert("אירעה שגיאה בעיבוד הנתונים. נסה שוב.");
        addBtn.innerText = "הוסף רכב 🚗";
        addBtn.disabled = false;
    }
}

// חיווט כפתור ההוספה לפונקציה
document.getElementById('addBtn').onclick = translateAndSave;