/**
 * @fileoverview frontend/js/dashboard-accidents.js
 * @description מודול המנהל את מערכת הדיווח על תאונות ונזקים (Accidents Dashboard). כולל חישוב מדדי ביצוע (KPI), העלאת תמונות ומסמכים (כולל PDF) מרובים, סריקת רכבים מעורבים צד ג' (דרך API ממשלתי) וסינון מתקדם.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

window.currentAccidentFilter = 'all';
window.currentAccidentSearch = '';

/**
 * מסנן את רשימת התאונות לפי סטטוס (הכל, פתוח, טופל, מעורב צד ג') ומעדכן את הממשק בהתאם.
 * @param {string} type - סוג הסינון המבוקש ('all', 'pending', 'resolved', 'involved').
 */
window.filterAccidents = function(type) {
    window.currentAccidentFilter = type;
    
    document.querySelectorAll('.acc-filter-btn').forEach(btn => {
        if(btn.dataset.filter === type) {
            btn.classList.add('active');
            btn.style.background = '#fff';
            btn.style.color = '#0f172a';
            btn.style.fontWeight = '700';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = 'none';
        }
    });
    
    window.loadAccidents(); // Will re-render using the current filter state
};

/**
 * מפעיל סינון טקסטואלי (חיפוש) על תאונות בהתאם לשורת החיפוש החופשי שמזין המשתמש.
 */
window.filterAccidentsSearch = function() {
    window.currentAccidentSearch = (document.getElementById('accFilterSearch').value || '').toLowerCase();
    window.loadAccidents();
};

/**
 * פונקציית הליבה לטעינת ועיבוד נתוני התאונות של הרכב הנוכחי.
 * הפונקציה מחשבת את מדדי ה-KPI (עלויות, כמות תאונות וכו'), מסדרת את האירועים כרונולוגית (תוך התחשבות בסינון) ומייצרת (מרנדרת) את כרטיסיות התצוגה של ציר הזמן (Timeline).
 */
