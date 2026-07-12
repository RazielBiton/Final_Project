/**
 * @fileoverview frontend/js/dashboard-treatments.js
 * @description מודול המנהל את מערך היסטוריית הטיפולים ותחזוקת הרכב. מודול זה מכיל לוגיקה ענפה המשלבת העלאת קבלות וחשבוניות (כולל דחיסה ומניעת עומס אחסון), לצד יכולות בחירת מוסך חכמות המבוססות על שירותי מיקום, Google Places API ומפות интеראקטיביות (Map Picker).
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * נטענת בעת פתיחת מסך הטיפולים והתחזוקה. מושכת ממאגר הנתונים את היסטוריית הטיפולים, מסדרת אותם בטבלה, מסמנת טיפולים ללא קבלות/חשבוניות, ומחשבת באופן רוחבי את כמות הטיפולים הכוללת והעלות הכספית המצטברת.
 */
window.loadTreatments = function () {
    if (!window.currentCar) {
        const stored = localStorage.getItem('currentCar');
        if (stored) window.currentCar = JSON.parse(stored);
    }
    if (!window.currentCar) return;

    const tbody = document.getElementById('treatmentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    const tDateElem = document.getElementById('tDate');
    const editTDateElem = document.getElementById('editTDate');
    if (tDateElem) tDateElem.setAttribute('max', today);
    if (editTDateElem) editTDateElem.setAttribute('max', today);

    if (!currentCar.treatments) currentCar.treatments = [];

    const statTreatments = document.getElementById('stat-total-treatments');
    if (statTreatments) statTreatments.textContent = currentCar.treatments.length;

    const totalCost = currentCar.treatments.reduce((acc, t) => acc + (parseInt(t.cost) || 0), 0);
    const statCosts = document.getElementById('stat-total-cost');
    if (statCosts) statCosts.textContent = totalCost.toLocaleString() + ' ₪';

    currentCar.treatments.forEach(t => {
        const tr = document.createElement('tr');

        if (!t.invoice) {
            tr.style.backgroundColor = '#fdeaea'; // light red background
        }

        let invoiceHtml = '<span class="text-muted">-</span>';
        if (t.invoice) {
            invoiceHtml = `<button class="btn btn-sm btn-link" onclick="window.viewInvoice('${t.id}')"><i class="fas fa-file-image"></i> צפה</button>`;
        }

        const kmVal = parseInt(t.km) || 0;
        const costVal = parseInt(t.cost) || 0;

        tr.innerHTML = `
            <td data-label="תאריך">${window.formatDate(t.date)}</td>
            <td data-label="סוג טיפול">${t.type || '-'}</td>
            <td data-label="מוסך">${t.garage || '-'}</td>
            <td data-label="ק&quot;מ">${kmVal.toLocaleString()}</td>
            <td data-label="חשבונית">${invoiceHtml}</td>
            <td data-label="מחיר">${costVal.toLocaleString()} ₪</td>
            <td data-label="פעולות">
                <button class="btn btn-sm btn-outline-primary" style="margin-left: 5px;" onclick="window.openEditTreatmentModal(${t.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTreatment(${t.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

}

/**
 * קולטת מהטופס את נתוני הטיפול החדש (תאריך, סוג, מוסך, ק"מ, עלות ומסמך מצורף), מבצעת בדיקות תקינות לשדות חובה, ושומרת אותם לתוך מאגר הנתונים. מעדכנת בנוסף את מד הקילומטראז' המרכזי של הרכב אם הטיפול עדכני יותר.
 */
window.saveTreatment = function () {
    const tName = document.getElementById('tName').value;
    const tDate = document.getElementById('tDate').value;
    const tGarage = document.getElementById('tGarage').value;
    const tKm = document.getElementById('tKm').value;
    const tCost = document.getElementById('tCost').value;

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    const finishSave = (base64Invoice) => {
        const newTreatment = {
            id: Date.now(),
            type: tName,
            date: tDate,
            garage: tGarage,
            km: parseInt(tKm),
            cost: parseInt(tCost),
            invoice: base64Invoice || null
        };

        if (!currentCar.treatments) {
            currentCar.treatments = [];
        }

        const parsedKm = parseInt(tKm);
        const currentKm = parseInt(currentCar.km) || 0;
        if (parsedKm > currentKm) {
            currentCar.km = parsedKm;

            const headerKmElem = document.getElementById('vehicleKm');
            if (headerKmElem) headerKmElem.textContent = parsedKm.toLocaleString();
        }

        currentCar.treatments.push(newTreatment);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview(); // Update expenses

        const addModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addTreatmentModal'));
        if (addModal) addModal.hide();
        document.getElementById('addTreatmentForm').reset();
    };

    finishSave(currentBase64TreatmentInvoice || null);
}

/**
 * מסירה רשומת טיפול ספציפית ממאגר הנתונים ומעדכנת את התצוגה ואת סך ההוצאות בהתאם. דורשת אישור משתמש (Confirm) בטרם ביצוע הפעולה.
 * @param {number|string} id - מזהה הטיפול המיועד למחיקה.
 */
window.deleteTreatment = function (id) {
    if (confirm('האם למחוק טיפול זה?')) {
        currentCar.treatments = currentCar.treatments.filter(t => t.id !== id);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();
    }
}

/**
 * שולפת את המסמך/חשבונית המקושרת לטיפול מסוים ומציגה אותו בתצוגה מקדימה רחבה (מודאל), תוך התאמה אוטומטית לסוג הקובץ (PDF או תמונה).
 * @param {number|string} tId - מזהה הטיפול שמכיל את החשבונית.
 */
window.viewInvoice = function (tId) {
    const t = currentCar.treatments.find(x => x.id == tId);
    if (t && t.invoice) {
        if (typeof window.showFilePreview === 'function') {
            window.showFilePreview(t.invoice, t.invoice.startsWith('data:application/pdf') ? 'pdf' : 'image');
        }
    }
}

/**
 * פותחת חלון מודאל לעריכת טיפול קיים ומאכלסת את השדות בנתוניו המקוריים, כולל טיפול בתצוגת החשבונית או התמונה שהועלתה אליו בעבר.
 * @param {number|string} tId - מזהה הטיפול שאותו רוצים לערוך.
 */
window.openEditTreatmentModal = function (tId) {
    const t = currentCar.treatments.find(x => x.id === tId);
    if (!t) return;

    document.getElementById('editTId').value = t.id;
    document.getElementById('editTName').value = t.type;
    document.getElementById('editTDate').value = window.toInputDate(t.date);
    document.getElementById('editTGarage').value = t.garage;
    document.getElementById('editTKm').value = t.km;
    document.getElementById('editTCost').value = t.cost;

    document.getElementById('editTInvoice').value = "";
    if (t.invoice) {
        currentBase64TreatmentInvoice = t.invoice;
        currentTreatmentInvoiceType = t.invoice.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
    } else {
        currentBase64TreatmentInvoice = null;
        currentTreatmentInvoiceType = null;
    }
    if (typeof renderEditTreatmentInvoicePreview === 'function') renderEditTreatmentInvoicePreview();

    new bootstrap.Modal(document.getElementById('editTreatmentModal')).show();
}

/**
 * שומרת את השינויים שבוצעו בחלון העריכה. מחליפה את פרטי הטיפול המקוריים בנתונים החדשים, מתמודדת עם המרה אסינכרונית ודחיסה של חשבונית חדשה אם הועלתה, ולבסוף מרעננת את התצוגות הרלוונטיות בממשק.
 */
window.updateTreatment = function () {
    const tId = parseInt(document.getElementById('editTId').value);
    const tName = document.getElementById('editTName').value;
    const tDate = document.getElementById('editTDate').value;
    const tGarage = document.getElementById('editTGarage').value;
    const tKm = document.getElementById('editTKm').value;
    const tCost = document.getElementById('editTCost').value;
    const tFile = document.getElementById('editTInvoice').files[0];

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    const tIndex = currentCar.treatments.findIndex(x => x.id === tId);
    if (tIndex === -1) return;

    const finishUpdate = (base64Invoice) => {
        currentCar.treatments[tIndex].type = tName;
        currentCar.treatments[tIndex].date = tDate;
        currentCar.treatments[tIndex].garage = tGarage;
        currentCar.treatments[tIndex].km = parseInt(tKm);
        currentCar.treatments[tIndex].cost = parseInt(tCost);

        if (base64Invoice) {
            currentCar.treatments[tIndex].invoice = base64Invoice;
        } else if (!currentBase64TreatmentInvoice) {
            delete currentCar.treatments[tIndex].invoice;
        }

        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();

        const editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editTreatmentModal'));
        if (editModal) editModal.hide();
        document.getElementById('editTreatmentForm').reset();
    };

    if (tFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (typeof compressImage === 'function') {
                window.compressImage(e.target.result, 800, 0.7, finishUpdate);
            } else {
                finishUpdate(e.target.result); // Fallback
            }
        };
        reader.readAsDataURL(tFile);
    } else {
        finishUpdate(null);
    }
}

let _cachedUserLocation = null; // Cache last known precise location

/**
 * פונקציית שירות הפונה לרכיב ה-Geolocation של הדפדפן להשגת מיקום מדויק ככל האפשר של המשתמש. מפעילה האזנה (Watch) לזמן מוגבל כדי להגיע לרמת דיוק טובה מ-50 מטר (שימושי במיוחד בעת הזנת מוסך בזמן אמת).
 * @param {Function} onSuccess - פונקציית Callback המופעלת ברגע שמתקבל מיקום מדויק.
 * @param {Function} onError - פונקציית Callback המופעלת במקרה של שגיאה או דחיית הרשאות מיקום.
 */
function getPreciseLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
        onError && onError(new Error('no geolocation'));
        return;
    }
    let settled = false;
    let watchId = null;

    const fallbackTimer = setTimeout(() => {
        if (!settled) {
            settled = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            onError && onError(new Error('timeout'));
        }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const accuracy = pos.coords.accuracy; // meters
            _cachedUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };

            if (!settled && accuracy <= 50) {
                settled = true;
                clearTimeout(fallbackTimer);
                navigator.geolocation.clearWatch(watchId);
                onSuccess(pos.coords);
            }
        },
        (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(fallbackTimer);
                onError && onError(err);
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setTimeout(() => {
        if (!settled && _cachedUserLocation) {
            settled = true;
            clearTimeout(fallbackTimer);
            navigator.geolocation.clearWatch(watchId);
            onSuccess({ latitude: _cachedUserLocation.lat, longitude: _cachedUserLocation.lng, accuracy: 999 });
        }
    }, 5000);
}

/**
 * כלי חילוץ מתקדם לשירות המפות של Nominatim. לעיתים שירות המפות מחזיר מספר בית מנותק או בלתי צפוי. פונקציה זו מחלצת את מספר הבית ומתאימה אותו לפורמט הכתובות המקובל בישראל (לדוגמה "14א").
 * @param {Object} addr - אובייקט הכתובת המוחזר משירות הגיאוקודינג.
 * @param {string} displayName - שם התצוגה המלא שהתקבל מהשירות.
 * @returns {string} - מספר הבית המחולץ (או מחרוזת ריקה אם לא נמצא).
 */
function extractHouseNumber(addr, displayName) {
    if (addr && addr.house_number) return addr.house_number;
    if (displayName) {
        const firstPart = displayName.split(',')[0].trim();

        if (/^\d+[א-ת]?$/.test(firstPart)) return firstPart;
    }
    return '';
}

/**
 * פונה ל-API החינמי של Nominatim לצורך הפיכת נקודת ציון (רוחב ואורך) לכתובת רחוב קריאה בעברית (Reverse Geocoding). משתמשת בהיגיון מובנה לחילוץ עיר, רחוב ומספר בית.
 * @param {number} lat - קו הרוחב (Latitude).
 * @param {number} lon - קו האורך (Longitude).
 * @returns {Promise<string|null>} - מחרוזת הכתובת בעברית, או Null אם נכשל.
 * @throws {Error} זורקת שגיאה במקרה של כשל תקשורת.
 */
async function reverseGeocode(lat, lon) {
    const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
    );
    if (!res.ok) throw new Error('Nominatim failed');
    const data = await res.json();
    if (data && data.address) {
        const houseNumber = extractHouseNumber(data.address, data.display_name);
        const street = data.address.road || data.address.pedestrian || data.address.footway || '';
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
        let parts = [];
        if (street) parts.push(houseNumber ? `${street} ${houseNumber}` : street);
        if (city) parts.push(city);
        if (parts.length > 0) return parts.join(', ');
        if (data.display_name) return data.display_name.split(',').slice(0, 2).join(', ');
    }
    return null;
}

/**
 * פונקציית כפתור ה-"מצא מיקום נוכחי". מפעילה את מנגנון איתור המיקום, דוגמת נקודת ציון, ממירה אותה לכתובת פיזית (Reverse Geocode) ומזריקה את הכתובת ישירות לתוך שדה הזנת המוסך.
 * @param {string} inputId - מזהה אלמנט שדה ההזנה (Input ID) שאליו יש להזין את הכתובת.
 */
window.fetchCurrentLocation = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (!navigator.geolocation) {
        alert('הדפדפן שלך אינו תומך באיתור מיקום');
        return;
    }

    input.placeholder = 'מאתר מיקום מדויק...';
    input.value = '';
    
    getPreciseLocation(async (coords) => {
        const lat = coords.latitude;
        const lon = coords.longitude;
        try {
            const address = await reverseGeocode(lat, lon);
            input.value = address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        } catch(e) {
            console.error(e);
            input.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
        input.placeholder = "לדוג': מוסך העמק";
    }, (err) => {
        console.error(err);
        alert('שגיאה בקבלת המיקום. אנא ודא ששירותי המיקום פועלים.');
        input.placeholder = "לדוג': מוסך העמק";
    });
};

let _autocompleteDebounce = null;

/**
 * בונה ומגדירה (DOM Manipulation) את רשימת ההשלמה האוטומטית (Dropdown) מתחת לשדה הכתובת (מוסך) הנתון. משתמשת בעיצוב קבוע מראש ומטפלת באירועי סגירה (לחיצה בחוץ).
 * @param {HTMLElement} inputEl - אלמנט שדה הקלט עליו מופעלת ההשלמה.
 * @returns {HTMLElement} - אלמנט ה-Dropdown שנוצר.
 */
function buildAutocompleteDropdown(inputEl) {

    let dropdown = inputEl._acDropdown;
    if (!dropdown) {

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative; display:block;';
        inputEl.parentElement.insertBefore(wrapper, inputEl);
        wrapper.appendChild(inputEl);

        dropdown = document.createElement('div');
        dropdown.style.cssText = [
            'position:absolute',
            'top:100%',
            'left:0',
            'right:0',
            'z-index:9999',
            'background:#fff',
            'border:1px solid #d1d5db',
            'border-radius:10px',
            'box-shadow:0 8px 24px rgba(0,0,0,0.15)',
            'max-height:220px',
            'overflow-y:auto',
            'margin-top:3px',
            'display:none'
        ].join(';');
        wrapper.appendChild(dropdown);
        inputEl._acDropdown = dropdown;

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
    return dropdown;
}

/**
 * מרנדרת אלמנטים אל תוך תפריט ההשלמה האוטומטית על בסיס רשימת כתובות שהתקבלו. מספקת האזנה ללחיצת עכבר (Mouse Events) כדי לבחור את הכתובת הרצויה לתוך שדה הטקסט.
 * @param {string[]} labels - מערך מחרוזות של כתובות מועמדות.
 * @param {HTMLElement} dropdown - אלמנט התפריט הנגלל (הקונטיינר).
 * @param {HTMLElement} inputEl - שדה הקלט אליו תועבר התוצאה הנבחרת.
 */
function showDropdownItems(labels, dropdown, inputEl) {
    dropdown.innerHTML = '';
    if (!labels || labels.length === 0) { dropdown.style.display = 'none'; return; }
    labels.slice(0, 7).forEach(label => {
        const item = document.createElement('div');
        item.textContent = label;
        item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:0.92rem;border-bottom:1px solid #f1f5f9;direction:rtl;text-align:right;background:#fff;';
        item.addEventListener('mouseenter', () => item.style.background = '#f0f9ff');
        item.addEventListener('mouseleave', () => item.style.background = '#fff');
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputEl.value = label;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
}

/**
 * מנוע החיפוש המשני (Fallback) להשלמת כתובות, הפונה ל-Nominatim של OSM במידה ושירות גוגל אינו זמין. מבצע תרגומים למבנה החיפוש כדי להתמודד עם הפורמט הישראלי של "שם רחוב" ולאחריו "מספר בית".
 * @param {string} query - מחרוזת החיפוש שהוזנה על ידי המשתמש.
 * @param {HTMLElement} dropdown - תפריט התצוגה המקדימה לתוצאות.
 * @param {HTMLElement} inputEl - שדה הטקסט.
 * @returns {Promise<void>}
 */
async function fetchNominatimSuggestions(query, dropdown, inputEl) {

    const numberMatch = query.match(/^(.+?)\s+(\d+[\u05d0-\u05ea]?)\s*$/);
    const urls = [];
    let userStreet = '';
    let userNum = '';
    if (numberMatch) {
        userStreet = numberMatch[1].trim();
        userNum = numberMatch[2].trim();

        urls.push(`https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(userNum + ' ' + userStreet)}&countrycodes=il&addressdetails=1&limit=5&accept-language=he`);
    }

    urls.push(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=il&addressdetails=1&limit=5&accept-language=he`);

    const allLabels = [];
    const seen = new Set();
    for (const url of urls) {
        try {
            const res = await fetch(url);
            const results = await res.json();
            if (!results || !results.length) continue;
            results.forEach(r => {
                const addr = r.address || {};
                let houseNumber = extractHouseNumber(addr, r.display_name);
                const street = addr.road || addr.pedestrian || addr.footway || '';
                const city = addr.city || addr.town || addr.village || addr.suburb || '';

                if (!houseNumber && userNum && street && street.includes(userStreet)) {
                    houseNumber = userNum;
                }

                let label;
                if (street) {
                    label = houseNumber ? `${street} ${houseNumber}` : street;
                } else {
                    label = r.display_name.split(',')[0].trim();
                }
                if (city && city !== label) label += `, ${city}`;
                if (!seen.has(label)) { seen.add(label); allLabels.push(label); }
            });
        } catch(e) { console.error('Nominatim error', e); }
    }
    showDropdownItems(allLabels, dropdown, inputEl);
}

/**
 * עוטפת שדה קלט נתון במנגנון ההשלמה האוטומטית (Debounced). מעבירה תחילה את הבקשות אל Google Places API (לרמת דיוק מרבית הכוללת מספרי בתים בישראל), ואם השירות אינו זמין פונה למנועי גיבוי (Nominatim).
 * @param {HTMLElement} inputEl - שדה הקלט לכתובת המוסך.
 */
function attachGarageAutocomplete(inputEl) {
    if (!inputEl || inputEl._acAttached) return;
    inputEl._acAttached = true;
    const dropdown = buildAutocompleteDropdown(inputEl);

    inputEl.addEventListener('input', () => {
        const query = inputEl.value.trim();
        if (query.length < 2) { dropdown.style.display = 'none'; return; }
        clearTimeout(_autocompleteDebounce);
        _autocompleteDebounce = setTimeout(async () => {
            try {

                if (typeof google !== 'undefined' && google.maps && google.maps.places && google.maps.places.AutocompleteService) {
                    const service = new google.maps.places.AutocompleteService();
                    service.getPlacePredictions(
                        {
                            input: query,
                            componentRestrictions: { country: 'il' },
                            types: ['address'],  // address type → includes house numbers
                            language: 'he'
                        },
                        (predictions, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
                                const labels = predictions.map(p =>
                                    p.description
                                        .replace(/, ישראל$/i, '')
                                        .replace(/, Israel$/i, '')
                                        .trim()
                                );
                                showDropdownItems(labels, dropdown, inputEl);
                            } else {

                                fetchNominatimSuggestions(query, dropdown, inputEl);
                            }
                        }
                    );
                } else {

                    await fetchNominatimSuggestions(query, dropdown, inputEl);
                }
            } catch(e) {
                console.error('Autocomplete error', e);
                await fetchNominatimSuggestions(query, dropdown, inputEl);
            }
        }, 300);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdown.style.display = 'none';
    });
    inputEl.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}

