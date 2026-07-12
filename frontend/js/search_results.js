/**
 * @fileoverview search_results.js
 * @description מנהל את דף תוצאות החיפוש, כולל שליפת נתונים מהשרת, סינון דינמי של רכבים (לפי יצרן, דלק וצבע), והצגת התוצאות בממשק המשתמש.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

let allVehicles = [];     // All vehicles returned from API
let matchedVehicles = []; // Vehicles matching the initial search term
let filterState = {
    brands: new Set(),
    fuels: new Set(),
    colors: new Set()
};

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded). שולף את מונח החיפוש משורת הכתובת (URL), 
 * מציג שלדי טעינה (Skeletons) ראשוניים בממשק, ומתחיל את תהליך משיכת הרכבים מהשרת.
 * 
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Get search query from URL
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q') || '';
    
    const searchInput = document.getElementById('topSearchInput');
    if(q) searchInput.value = q;

    generateSkeletons(10); // Show initial skeletons
    fetchAndFilterVehicles(q);
});

/**
 * מתבצעת בעת שליחת בקשת חיפוש חדשה משורת החיפוש העליונה.
 * קוראת את מונח החיפוש, מציגה חיווי טעינה ומפנה מחדש לדף התוצאות עם הפרמטר המעודכן בכתובת.
 * 
 * @returns {void}
 */
window.searchVehicles = function() {
    const q = document.getElementById('topSearchInput').value;
    document.getElementById('searchSpinner').classList.remove('d-none');
    window.location.href = `search_results.html?q=${encodeURIComponent(q)}`;
};

/**
 * מאפסת את כל אפשרויות הסינון (יצרן, סוג דלק, צבע) שנבחרו על ידי המשתמש.
 * מנקה את התצוגה של תיבות הסימון (Checkboxes) ומעדכנת מחדש את תצוגת התוצאות ללא סינונים.
 * 
 * @returns {void}
 */
window.clearFilters = function() {
    filterState.brands.clear();
    filterState.fuels.clear();
    filterState.colors.clear();
    document.querySelectorAll('.filter-checkbox').forEach(chk => chk.checked = false);
    applyFiltersAndRender();
};

/**
 * מייצרת ומציגה "שלדי טעינה" (Skeletons) כדי לספק חיווי חזותי למשתמש בזמן המתנה לנתונים מהשרת.
 * 
 * @param {number} count - כמות כרטיסי השלד שיש לייצר ולהציג
 * @returns {void}
 */
function generateSkeletons(count) {
    const loader = document.getElementById('skeletonLoader');
    let html = '';
    for(let i=0; i<count; i++) {
        html += `
        <div class="col skeleton-wrapper">
            <div class="skeleton-card shadow-sm border-0 text-center">
                <div class="sk-anim sk-box"></div>
                <div class="sk-anim sk-title"></div>
                <div class="sk-anim sk-title" style="width:40%"></div>
                <div class="sk-anim sk-plate"></div>
                <div class="d-flex justify-content-center gap-2 mt-4">
                    <div class="sk-anim sk-pill"></div>
                    <div class="sk-anim sk-pill"></div>
                </div>
            </div>
        </div>
        `;
    }
    loader.innerHTML = html;
    loader.classList.remove('d-none');
    
    const grid = document.getElementById('resultsGrid');
    if (grid) grid.innerHTML = '';
}

/**
 * מושכת את כלל הרכבים מהשרת, מפעילה פילטר ראשוני בהתאם למונח החיפוש (שאילתה), 
 * ומתחילה את שרשרת הרינדור (הצגת פילטרים ותוצאות). במקרה של שגיאה - מציגה הודעה מתאימה.
 * 
 * @param {string} query - מונח החיפוש (מספר רישוי, יצרן, דגם וכו')
 * @returns {Promise<void>}
 * @throws {Error} - נזרקת שגיאה במקרה של כשלון בתקשורת מול ה-API או בשליפת הנתונים
 */
async function fetchAndFilterVehicles(query) {
    const loader = document.getElementById('skeletonLoader');
    const statWidget = document.getElementById('totalDbCarsTop');

    try {
        const response = await fetch('/api/vehicles/all');
        if (!response.ok) throw new Error("Failed to fetch vehicles");
        allVehicles = await response.json();
        allVehicles = allVehicles || [];

        // Update widgets with total vehicles in DB
        if(statWidget) {
            statWidget.textContent = allVehicles.length.toLocaleString();
        }
        const sidebarStatWidget = document.getElementById('totalDbCarsSidebar');
        if (sidebarStatWidget) {
            sidebarStatWidget.textContent = allVehicles.length.toLocaleString();
        }

        attachAutocomplete('topSearchInput', 'globalAutocompleteList', allVehicles);

        // Perform initial Match logic
        const lowerQ = query.trim().toLowerCase();
        matchedVehicles = allVehicles.filter(v => {
            if(!lowerQ) return true;
            const plate = (v.LicensePlate || '').toLowerCase();
            const brandHeb = (v.BrandHeb || '').toLowerCase();
            const brandEn = (v.Brand || '').toLowerCase();
            const model = (v.Model || '').toLowerCase();

            return plate.includes(lowerQ) || brandHeb.includes(lowerQ) || brandEn.includes(lowerQ) || model.includes(lowerQ);
        });

        extractAvailableFilters();
        renderFilters();

        setTimeout(() => {
            if(loader) loader.classList.add('d-none');
            applyFiltersAndRender();
        }, 600);

    } catch(err) {
        console.error(err);
        if(loader) loader.innerHTML = `<div class="alert alert-danger w-100 mx-auto text-center p-4 border-0 shadow-sm rounded-4 text-danger fw-bold">אירעה שגיאה בטעינת הנתונים שיכולה לנבוע מניתוק מהשרת. נסה לרענן את העמוד.</div>`;
    }
}