window.loadAccidents = function () {
    const listContainer = document.getElementById('accidents-list-container');
    const emptyState = document.getElementById('accidents-empty-state');
    const populatedState = document.getElementById('accidents-populated-state');

    if (!listContainer || !emptyState || !populatedState) return;

    listContainer.innerHTML = ''; // Clear container

    listContainer.innerHTML = '<div style="position: absolute; right: 40px; top: 0; bottom: 0; width: 2px; background: #e2e8f0; z-index: 1;"></div>';

    if (!currentCar.accidents) currentCar.accidents = [];

    let totalCost = 0;
    let pendingCount = 0;
    let resolvedCount = 0;
    
    currentCar.accidents.forEach(a => {
        totalCost += Number(a.cost || a.repairCost) || 0;
        if(a.status === 'resolved') resolvedCount++;
        else pendingCount++;
    });

    const kpiPending = document.getElementById('acc-pending-count');
    const kpiResolved = document.getElementById('acc-resolved-count');
    const kpiTotalCost = document.getElementById('acc-total-cost');
    const kpiCountText = document.getElementById('acc-total-count-text');
    const progResolved = document.getElementById('acc-progress-resolved');
    const progPending = document.getElementById('acc-progress-pending');

    if(kpiPending) kpiPending.textContent = pendingCount;
    if(kpiResolved) kpiResolved.textContent = resolvedCount;
    if(kpiTotalCost) kpiTotalCost.textContent = `₪${new Intl.NumberFormat('he-IL').format(totalCost)}`;
    if(kpiCountText) kpiCountText.textContent = `סה"כ ${currentCar.accidents.length} אירועים מדווחים`;
    
    const totalAccidents = pendingCount + resolvedCount;
    if(progResolved && progPending) {
        progResolved.style.width = totalAccidents > 0 ? `${(resolvedCount / totalAccidents) * 100}%` : '0%';
        progPending.style.width = totalAccidents > 0 ? `${(pendingCount / totalAccidents) * 100}%` : '0%';
    }

    const filterContainer = document.getElementById('accidents-filters-container');

    if (currentCar.accidents.length === 0) {
        emptyState.classList.remove('d-none');
        populatedState.classList.add('d-none');
        if (filterContainer) filterContainer.classList.add('d-none');
        return;
    } else {
        emptyState.classList.add('d-none');
        populatedState.classList.remove('d-none');
        if (filterContainer) filterContainer.classList.remove('d-none');
    }

    const tips = [
        "ככלל אצבע: שקול להפעיל ביטוח רק אם הנזק המוערך גבוה ב-50% מההשתתפות העצמית שלך. כך תימנע מעליית פרמיה בשנה הבאה עבור תיקון מינורי.",
        "תיעוד בזמן אמת: צלם את הנזק משלוש זוויות שונות לפחות, וודא שרואים את מספר הרכב הפוגע ברור.",
        "החלפת פרטים: זכור לקחת שם מלא, טלפון, מספר תעודת זהות, מספר רכב ושם חברת ביטוח של צד ג'.",
        "הקפד לדווח לחברת הביטוח סמוך ככל האפשר למועד האירוע, גם אם החלטת שלא לתבוע בסוף."
    ];
    const tipEl = document.getElementById('acc-dynamic-tip');
    if (tipEl && !window.accTipSet) {
        tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];
        window.accTipSet = true;
    }

    const sortedAccidents = [...currentCar.accidents].sort((a, b) => {
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;
        return (window.parseDate(b.date) || 0) - (window.parseDate(a.date) || 0);
    }).filter(acc => {

        const typeMatch = 
            window.currentAccidentFilter === 'all' ||
            (window.currentAccidentFilter === 'pending' && acc.status !== 'resolved') ||
            (window.currentAccidentFilter === 'resolved' && acc.status === 'resolved') ||
            (window.currentAccidentFilter === 'involved' && (acc.involvedVehicles?.length > 0 || acc.involvedVehicle));

        const searchMatch = !window.currentAccidentSearch || 
            (acc.title && acc.title.toLowerCase().includes(window.currentAccidentSearch)) ||
            (acc.description && acc.description.toLowerCase().includes(window.currentAccidentSearch)) ||
            (acc.cost && String(acc.cost).includes(window.currentAccidentSearch)) ||
            (acc.involvedVehicles && acc.involvedVehicles.some(v => v.plate?.includes(window.currentAccidentSearch) || v.title?.toLowerCase().includes(window.currentAccidentSearch)));
            
        return typeMatch && searchMatch;
    });

    if (sortedAccidents.length === 0) {

        listContainer.innerHTML += `
        <div class="text-center py-5" style="width: 100%; position: relative; z-index: 2;">
            <div style="width: 60px; height: 60px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: #94a3b8; font-size: 1.5rem;">
                <i class="fas fa-search"></i>
            </div>
            <h6 style="color: #475569; font-weight: 700;">לא נמצאו תוצאות התואמות לסינון</h6>
            <button class="btn btn-sm mt-3" onclick="document.getElementById('accFilterSearch').value=''; filterAccidents('all');" style="background: white; border: 1px solid #cbd5e1; color: #64748b; font-weight: 600; border-radius: 8px;">נקה סינון</button>
        </div>`;
        return;
    }

    sortedAccidents.forEach(acc => {
        const isResolved = acc.status === 'resolved';

        let involvedHtml = '';
        if (acc.involvedVehicles && acc.involvedVehicles.length > 0) {
            let vhtml = acc.involvedVehicles.map(v => {
                let logoHtml = v.logo ? `<img src="${v.logo}" style="width:36px; height:36px; border-radius:50%; object-fit:contain; background:white; border:1px solid #e2e8f0; padding:2px; margin-left:12px;">` : `<div style="width:36px; height:36px; border-radius:50%; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; margin-left:12px;"><i class="fas fa-car text-slate-400"></i></div>`;
                return `
                <div class="d-flex align-items-center involved-vehicle-row mb-2 flex-wrap gap-3">
                    <div class="d-flex align-items-center">
                        ${logoHtml}
                        <div>
                            <span class="fw-bold d-block" style="color: #1e293b; font-size: 0.9rem;">${v.title || 'רכב לא ידוע'}</span>
                            <span style="color: #64748b; font-size: 0.8rem;">${v.color || '-'} | שנת ${v.year || '-'}</span>
                        </div>
                    </div>
                    <div class="involved-vehicle-plate" style="background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-family: monospace; color: #334155; font-size: 0.85rem;" dir="ltr">
                        ${v.plate} <span class="ms-1 fs-6">🇮🇱</span>
                    </div>
                </div>
            `}).join('');

            involvedHtml = `
            <div style="margin-top: 1.5rem; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; border-right: 4px solid #f43f5e;">
                <div style="font-size: 0.85rem; font-weight: 800; color: #e11d48; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-contract"></i> רכבים מעורבים (צד ג') 
                    <span style="background: #ffe4e6; color: #be123c; border-radius: 20px; padding: 2px 8px; font-size: 0.7rem;">${acc.involvedVehicles.length} רכבים</span>
                </div>
                ${vhtml}
            </div>`;
        } else if (acc.involvedVehicle && acc.involvedVehicle.plate) {

            let logoHtml = acc.involvedVehicle.logo ? `<img src="${acc.involvedVehicle.logo}" style="width:36px; height:36px; border-radius:50%; object-fit:contain; background:white; border:1px solid #e2e8f0; padding:2px; margin-left:12px;">` : `<div style="width:36px; height:36px; border-radius:50%; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; margin-left:12px;"><i class="fas fa-car text-slate-400"></i></div>`;
            involvedHtml = `
            <div style="margin-top: 1.5rem; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; border-right: 4px solid #f43f5e;">
                <div style="font-size: 0.85rem; font-weight: 800; color: #e11d48; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-contract"></i> רכבים מעורבים (צד ג')
                </div>
                <div class="d-flex align-items-center involved-vehicle-row mb-2 flex-wrap gap-3">
                    <div class="d-flex align-items-center">
                        ${logoHtml}
                        <div>
                            <span class="fw-bold d-block" style="color: #1e293b; font-size: 0.9rem;">${acc.involvedVehicle.title || 'רכב לא ידוע'}</span>
                            <span style="color: #64748b; font-size: 0.8rem;">${acc.involvedVehicle.color || '-'} | שנת ${acc.involvedVehicle.year || '-'}</span>
                        </div>
                    </div>
                    <div class="involved-vehicle-plate" style="background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-family: monospace; color: #334155; font-size: 0.85rem;" dir="ltr">
                        ${acc.involvedVehicle.plate} <span class="ms-1 fs-6">🇮🇱</span>
                    </div>
                </div>
            </div>`;
        }

        let imageHtml = '';
        if (acc.images && acc.images.length > 0) {
            let imgsHtml = acc.images.map((img, idx) => {
                const isPdf = img.startsWith('data:application/pdf');
                const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : img;
                const fileType = isPdf ? 'pdf' : 'image';
                return `
                <div style="position: relative; cursor: pointer; transition: transform 0.2s; overflow: hidden; border-radius: 12px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); ${isPdf ? 'background: white;' : ''}" onclick="window.showFilePreview('${img}', '${fileType}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <img src="${displaySrc}" style="height: 70px; width: 70px; object-fit: cover; filter: ${isResolved ? 'grayscale(30%)' : 'none'}; ${isPdf ? 'padding: 5px;' : ''}">
                </div>
            `}).join('');
            imageHtml = `<div class="mt-3 d-flex flex-wrap gap-2">${imgsHtml}</div>`;
        } else if (acc.image) {
            const isPdf = acc.image.startsWith('data:application/pdf');
            const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : acc.image;
            const fileType = isPdf ? 'pdf' : 'image';
            imageHtml = `
            <div class="mt-3 d-flex flex-wrap gap-2">
                <div style="position: relative; cursor: pointer; transition: transform 0.2s; overflow: hidden; border-radius: 12px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); ${isPdf ? 'background: white;' : ''}" onclick="window.showFilePreview('${acc.image}', '${fileType}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <img src="${displaySrc}" style="height: 70px; width: 70px; object-fit: cover; filter: ${isResolved ? 'grayscale(30%)' : 'none'}; ${isPdf ? 'padding: 5px;' : ''}">
                </div>
            </div>`;
        }

        const cardHtml = `
        <div class="accident-timeline-wrapper" style="position: relative; margin-bottom: 2rem; padding-right: 60px; z-index: 2;">
            <!-- Timeline Dot -->
            <div style="position: absolute; right: 28px; top: 20px; width: 24px; height: 24px; border-radius: 50%; background: ${isResolved ? '#10b981' : '#e11d48'}; border: 4px solid #fff; box-shadow: 0 0 0 2px ${isResolved ? '#a7f3d0' : '#fecdd3'}; z-index: 2;"></div>
            
            <div class="accident-timeline-card" style="background: ${isResolved ? '#f8fafc' : '#ffffff'}; border-radius: 16px; border: 1px solid ${isResolved ? '#e2e8f0' : '#e2e8f0'}; padding: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.02); transition: all 0.2s; border-right: 4px solid ${isResolved ? '#94a3b8' : '#e11d48'}; opacity: ${isResolved ? '0.9' : '1'};">
                <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                    <div>
                        <h5 class="fw-bold m-0" style="color: #0f172a; font-size: 1.15rem;">${acc.title}</h5>
                        <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
                            <i class="far fa-calendar-alt me-1"></i> ${window.formatDate(acc.date)} &nbsp;|&nbsp; 
                            <i class="fas fa-coins me-1"></i> ₪${parseInt(acc.cost || acc.repairCost || 0).toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <span style="background: ${isResolved ? '#f1f5f9' : '#fff1f2'}; color: ${isResolved ? '#475569' : '#be123c'}; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${isResolved ? '#cbd5e1' : '#fda4af'};">
                            <i class="fas ${isResolved ? 'fa-check-circle' : 'fa-exclamation-circle'} me-1"></i> ${isResolved ? 'טופל ותוקן' : 'ממתין לטיפול (פתוח)'}
                        </span>
                    </div>
                </div>
                
                <p style="color: #475569; font-size: 0.95rem; line-height: 1.6; margin-top: 1rem; margin-bottom: 0;">${acc.description}</p>
                
                ${involvedHtml}
                ${imageHtml}
                
                <div class="mt-4 pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style="border-top: 1px dashed #cbd5e1;">
                    <button class="btn btn-sm" onclick="toggleAccidentStatus(${acc.id})" style="background: ${isResolved ? '#ffffff' : '#f8fafc'}; color: ${isResolved ? '#64748b' : '#334155'}; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 600;">
                        ${isResolved ? '<i class="fas fa-undo me-1"></i> החזר לפתוח' : '<i class="fas fa-check text-success me-1"></i> סימון שטופל בהצלחה'}
                    </button>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm" onclick="editAccident(${acc.id})" style="background: #eff6ff; color: #3b82f6; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0;" title="ערוך רישום">
                            <i class="fas fa-pen fa-xs"></i>
                        </button>
                        <button class="btn btn-sm" onclick="deleteAccident(${acc.id})" style="background: #fef2f2; color: #ef4444; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0;" title="מחיקה מהתיק">
                            <i class="fas fa-trash fa-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        listContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}

/**
 * פותח את חלון המודאל (Modal) לדיווח על תאונה חדשה ומאפס את כלל השדות, התמונות והרכבים המעורבים הקודמים.
 */
window.openAddAccidentModal = function () {
    document.getElementById('addAccidentForm').reset();
    document.getElementById('accidentId').value = '';
    document.getElementById('accidentModalTitle').innerHTML = '<i class="fas fa-car-crash me-2"></i> דיווח נזק חדש';
    
    const accDateInput = document.getElementById('accDate');
    if(accDateInput) accDateInput.max = new Date().toISOString().split('T')[0];

    document.getElementById('accLocation').value = '';
    if (window.attachAddressAutocomplete) {
        setTimeout(() => window.attachAddressAutocomplete(document.getElementById('accLocation')), 100);
    }

    attachAccidentImageListener();

    clearAccidentImage();

    document.getElementById('accRadioNo').checked = true;
    toggleInvolvedVehicle();

    new bootstrap.Modal(document.getElementById('addAccidentModal')).show();
}

let currentInvolvedVehicles = [];

/**
 * חושף או מסתיר את אזור הזנת הנתונים לרכב מעורב (צד ג') בטופס הדיווח, תוך מחיקת נתונים קודמים במידה ונבחר "לא".
 */
window.toggleInvolvedVehicle = function () {
    const isYes = document.getElementById('accRadioYes').checked;
    const container = document.getElementById('involvedVehicleContainer');

    if (isYes) {
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
        document.getElementById('accInvolvedPlate').value = '';
        document.getElementById('involvedCarDetails').classList.add('d-none');
        currentInvolvedVehicles = [];
        renderInvolvedVehicles();
    }
}

let currentBase64AccidentImages = [];

/**
 * מחבר מאזין לשדה העלאת הקבצים (תמונות ומסמכים). דוחס תמונות בפורמט Base64 לפני שמירתן לצורך חיסכון במקום ואופטימיזציה.
 */
window.attachAccidentImageListener = function () {
    const accImageInput = document.getElementById('accImageInput');
    if (accImageInput) {
        accImageInput.onchange = function (e) {
            const files = e.target.files;
            if (files && files.length > 0) {
                Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        if (typeof window.compressImage === 'function') {
                            window.compressImage(event.target.result, 800, 0.7, function (compressed) {
                                currentBase64AccidentImages.push(compressed);
                                renderAccidentImagesPreview();
                            });
                        } else {
                            currentBase64AccidentImages.push(event.target.result);
                            renderAccidentImagesPreview();
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        };
    }
}

/**
 * מציג תצוגה מקדימה חזותית של התמונות והמסמכים (PDF) שהמשתמש העלה לטופס הדיווח הנוכחי, ומאפשר צפייה או הסרה שלהם.
 */
window.renderAccidentImagesPreview = function () {
    const listContainer = document.getElementById('accImagesList');
    const placeholder = document.getElementById('accImagePlaceholder');
    const previewContainer = document.getElementById('accImagePreviewsContainer');

    if (!listContainer || !placeholder || !previewContainer) return;

    listContainer.innerHTML = '';

    if (currentBase64AccidentImages.length > 0) {
        placeholder.classList.add('d-none');
        previewContainer.classList.remove('d-none');

        currentBase64AccidentImages.forEach((imgSrc, index) => {
            const isPdf = imgSrc.startsWith('data:application/pdf');
            const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : imgSrc;
            const fileType = isPdf ? 'pdf' : 'image';
            const imgHtml = `
            <div class="position-relative d-inline-block" style="cursor: pointer;" onclick="window.showFilePreview('${imgSrc}', '${fileType}')">
                <img src="${displaySrc}" class="img-fluid rounded shadow-sm" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff; ${isPdf ? 'padding:10px; background:white;' : ''}">
                <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="event.stopPropagation(); removeAccidentImage(${index})" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%); z-index: 2;">
                    <i class="fas fa-times" style="font-size: 10px;"></i>
                </button>
                <div class="position-absolute bottom-0 start-50 translate-middle-x w-100 text-center" style="background: rgba(0,0,0,0.5); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
                    <i class="fas fa-eye text-white" style="font-size: 10px; padding: 2px 0;"></i>
                </div>
            </div>`;
            listContainer.insertAdjacentHTML('beforeend', imgHtml);
        });
    } else {
        placeholder.classList.remove('d-none');
        previewContainer.classList.add('d-none');
    }
}

/**
 * מסיר קובץ (תמונה או מסמך) מרשימת ההעלאות המקומית בטרם שמירה.
 * @param {number} index - המיקום הסידורי (אינדקס) של התמונה במערך התמונות המקומי.
 */
window.removeAccidentImage = function (index) {
    currentBase64AccidentImages.splice(index, 1);
    renderAccidentImagesPreview();
}

/**
 * מוחק את כלל התמונות והמסמכים המקומיים מהזיכרון ומאפס את שדה ההעלאה בטופס.
 */
window.clearAccidentImage = function () {
    currentBase64AccidentImages = [];
    const input = document.getElementById('accImageInput');
    if (input) input.value = '';
    renderAccidentImagesPreview();
}

let currentFetchedInvolvedCar = null;

/**
 * מציג (מרנדר) ויזואלית את רשימת הרכבים המעורבים (צד ג') שנבחרו בחלון המודאל, כולל לוגו הרכב ומספר רישוי.
 */
window.renderInvolvedVehicles = function () {
    const container = document.getElementById('selectedInvolvedVehiclesContainer');
    if (!container) return;
    container.innerHTML = '';

    currentInvolvedVehicles.forEach((vehicle, index) => {
        let logoHtml = vehicle.logo ? `<img src="${vehicle.logo}" class="rounded-circle border bg-white ms-2" width="40" height="40" style="object-fit: contain; padding: 2px;">` : '';
        const vHtml = `
        <div class="d-flex align-items-center justify-content-between bg-white p-2 rounded border shadow-sm border-start border-danger border-4">
            <div class="d-flex align-items-center">
                ${logoHtml}
                <div>
                    <span class="fw-bold text-dark d-block fs-7">${vehicle.title}</span>
                    <span class="badge bg-light text-dark border border-secondary shadow-sm px-2 py-1 mt-1" dir="ltr" style="font-size: 0.75rem;">
                        ${vehicle.plate} <span class="ms-1">🇮🇱</span>
                    </span>
                </div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm rounded-circle" onclick="removeInvolvedVehicle(${index})" title="הסר רכב" style="width: 32px; height: 32px; padding: 0;">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
        container.insertAdjacentHTML('beforeend', vHtml);
    });
}