/**
 * מפעילה אוטומטית בעת טעינת הדף את מנגנון ההשלמה למוסכים ולכתובות, וכן אחראית על טעינה ראשונית ואסינכרונית של קוד הסקריפט (SDK) הרשמי של Google Maps.
 */
(function initGarageAutocomplete() {

    const tryAttach = () => {
        attachGarageAutocomplete(document.getElementById('tGarage'));
        attachGarageAutocomplete(document.getElementById('editTGarage'));
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryAttach);
    } else {
        tryAttach();
    }

    document.addEventListener('show.bs.modal', () => setTimeout(tryAttach, 100));

    fetch('/api/config/maps')
        .then(res => res.json())
        .then(data => {
            if (data && data.key) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=places,geocoder&language=he`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        })
        .catch(err => console.error('Could not load Maps Config', err));
})();

window.attachAddressAutocomplete = attachGarageAutocomplete;

let mapPickerInstance = null;
let mapPickerMarker = null;
let mapGeocoder = null;
let currentTargetInputId = '';
let currentSelectedAddress = '';

/**
 * פותחת את ממשק "בחירה ממפה" (Map Picker Modal). טוענת את Google Maps (אם זמין), ממקמת סמן על מפת ישראל ומאפשרת למשתמש לגרור אותו (Drag) לצורך בחירה מדויקת של מיקום המוסך או מרכז השירות.
 * @param {string} inputId - מזהה השדה שאליו תועתק הכתובת לאחר אישור המפה.
 */
window.openMapPicker = function(inputId) {
    currentTargetInputId = inputId;
    
    const modalEl = document.getElementById('mapPickerModal');
    if (!modalEl) return;

    const defaultLat = 32.0853, defaultLng = 34.7818;

    function initMapAtPos(lat, lng) {

        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            alert('שירות המפות עדיין בטעינה, אנא נסה שנית בעוד מספר שניות.');
            return;
        }
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        modalEl.addEventListener('shown.bs.modal', function onModalShown() {
            modalEl.removeEventListener('shown.bs.modal', onModalShown);

            if (!mapPickerInstance) {
                mapPickerInstance = new google.maps.Map(document.getElementById('mapPickerCanvas'), {
                    center: { lat, lng },
                    zoom: 16,
                    mapTypeControl: false,
                    streetViewControl: false
                });

                mapPickerMarker = new google.maps.Marker({
                    position: { lat, lng },
                    map: mapPickerInstance,
                    draggable: true,
                    animation: google.maps.Animation.DROP
                });

                mapGeocoder = new google.maps.Geocoder();

                mapPickerMarker.addListener('dragend', () => {
                    updateAddressFromLatLng(mapPickerMarker.getPosition());
                });

                mapPickerInstance.addListener('click', (e) => {
                    mapPickerMarker.setPosition(e.latLng);
                    updateAddressFromLatLng(e.latLng);
                });

                updateAddressFromLatLng({ lat, lng });
            } else {

                const pos = { lat, lng };
                mapPickerInstance.setCenter(pos);
                mapPickerMarker.setPosition(pos);
                google.maps.event.trigger(mapPickerInstance, 'resize');
                updateAddressFromLatLng(pos);
            }
        });
    }

    const addressEl = document.getElementById('mapSelectedAddress');
    if (addressEl) addressEl.textContent = 'מאתר מיקום נוכחי...';

    if (_cachedUserLocation) {
        initMapAtPos(_cachedUserLocation.lat, _cachedUserLocation.lng);
    } else if (navigator.geolocation) {

        let done = false;
        const timer = setTimeout(() => {
            if (!done) { done = true; initMapAtPos(defaultLat, defaultLng); }
        }, 4000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    _cachedUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    initMapAtPos(_cachedUserLocation.lat, _cachedUserLocation.lng);
                }
            },
            () => { if (!done) { done = true; clearTimeout(timer); initMapAtPos(defaultLat, defaultLng); } },
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
        );
    } else {
        initMapAtPos(defaultLat, defaultLng);
    }
};

/**
 * מקבלת ממודול ה-Geocoder של גוגל את רשימת התוצאות, שולפת את הכתובת הספציפית ביותר (ברמת רחוב ומספר) ומנקה ממנה סיומות לא נחוצות כגון ", ישראל".
 * @param {Array} results - מערך התוצאות מ-Google Geocoder.
 * @returns {string|null} - הכתובת הנקייה.
 */
function extractCleanAddress(results) {
    if (!results || results.length === 0) return null;

    return results[0].formatted_address.replace(/, ישראל$/i, '').replace(/, Israel$/i, '').trim();
}

/**
 * ממירה קואורדינטות שהתקבלו מלחיצה או גרירת הסמן על המפה לכדי כתובת עברית מדויקת. מנסה תחילה להשתמש ב-Google Geocoder, ואם נכשל עוברת לגיבוי מבוסס Nominatim. מציגה את התוצאה למשתמש בזמן אמת.
 * @param {Object} latLng - אובייקט נקודת ציון (מכיל lat ו-lng).
 * @returns {Promise<void>}
 */
async function updateAddressFromLatLng(latLng) {
    const addressEl = document.getElementById('mapSelectedAddress');
    if (!addressEl) return;
    
    addressEl.textContent = 'מחפש כתובת...';
    
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;

    if (mapGeocoder || (typeof google !== 'undefined' && google.maps)) {
        if (!mapGeocoder) mapGeocoder = new google.maps.Geocoder();
        
        try {
            await new Promise((resolve) => {
                mapGeocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        currentSelectedAddress = extractCleanAddress(results);
                        addressEl.textContent = currentSelectedAddress;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }).then(async (success) => {
                if (!success) {

                    await fetchAddressFromNominatim(lat, lng, addressEl);
                }
            });
            return;
        } catch(e) {
            console.error('Google Geocoder error:', e);
        }
    }

    await fetchAddressFromNominatim(lat, lng, addressEl);
}

/**
 * מנוע הגיבוי הרשמי לתרגום קואורדינטות לכתובת, המשמש בעת קריסה או חסימה של מנוע המפות של גוגל. מזין את הכתובת המחושבת אל שדה התצוגה המקדימה במודאל המפה.
 * @param {number} lat - קו רוחב.
 * @param {number} lng - קו אורך.
 * @param {HTMLElement} addressEl - אלמנט הטקסט אליו מוזרקת הכתובת ב-DOM.
 * @returns {Promise<void>}
 */
async function fetchAddressFromNominatim(lat, lng, addressEl) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=he`
        );
        if (!res.ok) throw new Error('Nominatim failed');
        const data = await res.json();
        
        if (data && data.address) {
            const houseNumber = extractHouseNumber(data.address, data.display_name);
            const street = data.address.road || data.address.pedestrian || data.address.footway || '';
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
            let parts = [];
            if (street) parts.push(houseNumber ? `${street} ${houseNumber}` : street);
            if (city) parts.push(city);
            currentSelectedAddress = parts.length > 0 ? parts.join(', ') :
                (data.display_name ? data.display_name.split(',').slice(0, 2).join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } else {
            currentSelectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    } catch(e) {
        console.error('Nominatim error:', e);
        currentSelectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    if (addressEl) addressEl.textContent = currentSelectedAddress;
}

/**
 * מאשרת את המיקום שנבחר על גבי המפה האינטראקטיבית. מעתיקה את הכתובת המסונתזת בחזרה אל שדה המוסך המקורי בטופס הטיפול וסוגרת את המודאל.
 */
window.confirmMapSelection = function() {
    if (currentTargetInputId && currentSelectedAddress) {
        const input = document.getElementById(currentTargetInputId);
        if (input) {
            input.value = currentSelectedAddress;
        }
    }
    const modalEl = document.getElementById('mapPickerModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
};

let currentBase64TreatmentInvoice = null;
let currentTreatmentInvoiceType = null;

/**
 * מאזין טעינה גלובלי (DOM Ready) המחבר מאזיני אירועים להעלאת קבצי חשבוניות. אם הקובץ הוא תמונה, מפעיל מנגנון דחיסה יעודי למניעת פיצוץ הזיכרון באחסון המקומי של הדפדפן.
 */
document.addEventListener('DOMContentLoaded', function() {
    const tInvoiceInput = document.getElementById('tInvoice');
    if (tInvoiceInput) {
        tInvoiceInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentTreatmentInvoiceType = file.type;
                const reader = new FileReader();
                reader.onload = function(event) {
                    if (file.type.startsWith('image/') && typeof window.compressImage === 'function') {
                        window.compressImage(event.target.result, 800, 0.7, function(compressed) {
                            currentBase64TreatmentInvoice = compressed;
                            renderTreatmentInvoicePreview();
                        });
                    } else {
                        currentBase64TreatmentInvoice = event.target.result;
                        renderTreatmentInvoicePreview();
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const editTInvoiceInput = document.getElementById('editTInvoice');
    if (editTInvoiceInput) {
        editTInvoiceInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentTreatmentInvoiceType = file.type;
                const reader = new FileReader();
                reader.onload = function(event) {
                    if (file.type.startsWith('image/') && typeof window.compressImage === 'function') {
                        window.compressImage(event.target.result, 800, 0.7, function(compressed) {
                            currentBase64TreatmentInvoice = compressed;
                            renderEditTreatmentInvoicePreview();
                        });
                    } else {
                        currentBase64TreatmentInvoice = event.target.result;
                        renderEditTreatmentInvoicePreview();
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

/**
 * מעדכנת דינמית את ממשק המשתמש כך שיציג צלמית ממוזערת של קבלת הטיפול שזה עתה הועלתה, לצד כפתורי אפשרויות לצפייה מוגדלת או להסרת המסמך מחלון יצירת הטיפול.
 */
window.renderTreatmentInvoicePreview = function() {
    const placeholder = document.getElementById('tInvoicePlaceholder');
    const previewContainer = document.getElementById('tInvoicePreviewContainer');
    const previewArea = document.getElementById('tInvoicePreviewArea');

    if (!placeholder || !previewContainer || !previewArea) return;

    if (currentBase64TreatmentInvoice) {
        placeholder.classList.add('d-none');
        previewContainer.classList.remove('d-none');

        const isPdf = currentTreatmentInvoiceType === 'application/pdf';
        const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : currentBase64TreatmentInvoice;
        const previewType = isPdf ? 'pdf' : 'image';

        previewArea.innerHTML = `
        <div class="position-relative d-inline-block" style="cursor: pointer;" onclick="window.showFilePreview('${currentBase64TreatmentInvoice}', '${previewType}')">
            <img src="${displaySrc}" class="img-fluid rounded shadow-sm bg-white" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff; padding: ${isPdf ? '10px' : '0'}">
            <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="event.stopPropagation(); removeTreatmentInvoice()" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%); z-index: 2;">
                <i class="fas fa-times" style="font-size: 10px;"></i>
            </button>
            <div class="position-absolute bottom-0 start-50 translate-middle-x w-100 text-center" style="background: rgba(0,0,0,0.5); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
                <i class="fas fa-eye text-white" style="font-size: 10px; padding: 2px 0;"></i>
            </div>
        </div>`;
    } else {
        placeholder.classList.remove('d-none');
        previewContainer.classList.add('d-none');
        previewArea.innerHTML = '';
    }
}

/**
 * מעדכנת דינמית את ממשק המשתמש (בדיוק כמו renderTreatmentInvoicePreview) אך באזור עריכת הטיפול הקיים במקום באזור היצירה.
 */
window.renderEditTreatmentInvoicePreview = function() {
    const placeholder = document.getElementById('editTInvoicePlaceholder');
    const previewContainer = document.getElementById('editTInvoicePreviewContainer');
    const previewArea = document.getElementById('editTInvoicePreviewArea');

    if (!placeholder || !previewContainer || !previewArea) return;

    if (currentBase64TreatmentInvoice) {
        placeholder.classList.add('d-none');
        previewContainer.classList.remove('d-none');

        const isPdf = currentTreatmentInvoiceType === 'application/pdf';
        const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : currentBase64TreatmentInvoice;
        const previewType = isPdf ? 'pdf' : 'image';

        previewArea.innerHTML = `
        <div class="position-relative d-inline-block" style="cursor: pointer;" onclick="window.showFilePreview('${currentBase64TreatmentInvoice}', '${previewType}')">
            <img src="${displaySrc}" class="img-fluid rounded shadow-sm bg-white" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff; padding: ${isPdf ? '10px' : '0'}">
            <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="event.stopPropagation(); removeEditTreatmentInvoice()" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%); z-index: 2;">
                <i class="fas fa-times" style="font-size: 10px;"></i>
            </button>
            <div class="position-absolute bottom-0 start-50 translate-middle-x w-100 text-center" style="background: rgba(0,0,0,0.5); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
                <i class="fas fa-eye text-white" style="font-size: 10px; padding: 2px 0;"></i>
            </div>
        </div>`;
    } else {
        placeholder.classList.remove('d-none');
        previewContainer.classList.add('d-none');
        previewArea.innerHTML = '';
    }
}

/**
 * מסירה מהזיכרון הזמני קובץ חשבונית שצורף בטעות לחלון הזנת טיפול חדש טרם השמירה, ומאפסת את אלמנט ה-Input כדי לאפשר העלאה חוזרת נקייה.
 */
window.removeTreatmentInvoice = function() {
    currentBase64TreatmentInvoice = null;
    currentTreatmentInvoiceType = null;
    const input = document.getElementById('tInvoice');
    if (input) input.value = '';
    renderTreatmentInvoicePreview();
}

/**
 * מסירה חשבונית (קיימת או חדשה) מתוך חלון עריכת הטיפול ומרעננת את התצוגה, המחיקה הסופית מתרחשת רק כאשר המשתמש שומר את השינויים.
 */
window.removeEditTreatmentInvoice = function() {
    currentBase64TreatmentInvoice = null;
    currentTreatmentInvoiceType = null;
    const input = document.getElementById('editTInvoice');
    if (input) input.value = '';
    if (typeof renderEditTreatmentInvoicePreview === 'function') renderEditTreatmentInvoicePreview();
}

const originalAddTreatmentModalListener = document.getElementById('addTreatmentModal');
if (originalAddTreatmentModalListener) {
    originalAddTreatmentModalListener.addEventListener('hidden.bs.modal', function () {
        removeTreatmentInvoice();
    });
}