let availableBrands = [];
let availableFuels = [];
let availableColors = [];

/**
 * עוברת על כל הרכבים שנמצאו בהתאמה לחיפוש הנוכחי, ומחלצת מתוכם את רשימת היצרנים, 
 * סוגי הדלק והצבעים הזמינים על מנת לבנות את תפריט הסינון הדינמי למשתמש.
 * 
 * @returns {void}
 */
function extractAvailableFilters() {
    const brandsSet = new Set();
    const fuelsSet = new Set();
    const colorsSet = new Set();

    matchedVehicles.forEach(v => {
        if(v.BrandHeb) brandsSet.add(v.BrandHeb);
        if(v.FuelType) fuelsSet.add(v.FuelType);
        if(v.Color) colorsSet.add(v.Color);
    });

    availableBrands = Array.from(brandsSet).sort();
    availableFuels = Array.from(fuelsSet).sort();
    availableColors = Array.from(colorsSet).sort();
}

/**
 * מרנדרת (מייצרת ב-HTML) את תיבות הסימון (Checkboxes) עבור קטגוריות הסינון (יצרנים, סוגי דלק, צבעים).
 * מציגה הודעה מתאימה אם אין אפשרויות סינון באחת הקטגוריות, ומצמידה מאזיני אירועים לשינויים.
 * 
 * @returns {void}
 */