/**
 * מוחק רכב מעורב ספציפי מרשימת הרכבים שנוספו לטופס דיווח התאונה.
 * @param {number} index - האינדקס של הרכב המעורב שיש להסיר.
 */
window.removeInvolvedVehicle = function (index) {
    currentInvolvedVehicles.splice(index, 1);
    renderInvolvedVehicles();
}

/**
 * מצרף רכב מעורב חדש (שפרטיו עובדו ממשאב ממשלתי) לרשימת הרכבים בצד ג' עבור טופס התאונה הנוכחי, תוך מניעת כפילויות.
 */
window.addInvolvedCarToList = function () {
    if (!currentFetchedInvolvedCar) return;

    if (currentInvolvedVehicles.find(v => v.plate === currentFetchedInvolvedCar.plate)) {
        alert("רכב זה כבר נוסף לרשימה");
        return;
    }

    currentInvolvedVehicles.push(currentFetchedInvolvedCar);
    renderInvolvedVehicles();

    document.getElementById('accInvolvedPlate').value = '';
    document.getElementById('involvedCarDetails').classList.add('d-none');
    currentFetchedInvolvedCar = null;
}

/**
 * פונקציה אסינכרונית המתחברת למאגר משרד הרישוי הממשלתי במטרה לשאוב פרטים מדויקים (צבע, מודל, שנה ולוגו) אודות רכב צד ג' על סמך מספר הרישוי שלו.
 * @returns {Promise<void>}
 * @throws {Error} - זורק שגיאה במקרה שהקריאה למאגר החיצוני נכשלת.
 */
