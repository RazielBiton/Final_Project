/**
 * @fileoverview frontend/js/brand-map.js
 * @description קובץ הגדרות ומילון תרגום למותגי רכב. משמש להמרת שמות יצרני רכב מעברית (כפי שהם מופיעים במאגר משרד הרישוי) לאנגלית, במטרה לטעון בצורה אוטומטית ודינמית את לוגו הרכב המתאים בממשק המשתמש (Cards & Modals).
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */
const BRAND_MAP = {
    'מזדה': 'mazda',
    'הונדה': 'honda',
    'מרצדס': 'mercedes',
    'סובארו': 'subaru',
    'טויוטה': 'toyota',
    'מיצובישי': 'mitsubishi',
    'יונדאי': 'hyundai',
    'קיה': 'kia',
    'ניסאן': 'nissan',
    'סקודה': 'skoda',
    'סיאט': 'seat',
    'פולקסווגן': 'volkswagen',
    'אאודי': 'audi',
    'ב.מ.וו': 'bmw',
    'שברולט': 'chevrolet',
    'פורד': 'ford',
    'רנו': 'renault',
    'פיג\'ו': 'peugeot',
    'סיטרואן': 'citroen',
    'פיאט': 'fiat',
    'אלפא רומיאו': 'alfa-romeo',
    'וולוו': 'volvo',
    'לנד רובר': 'land-rover',
    'מיני': 'mini',
    'לקסוס': 'lexus',
    'אינפיניטי': 'infiniti',
    'סוזוקי': 'suzuki',
    'דאצ\'יה': 'dacia',
    'אופל': 'opel',
    'גיפ': 'jeep',
    'ג\'יפ': 'jeep',
    'דודג\'': 'dodge',
    'קרייזלר': 'chrysler',
    'סאנגיונג': 'ssangyong',
    'איסוזו': 'isuzu',
    'פורשה': 'porsche',
    'יגואר': 'jaguar',
    'מזראטי': 'maserati',
    'קאדילק': 'cadillac',
    'Mg': 'mg',
    'אם.ג\'י': 'mg',
    'צ\'רי': 'chery',
    'BYD': 'byd',
    'בי.וואי.די': 'byd',
    'טסלה': 'tesla',
    'סמארט': 'smart',
    'גילי': 'geely',
    'איוניק': 'hyundai',
    'אקספנג': 'xpeng',
    'אורה': 'ora',
    'הונגצ\'י': 'hongqi',
    'פולסטאר': 'polestar',
    'מקסוס': 'maxus',
    'מנו': 'man',
    'לינק אנד קו': 'lynk-and-co',
    'DS': 'ds',
    'די.אס': 'ds',
    'קוברה': 'cupra',
    'קופרה': 'cupra'
};

/**
 * פונקציית עזר לתרגום שם יצרן הרכב מעברית לאנגלית על בסיס מילון מונחים קבוע מראש (BRAND_MAP).
 * הפונקציה מנקה את הקלט, מחפשת התאמה מלאה, ואם לא נמצאה - מחפשת התאמה חלקית (למשל 'סוזוקי-יפן' תומר ל-'suzuki'). במידה ואין זיהוי כלל, מוחזר ערך ברירת מחדל לטעינת לוגו חלופי.
 * @param {string} hebrewName - שם יצרן הרכב בעברית (לדוגמה: "טויוטה" או "יונדאי").
 * @returns {string} - שם יצרן הרכב באנגלית המשמש כשם קובץ הלוגו (לדוגמה: "toyota"). מחזיר "default" במידה ואין התאמה.
 */
function getEnglishBrandName(hebrewName) {
    if (!hebrewName) return 'default';
    const cleanName = hebrewName.trim();
    if (BRAND_MAP[cleanName]) {
        return BRAND_MAP[cleanName];
    }
    // Fallback dictionary search (partial match)
    for (const [heb, eng] of Object.entries(BRAND_MAP)) {
        if (cleanName.includes(heb)) return eng;
    }
    return 'default'; // Explicitly return default logo if translation is completely missing
}

window.getEnglishBrandName = getEnglishBrandName;