function renderFilters() {
    const renderCheckboxes = (containerId, array, stateSet, filterCatName) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        
        container.innerHTML = '';
        if(array.length === 0) {
            container.innerHTML = '<span class="text-white-50 small px-2 fw-bold">אין אפשרויות לסינון בתוצאות אלו</span>';
            return;
        }

        array.forEach(item => {
            const id = `chk_${filterCatName}_${item.replace(/\s+/g,'_')}`;
            const isChecked = stateSet.has(item) ? 'checked' : '';
            
            const html = `
                <div class="filter-pill">
                    <input class="filter-checkbox" type="checkbox" value="${item}" id="${id}" data-category="${filterCatName}" ${isChecked}>
                    <label for="${id}">${item}</label>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    };

    renderCheckboxes('filter-brands-list', availableBrands, filterState.brands, 'brands');
    renderCheckboxes('filter-fuel-list', availableFuels, filterState.fuels, 'fuels');
    renderCheckboxes('filter-colors-list', availableColors, filterState.colors, 'colors');

    document.querySelectorAll('.filter-checkbox').forEach(chk => {
        chk.addEventListener('change', handleFilterChange);
    });
}

/**
 * מטפלת באירוע שינוי בחירת סינון (סימון או ביטול סימון של Checkbox).
 * מעדכנת את מצב הסינון (filterState) וקוראת לפונקציה המעדכנת את התצוגה.
 * 
 * @param {Event} e - אובייקט האירוע של שינוי ה-Checkbox
 * @returns {void}
 */
function handleFilterChange(e) {
    const cat = e.target.dataset.category;
    const val = e.target.value;
    
    if(e.target.checked) filterState[cat].add(val);
    else filterState[cat].delete(val);

    applyFiltersAndRender();
}

/**
 * מסננת את הרשימה המקורית של תוצאות החיפוש בהתאם למסננים (Filters) שהמשתמש בחר,
 * ומעבירה את הרשימה המסוננת הסופית לפונקציית הרינדור של התצוגה (Grid).
 * 
 * @returns {void}
 */
function applyFiltersAndRender() {
    let results = matchedVehicles.filter(v => {
        const brandMatch = filterState.brands.size === 0 || filterState.brands.has(v.BrandHeb);
        const fuelMatch = filterState.fuels.size === 0 || filterState.fuels.has(v.FuelType);
        const colorMatch = filterState.colors.size === 0 || filterState.colors.has(v.Color);
        return brandMatch && fuelMatch && colorMatch;
    });
    renderGrid(results);
}

/**
 * מייצרת את כרטיסי הרכבים ומציגה אותם ברשת (Grid) בממשק המשתמש. 
 * מנהלת גם את הצגת הודעת "לא נמצאו תוצאות" ואת ספירת התוצאות, 
 * וקובעת את עיצוב הסטטוס ומספר הרישוי.
 * 
 * @param {Array<Object>} vehiclesToRender - מערך של אובייקטי רכבים שיש להציג על המסך
 * @returns {void}
 */
function renderGrid(vehiclesToRender) {
    const grid = document.getElementById('resultsGrid');
    const noResults = document.getElementById('noResultsMsg');
    const countBadge = document.getElementById('resultsCountBadge');

    if(!grid) return;
    grid.innerHTML = '';
    
    const total = vehiclesToRender.length;
    if(countBadge) countBadge.textContent = `${total} תוצאות נמצאו`;

    if(total === 0) {
        if(noResults) noResults.classList.remove('d-none');
        return;
    } else {
        if(noResults) noResults.classList.add('d-none');
    }

    vehiclesToRender.forEach((v, index) => {
        const logoSrc = v.Logo || (typeof brandLogos !== 'undefined' ? (brandLogos[v.BrandHeb] || brandLogos[v.Brand] || 'images/brands/default.png') : 'images/brands/default.png');
        
        let plate = v.LicensePlate || '------';
        if(plate.length === 7) plate = plate.slice(0,2)+'-'+plate.slice(2,5)+'-'+plate.slice(5);
        if(plate.length === 8) plate = plate.slice(0,3)+'-'+plate.slice(3,5)+'-'+plate.slice(5);

        const delay = index * 0.05;
        let statusString = (v.Status || '').trim();
        let cardClassObj = {bg: 'd-none', text: ''}; 
        
        if (statusString) {
            if (statusString === 'פעיל') cardClassObj = {bg: 'bg-success text-white', text: 'פעיל'};
            else cardClassObj = {bg: 'bg-secondary text-white', text: statusString};
        }

        // Layout with BIG logo at the top
        const card = `
        <div class="col fade-in-up" style="animation-delay: ${delay}s">
            <div class="vehicle-card h-100 position-relative" onclick="window.location.href='public_report.html?id=${v.Id}&from=search'">
                
                <!-- Status floating badge -->
                <div class="position-absolute" style="top: 15px; left: 15px; z-index: 10;">
                    <span class="badge ${cardClassObj.bg} rounded-pill px-3 py-1 fw-bold shadow-sm">${cardClassObj.text}</span>
                </div>

                <div class="card-body p-4 text-center d-flex flex-column align-items-center">
                    
                    <div class="card-logo-box">
                        <img src="${logoSrc}" alt="${v.BrandHeb}" onerror="this.src='images/brands/default.png'">
                    </div>

                    <h4 class="fw-bold mb-1 text-dark">${v.BrandHeb} <span class="fw-normal">${v.Model || ''}</span></h4>
                    <p class="text-muted small mb-4 fw-medium text-uppercase">שנת ${v.Year || 'לא ידוע'}</p>
                    
                    <div class="mb-4 w-100">
                        <span class="license-plate-badge shadow-sm w-100">${plate}</span>
                    </div>

                    <div class="d-flex flex-wrap justify-content-center gap-2 mt-auto">
                        <span class="stat-pill"><i class="fas fa-gas-pump text-primary"></i> ${v.FuelType || '-'}</span>
                        <span class="stat-pill"><i class="fas fa-palette text-primary"></i> ${v.Color || '-'}</span>
                    </div>

                </div>
            </div>
        </div>
        `;

        grid.insertAdjacentHTML('beforeend', card);
    });
}

/**
 * מצמידה מנגנון השלמה אוטומטית (Autocomplete) לשורת החיפוש. 
 * מציגה הצעות מתוך מאגר הרכבים תוך כדי הקלדה ומאפשרת למשתמש לבחור תוצאה ישירות מהרשימה.
 * 
 * @param {string} inputId - מזהה (ID) של שדה הקלט (Input) של החיפוש
 * @param {string} listId - מזהה (ID) של אלמנט הרשימה (UL) שבו יוצגו ההצעות
 * @param {Array<Object>} allVehiclesArr - מערך כל הרכבים במערכת, מתוכו יבוצע חיפוש ההשלמות
 * @returns {void}
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
                li.className = 'list-group-item list-group-item-action border-0 border-bottom py-3 d-flex align-items-center gap-3';
                li.style.cursor = 'pointer';
                li.innerHTML = `
                    <div class="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                        <i class="fas fa-car-side"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-dark fs-6">${v.LicensePlate}</div>
                        <div class="text-muted small">${v.BrandHeb || ''} ${v.Model || ''}</div>
                    </div>
                `;
                li.onmousedown = () => {
                    input.value = v.LicensePlate;
                    list.classList.add('d-none');
                    window.searchVehicles();
                };
                list.appendChild(li);
            });
            list.classList.remove('d-none');
        } else {
            list.classList.add('d-none');
        }
    });

    input.addEventListener('blur', () => setTimeout(() => list.classList.add('d-none'), 200));
    input.addEventListener('focus', function() { if(this.value && list.innerHTML !== '') list.classList.remove('d-none'); });
}