window.fetchInvolvedCarDetails = async function () {
    const plate = document.getElementById('accInvolvedPlate').value.trim();
    const btnSearch = document.getElementById('btnFetchInvolved');
    const detailsContainer = document.getElementById('involvedCarDetails');

    if (!plate || plate.length < 5) {
        alert("נא להזין מספר רישוי תקין");
        return;
    }

    if (window.currentCar && (plate === window.currentCar.carNumber || plate === window.currentCar.plate)) {
        alert("לא ניתן להוסיף את הרכב הנוכחי כצד ג'");
        return;
    }

    btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btnSearch.disabled = true;

    currentFetchedInvolvedCar = null;

    try {
        const carResId = '053cea08-09bc-40ec-8f7a-156f0677aff3';
        const carUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${carResId}&q=${plate}`;

        const response = await fetch(carUrl);
        const data = await response.json();

        if (data.success && data.result.records.length > 0) {
            const car = data.result.records[0];
            const hebrewBrand = car.tozeret_nm.split('-')[0].trim();

            const brandOverrides = {
                'לינק אנד קו': 'lynk-and-co'
            };

            let englishBrandLogo = null;
            try {
                let englishBrand = typeof window.getEnglishBrandName === 'function'
                    ? window.getEnglishBrandName(hebrewBrand)
                    : 'default';

                englishBrandLogo = `images/logos/${englishBrand}.png`;
            } catch (e) { console.log('Translate error', e); }

            currentFetchedInvolvedCar = {
                plate: plate,
                title: `${car.tozeret_nm} ${car.degem_nm}`,
                color: car.tzeva_rechev || 'לא צוין צבע',
                year: car.shnat_yitzur || '-',
                logo: englishBrandLogo
            };

            let finalLogoHtml = englishBrandLogo ? `<img src="${englishBrandLogo}" class="rounded-circle border bg-white" width="40" height="40" style="object-fit: contain; padding:2px;">` : `<i class="fas fa-car fs-4"></i>`;

            document.getElementById('involvedCarTitle').textContent = currentFetchedInvolvedCar.title;
            document.getElementById('involvedCarColor').textContent = currentFetchedInvolvedCar.color;
            document.getElementById('involvedCarYear').textContent = currentFetchedInvolvedCar.year;

            const iconWrapper = document.getElementById('involvedCarDetails').querySelector('.icon-lg-wrapper');
            if (iconWrapper) {
                iconWrapper.innerHTML = finalLogoHtml;
            }

            detailsContainer.classList.remove('d-none');
        } else {
            alert("רכב לא נמצא במאגר");
            detailsContainer.classList.add('d-none');
        }
    } catch (e) {
        console.error(e);
        alert("שגיאה בתקשורת מול המאגר");
    } finally {
        btnSearch.innerHTML = '<i class="fas fa-search me-1"></i> חפש';
        btnSearch.disabled = false;
    }
}

/**
 * אוספת את כלל נתוני טופס דיווח התאונה (כולל רכבים מעורבים, תמונות/מסמכים ועלויות), מוודאת תקינות ומוסיפה (או עורכת) את התאונה במאגר המקומי ולאחר מכן מרעננת את התצוגה והאחסון.
 */
window.saveAccident = function () {
    const idField = document.getElementById('accidentId').value;
    const title = document.getElementById('accTitle').value.trim();
    const cost = document.getElementById('accCost').value.trim();
    const dateInput = document.getElementById('accDate').value;
    const desc = document.getElementById('accDescription').value.trim();
    const locationVal = document.getElementById('accLocation').value.trim();

    if (!title || !cost || !dateInput || !desc) {
        alert("נא למלא את כל שדות החובה");
        return;
    }

    const isYes = document.getElementById('accRadioYes').checked;
    let involvedVehiclesToSave = [];

    if (isYes) {
        const plate = document.getElementById('accInvolvedPlate').value.trim();
        const detailsContainer = document.getElementById('involvedCarDetails');

        if (plate && window.currentCar && (plate === window.currentCar.carNumber || plate === window.currentCar.plate)) {
            alert("לא ניתן להוסיף את הרכב הנוכחי כצד ג'");
            return;
        }

        if (plate && !detailsContainer.classList.contains('d-none') && currentFetchedInvolvedCar) {
            if (!currentInvolvedVehicles.find(v => v.plate === currentFetchedInvolvedCar.plate)) {
                currentInvolvedVehicles.push(currentFetchedInvolvedCar);
            }
        } else if (plate && detailsContainer.classList.contains('d-none') && plate.length >= 5) {
            if (!currentInvolvedVehicles.find(v => v.plate === plate)) {
                currentInvolvedVehicles.push({
                    plate: plate,
                    title: 'לא נבדק במאגר',
                    color: '-',
                    year: '-'
                });
            }
        }

        if (currentInvolvedVehicles.length === 0) {
            alert("נא להוסיף רכב מעורב");
            return;
        }

        involvedVehiclesToSave = [...currentInvolvedVehicles];
    }

    const dParts = dateInput.split('-');
    const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

    const newAccident = {
        id: idField ? parseInt(idField) : Date.now(),
        title: title,
        cost: cost,
        repairCost: parseFloat(cost) || 0,      // also stored as repairCost for DB sync compatibility
        date: formattedDate,
        location: locationVal,
        description: desc,
        images: currentBase64AccidentImages,
        involvedVehicles: involvedVehiclesToSave,
        thirdPartyInvolved: involvedVehiclesToSave.length > 0,
        isHandled: idField ? (currentCar.accidents.find(a => a.id == idField)?.isHandled || false) : false,
        status: idField ? (currentCar.accidents.find(a => a.id == idField)?.status || 'unresolved') : 'unresolved'
    };

    if (!currentCar.accidents) currentCar.accidents = [];

    if (idField) {

        const index = currentCar.accidents.findIndex(a => a.id == idField);
        if (index !== -1) {
            currentCar.accidents[index] = newAccident;
        }
    } else {

        currentCar.accidents.push(newAccident);
    }

    saveToLocalStorage();
    loadAccidents();

    if (typeof loadOverview === 'function') loadOverview();

    const addModal = bootstrap.Modal.getInstance(document.getElementById('addAccidentModal'));
    if (addModal) addModal.hide();
}

/**
 * מוחק רישום תאונה לצמיתות מהמאגר של הרכב לאחר קבלת אישור מפורש מהמשתמש.
 * @param {number|string} id - מזהה (ID) התאונה הייחודי.
 */
window.deleteAccident = function (id) {
    if (confirm("האם למחוק דיווח זה? הנתונים לא ניתנים לשחזור.")) {
        currentCar.accidents = currentCar.accidents.filter(a => a.id !== id);
        saveToLocalStorage();
        loadAccidents();
        if (typeof loadOverview === 'function') loadOverview();
    }
}

/**
 * פותח את המודאל לעריכת תאונה קיימת, ומאכלס אוטומטית את כל השדות הקיימים (תמונות, עלויות, טקסט ורכבים מעורבים) בנתוני המקור לצורך ביצוע שינויים.
 * @param {number|string} id - מזהה (ID) התאונה לעריכה.
 */
window.editAccident = function (id) {
    const acc = currentCar.accidents.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('accidentId').value = acc.id;
    document.getElementById('accidentModalTitle').innerHTML = '<i class="fas fa-edit me-2"></i> עריכת דיווח קיים';
    document.getElementById('accTitle').value = acc.title;
    document.getElementById('accCost').value = acc.cost;
    document.getElementById('accDescription').value = acc.description;
    document.getElementById('accLocation').value = acc.location || '';

    if (window.attachAddressAutocomplete) {
        setTimeout(() => window.attachAddressAutocomplete(document.getElementById('accLocation')), 100);
    }

    const accDateInput = document.getElementById('accDate');
    if(accDateInput) accDateInput.max = new Date().toISOString().split('T')[0];

    if (acc.date) {
        const parts = acc.date.split('/');
        if (parts.length === 3) {
            document.getElementById('accDate').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    if (acc.images && acc.images.length > 0) {
        currentBase64AccidentImages = [...acc.images];
    } else if (acc.image) {
        currentBase64AccidentImages = [acc.image];
    } else {
        clearAccidentImage();
    }

    renderAccidentImagesPreview();

    if (acc.involvedVehicles && acc.involvedVehicles.length > 0) {
        document.getElementById('accRadioYes').checked = true;

        currentInvolvedVehicles = [...acc.involvedVehicles];
        toggleInvolvedVehicle();
        renderInvolvedVehicles(); // Ensure the list is rendered
    } else if (acc.involvedVehicle) {
        document.getElementById('accRadioYes').checked = true;

        currentInvolvedVehicles = [acc.involvedVehicle];
        toggleInvolvedVehicle();
        renderInvolvedVehicles(); // Ensure the list is rendered
    } else {
        document.getElementById('accRadioNo').checked = true;
        toggleInvolvedVehicle();
    }

    new bootstrap.Modal(document.getElementById('addAccidentModal')).show();
}

/**
 * משנה את הסטטוס של תאונה מסוימת ממצב פתוח ('unresolved') למצב סגור/טופל ('resolved') ולהפך, ומרענן את ממשק המשתמש והמדדים (KPI).
 * @param {number|string} id - מזהה (ID) התאונה שאת הסטטוס שלה יש לשנות.
 */
window.toggleAccidentStatus = function (id) {
    const acc = currentCar.accidents.find(a => a.id === id);
    if (acc) {
        acc.status = acc.status === 'resolved' ? 'unresolved' : 'resolved';
        acc.isHandled = (acc.status === 'resolved');
        saveToLocalStorage();
        loadAccidents();
        if (typeof loadOverview === 'function') loadOverview();
        if (typeof loadExpenses === 'function') loadExpenses();
    }
}

/**
 * מציג תמונה מוגדלת (תצוגה מקדימה מלאה) או קובץ המקושרים לאירוע התאונה בחלון מודאל רחב.
 * @param {number|string} id - מזהה התאונה שאליה משויכת התמונה.
 * @param {number} [imageIndex=0] - מיקום התמונה במערך התמונות המצורפות של התאונה.
 */
window.viewAccidentImage = function (id, imageIndex = 0) {
    const acc = currentCar.accidents.find(a => a.id == id);
    if (!acc) return;

    let targetImage = null;

    if (acc.images && acc.images.length > imageIndex) {
        targetImage = acc.images[imageIndex];
    } else if (acc.image) {
        targetImage = acc.image; // backwards compat
    }

    if (targetImage) {
        document.getElementById('accidentImageModalPreview').src = targetImage;
        new bootstrap.Modal(document.getElementById('accidentImageModal')).show();
    }
}
