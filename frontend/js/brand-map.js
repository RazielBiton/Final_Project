// Unified Hebrew to English Brand Name Mapper for Logos
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
