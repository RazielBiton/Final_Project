/**
 * @fileoverview public_report.js
 * @description מנהל את תצוגת דוח הרכב הפומבי (Public Report), המציג מידע מקיף על הרכב כולל נתונים טכניים, היסטוריית טיפולים, תאונות, דוחות, היסטוריית תדלוקים ומדד אמינות, הכל מבוסס על מזהה הרכב ב-URL.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded).
 * שולף את מזהה הרכב (ID) משורת הכתובת, ומבצע קריאת שרת (API) כדי למשוך את הנתונים המלאים מהמסד. 
 * במקרה של הצלחה, קורא לפונקציית הרינדור (renderPublicReport), אחרת מציג הודעת שגיאה בהתאם.
 * 
 * @returns {Promise<void>}
 * @throws {Error} - נזרקת שגיאה במקרה של כשלון בתקשורת מול השרת או במשיכת הנתונים.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id');

    if (!vehicleId) {
        showError('לא נמצא מזהה רכב תקף בקישור.');
        return;
    }

    try {
        // מוסיפים timestamp כדי למנוע שמירה ב-cache של הדפדפן (כך שהשינויים מהמוכר ישתקפו מיידית)
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/vehicles/sync/${vehicleId}?t=${timestamp}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (res.ok) {
            const currentCar = await res.json();
            renderPublicReport(currentCar);
        } else {
            showError('לא מצאנו רכב תואם במערכת שלנו.');
        }
    } catch (err) {
        showError('שגיאת חיבור לשרת המרכזי.');
    }
});

/**
 * מציגה הודעת שגיאה מותאמת אישית במסך הטעינה במקרה של תקלה (כגון רכב שלא נמצא או שגיאת תקשורת).
 * מחליפה את ממשק הטעינה בסמל חזותי והודעת כשל ברורה.
 * 
 * @param {string} msg - הודעת השגיאה שיש להציג למשתמש.
 * @returns {void}
 */
function showError(msg) {
    document.getElementById('loading-screen').innerHTML = `
        <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
        <h4 class="text-dark fw-bold">${msg}</h4>
        <p class="text-muted mt-2">הקישור שנסרק אינו תקין או פג תוקף.</p>
    `;
}

/**
 * פונקציה מרכזית האחראית על עיבוד הנתונים שהתקבלו מהשרת ורינדורם (תצוגתם) בממשק הדו"ח הפומבי.
 * הפונקציה מזינה מידע לתוך כל חלקי הדף: כותרות, פרטים טכניים, סטטיסטיקות, ציר זמן של טיפולים, נתוני ביטוח, דוחות, תדלוקים ותאונות.
 * כמו כן, מנהלת את תהליך העלמת מסך הטעינה והצגת התוכן.
 * 
 * @param {Object} car - אובייקט המכיל את כל נתוני הרכב (פרטים, היסטוריה וכו') כפי שהתקבלו מהמסד.
 * @returns {void}
 */
function renderPublicReport(car) {
    // === קריאת הגדרות שקיפות מהמוכר ===
    const s = car.sellSettings || {};
    const showTreatments = s.showTreatments !== false;
    const showCosts = s.showCosts !== false;
    const showInsurance = s.showInsurance !== false;
    const showAccidents = s.showAccidents !== false;
    const showFuelLogs = s.showFuelLogs !== false;
    const showFines = s.showFines !== false;

    const brand = car.brandHeb || car.brand || 'רכב לא ידוע';
    const logoSrc = car.logo || 'images/logos/default.png';
    const year = car.year || '';

    document.getElementById('pr-logo').innerHTML = `<img src="${logoSrc}" alt="Logo">`;
    document.getElementById('pr-title').textContent = `${brand} ${car.model || ''}`;
    document.getElementById('pr-subtitle').textContent = `מספר רישוי: ${car.licensePlate} | שנת ייצור: ${year} | ${car.color || ''}`;

    document.getElementById('pr-km').textContent = car.km ? car.km.toLocaleString() : '--';

    document.getElementById('pr-test').textContent = formatCleanDate(car.testDate);

    let relScore = calculateLocalReliability(car);
    document.getElementById('pr-reliability').textContent = relScore + '%';
    const relCircle = document.getElementById('pr-rel-circle');
    const relText = document.getElementById('pr-reliability-text');

    let relColor = 'var(--pr-warning)';
    let relLabel = 'ממוצע';

    if (relScore >= 80) {
        relColor = 'var(--pr-success)';
        relLabel = 'מצוין';
    } else if (relScore < 50) {
        relColor = 'var(--pr-danger)';
        relLabel = 'טעון שיפור';
    }

    if (relCircle) {
        relCircle.style.background = `conic-gradient(${relColor} ${relScore}%, var(--pr-border) 0%)`;
    }
    if (relText) {
        relText.textContent = relLabel;
        relText.style.color = relColor;
    }

    // === הסתרת/הצגת השקעה ברכב לפי showCosts ===
    const expensesSection = document.getElementById('pr-section-expenses');
    if (!showCosts) {
        if (expensesSection) expensesSection.style.display = 'none';
    } else {
        let totalExpenses = 0;
        if (car.treatments) car.treatments.forEach(t => { if (t.cost) totalExpenses += parseFloat(t.cost); });
        if (car.insurance) {
            Object.values(car.insurance).forEach(ins => {
                if (ins && ins.cost) totalExpenses += parseFloat(ins.cost);
            });
        }
        document.getElementById('pr-expenses').textContent = '₪' + totalExpenses.toLocaleString();
    }

    document.getElementById('pr-hp').textContent = car.horsePower || '--';
    document.getElementById('pr-engine').textContent = car.engineVolume || '--';
    document.getElementById('pr-tires-f').textContent = car.tireFront || '--';
    document.getElementById('pr-tires-r').textContent = car.tireRear || '--';
    document.getElementById('pr-fuel-type').textContent = car.fuelType || '--';

    const gallery = car.gallery || [];
    const galleryContainer = document.getElementById('publicGalleryContainer');
    const galleryGrid = document.getElementById('publicGalleryGrid');
    if (galleryContainer && galleryGrid && gallery.length > 0) {
        galleryContainer.classList.remove('d-none');
        galleryGrid.innerHTML = '';
        gallery.forEach(imgBase64 => {
            galleryGrid.innerHTML += `
                <img src="${imgBase64}" loading="lazy" class="pr-gallery-img" onclick="openPrModal('${imgBase64}')">
            `;
        });
    }

    // === סקציית טיפולים - הסתרה מלאה אם showTreatments === false ===
    const treatmentsSection = document.getElementById('pr-section-treatments');
    if (!showTreatments) {
        if (treatmentsSection) treatmentsSection.style.display = 'none';
    } else {
        const treatments = car.treatments || [];
        const tContainer = document.getElementById('pr-treatments-timeline');

        if (treatments.length > 0) {
            treatments.sort((a, b) => new Date(b.date) - new Date(a.date));

            let html = '<div class="pr-timeline">';
            treatments.forEach(t => {
                let displayDate = formatCleanDate(t.date);

                let verifiedHtml = t.invoice ?
                    `<div class="verified-badge shadow-sm"><i class="fas fa-check-circle me-1"></i> טיפול מאומת</div>` : '';

                // הצגת עלות רק אם showCosts מופעל
                let costHtml = '';
                if (showCosts && t.cost) {
                    costHtml = `<div class="badge bg-light text-danger border px-2 py-1"><i class="fas fa-shekel-sign me-1"></i> ${parseFloat(t.cost).toLocaleString()}</div>`;
                }

                // כפתור צפייה בקבלה אם קיים invoice
                let receiptHtml = '';
                if (t.invoice) {
                    const isPdf = typeof t.invoice === 'string' && t.invoice.startsWith('data:application/pdf');
                    const icon = isPdf ? 'fa-file-pdf' : 'fa-receipt';
                    receiptHtml = `<div class="badge bg-info bg-opacity-10 text-info border px-2 py-1 pr-receipt-btn" style="cursor: pointer;" data-invoice-index="${treatments.indexOf(t)}" data-is-pdf="${isPdf}"><i class="fas ${icon} me-1"></i> צפה בקבלה</div>`;
                }

                html += `
                    <div class="pr-timeline-item">
                        <div class="pr-timeline-dot"></div>
                        <div class="pr-timeline-card">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-secondary small fw-bold"><i class="far fa-calendar-alt me-1"></i> ${displayDate}</span>
                                <span class="badge bg-primary bg-opacity-10 text-primary border"><i class="fas fa-tachometer-alt me-1 text-primary"></i> ק"מ: ${t.km ? t.km.toLocaleString() : '-'}</span>
                            </div>
                            <h6 class="fw-bold text-dark m-0 mb-1" style="font-size: 1.05rem;">${t.type || t.name || 'טיפול תחזוקה'}</h6>
                            <div class="text-muted small"><i class="fas fa-wrench me-1"></i> מוסך מבצע: ${t.garage || 'לא צוין'}</div>
                            <div class="d-flex gap-2 flex-wrap mt-3">
                                ${costHtml}
                                ${verifiedHtml}
                                ${receiptHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            tContainer.innerHTML = html;

            // הוספת מאזיני לחיצה לכפתורי צפייה בקבלה (Event Delegation)
            tContainer.querySelectorAll('.pr-receipt-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const idx = parseInt(this.dataset.invoiceIndex);
                    const isPdf = this.dataset.isPdf === 'true';
                    const invoiceData = treatments[idx]?.invoice;
                    if (!invoiceData) return;
                    if (isPdf) {
                        window.open(invoiceData, '_blank');
                    } else {
                        openPrModal(invoiceData);
                    }
                });
            });
        } else {
            tContainer.innerHTML = getEmptyStateHTML('fa-tools', 'אין טיפולים מתועדים', 'לא נמצאו רשומות על טיפולי מוסך במערכת.');
        }
    }

    // === סקציית ביטוח - הסתרה מלאה אם showInsurance === false ===
    const insuranceSection = document.getElementById('pr-section-insurance');
    if (!showInsurance) {
        if (insuranceSection) insuranceSection.style.display = 'none';
    } else {
        const iContainer = document.getElementById('pr-insurance-data');
        if (car.insurance && typeof car.insurance === 'object' && Object.keys(car.insurance).length > 0) {
            let html = '<div class="d-flex flex-column gap-3">';
            const insTypeNames = {
                'mandatory': 'ביטוח חובה',
                'comprehensive': 'ביטוח מקיף',
                'thirdParty': "ביטוח צד ג'"
            };
            for (let type in car.insurance) {
                const insData = car.insurance[type];
                if (!insData || (!insData.company && !insData.date)) continue;

                let docsBtn = insData.invoice ? `<a href="${insData.invoice}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-4 mt-2"><i class="fas fa-file-contract me-1"></i> צפה בפוליסה</a>` : '';

                // הצגת עלות רק אם showCosts מופעל
                let costBlock = '';
                if (showCosts) {
                    costBlock = `
                        <div class="fs-4 fw-bold text-danger mb-1">₪${insData.cost ? parseFloat(insData.cost).toLocaleString() : '0'}</div>
                        <span class="text-muted small mb-2">עלות שנתית</span>
                    `;
                }

                html += `
                    <div class="pr-event-card" style="border-left: 4px solid var(--pr-accent);">
                        <div>
                            <h6 class="fw-bold mb-1 fs-5"><i class="fas fa-shield-alt text-primary me-2"></i> ${insData.company || 'חברת ביטוח לא צוינה'}</h6>
                            <div class="text-muted small mb-3">סוג פוליסה: <strong class="text-dark">${insTypeNames[type] || type}</strong></div>
                            <div class="d-flex gap-3 small flex-wrap">
                                <div class="badge bg-light text-dark border"><i class="far fa-calendar-check text-success me-1"></i> תוקף: ${formatCleanDate(insData.date)}</div>
                                ${insData.policyNum ? `<div class="badge bg-light text-dark border"><i class="fas fa-hashtag text-primary me-1"></i> פוליסה: ${insData.policyNum}</div>` : ''}
                            </div>
                        </div>
                        <div class="text-md-end mt-3 mt-md-0 d-flex flex-column justify-content-center align-items-md-end">
                            ${costBlock}
                            ${docsBtn}
                        </div>
                    </div>
                `;
            }
            html += '</div>';
            if (html === '<div class="d-flex flex-column gap-3"></div>') {
                iContainer.innerHTML = getEmptyStateHTML('fa-file-contract', 'אין מידע ביטוחי', 'לא הוזנו פוליסות ביטוח לרכב זה.');
            } else {
                iContainer.innerHTML = html;
            }
        } else {
            iContainer.innerHTML = getEmptyStateHTML('fa-file-contract', 'אין מידע ביטוחי', 'לא הוזנו פוליסות ביטוח לרכב זה.');
        }
    }

    // === סקציית קנסות - הסתרה מלאה אם showFines === false ===
    const reportsSection = document.getElementById('pr-section-reports');
    if (!showFines) {
        if (reportsSection) reportsSection.style.display = 'none';
    } else {
        const reports = car.reports || [];
        const rContainer = document.getElementById('pr-reports-data');
    if (reports.length > 0) {
        let html = ``;
        reports.forEach(r => {
            let costBlock = '';
            if (showCosts) {
                costBlock = `
                    <div class="text-md-end mt-3 mt-md-0">
                        <div class="fs-5 fw-bold text-danger">₪${r.amount ? parseFloat(r.amount).toLocaleString() : '-'}</div>
                        <div class="text-muted small">לתשלום</div>
                    </div>`;
            }
            html += `
            <div class="pr-event-card warning">
                <div>
                    <h6 class="fw-bold mb-1"><i class="fas fa-exclamation-triangle text-warning me-2"></i> ${r.title || r.type || 'דוח עבירת תנועה'}</h6>
                    <div class="text-muted small"><i class="far fa-calendar-alt me-1"></i> תאריך: ${formatCleanDate(r.date)}</div>
                </div>
                ${costBlock}
            </div>`;
        });
        rContainer.innerHTML = html;
    } else {
        rContainer.innerHTML = getEmptyStateHTML('fa-check-circle text-success', 'רכב נקי מדוחות', 'לא נמצאו דוחות תנועה או חניה מתועדים.', true);
    }
    }

    // === סקציית תדלוקים - הסתרה מלאה אם showFuelLogs === false ===
    const fuelSection = document.getElementById('pr-section-fuel');
    if (!showFuelLogs) {
        if (fuelSection) fuelSection.style.display = 'none';
    } else {
        const fuels = car.fuelLog || [];
        const fContainer = document.getElementById('pr-fuel-data');

    let fuelTypeStr = car.fuelType || '';
    let isElectric = fuelTypeStr.includes('חשמל') || fuelTypeStr.includes('Electric');
    let isHybrid = fuelTypeStr.includes('היבריד') || fuelTypeStr.includes('פלאג') || fuelTypeStr.includes('Hybrid');

    let unitName = isElectric ? 'קוט״ש' : 'ליטר';
    let unitPerName = isElectric ? 'לקוט״ש' : 'לליטר';
    let actionIcon = isElectric ? 'fa-plug' : 'fa-gas-pump';
    let actionName = isElectric ? 'טעינת רכב' : (isHybrid ? 'תדלוק / טעינת רכב' : 'תדלוק רכב');
    let emptyStateTitle = isElectric ? 'אין היסטוריית טעינות' : 'אין היסטוריית תדלוקים';
    let emptyStateDesc = isElectric ? 'לא תועדו טעינות לאחרונה.' : 'לא תועדו תדלוקים לאחרונה.';

    if (fuels.length > 0) {
        fuels.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentFuels = fuels.slice(0, 5);
        let html = `<div class="d-flex flex-column gap-2">`;
        recentFuels.forEach(f => {
            let pricePerLtr = f.pricePerUnit;
            if (!pricePerLtr && f.cost && f.amount && parseFloat(f.amount) > 0) {
                pricePerLtr = parseFloat(f.cost) / parseFloat(f.amount);
            }

            // בלוק עלויות תדלוק - מוצג רק אם showCosts מופעל
            let fuelCostBlock = '';
            if (showCosts) {
                fuelCostBlock = `
                    <div class="text-md-end mt-3 mt-md-0 d-flex flex-column justify-content-center align-items-start align-items-md-end gap-2 gap-md-1">
                        <div class="d-flex flex-wrap gap-2 mb-1">
                            <div class="badge bg-light text-dark border"><span dir="ltr">${f.amount || '-'}</span> ${unitName}</div>
                            <div class="badge bg-light text-primary border">₪<span dir="ltr">${pricePerLtr ? parseFloat(pricePerLtr).toFixed(2) : '-'}</span> ${unitPerName}</div>
                        </div>
                        <div class="fs-6 fw-bold"><span class="text-muted small fw-normal me-1">סה"כ: </span><span dir="ltr">₪${f.cost ? parseFloat(f.cost).toLocaleString() : '-'}</span></div>
                    </div>`;
            } else {
                // בלי עלויות - מציגים רק כמות
                fuelCostBlock = `
                    <div class="text-md-end mt-3 mt-md-0 d-flex flex-column justify-content-center align-items-start align-items-md-end">
                        <div class="badge bg-light text-dark border"><span dir="ltr">${f.amount || '-'}</span> ${unitName}</div>
                    </div>`;
            }

            html += `
            <div class="pr-event-card" style="border-left: 4px solid #cbd5e1;">
                <div>
                    <h6 class="fw-bold mb-1"><i class="fas ${actionIcon} text-secondary me-2"></i> ${actionName}</h6>
                    <div class="text-muted small"><i class="far fa-calendar-alt me-1"></i> ${formatCleanDate(f.date)}</div>
                </div>
                ${fuelCostBlock}
            </div>`;
        });
            html += `</div>`;
            fContainer.innerHTML = html;
        } else {
            fContainer.innerHTML = getEmptyStateHTML(actionIcon, emptyStateTitle, emptyStateDesc);
        }
    }

    // === סקציית תאונות - הסתרה מלאה אם showAccidents === false ===
    const accidentsSection = document.getElementById('pr-section-accidents');
    if (!showAccidents) {
        if (accidentsSection) accidentsSection.style.display = 'none';
    } else {
        const acc = car.accidents || [];
        const aContainer = document.getElementById('pr-accidents-data');
        if (acc.length > 0) {
            let html = ``;
            acc.forEach(a => {
                let thirdPartyHtml = '';
                if (a.involvedVehicles && a.involvedVehicles.length > 0) {
                    let vList = '';
                    a.involvedVehicles.forEach(v => {
                        vList += `
                            <div class="d-flex align-items-center gap-2 mt-2 bg-light p-2 rounded border">
                                <div class="badge bg-white text-dark border p-1"><i class="fas fa-car text-secondary"></i></div>
                                <div>
                                    <div class="fw-bold text-dark" style="font-size: 0.85rem;">${v.title || 'רכב מעורב'}</div>
                                    <div class="text-muted" style="font-size: 0.75rem;">מ"ר: <span class="badge bg-warning text-dark border border-warning px-1 rounded-1">${v.plate || '-'}</span> | ${v.color || '-'} | ${v.year || '-'}</div>
                                </div>
                            </div>
                        `;
                    });
                    thirdPartyHtml = `
                        <div class="mt-3 border-top pt-2">
                            <div class="text-danger small fw-bold"><i class="fas fa-file-contract me-1"></i> צד ג' / מעורבים</div>
                            ${vList}
                        </div>
                    `;
                }

                let imagesHtml = '';
                if (a.images && a.images.length > 0) {
                    let imgTags = '';
                    a.images.forEach(img => {
                        imgTags += `<img src="${img}" class="rounded border shadow-sm" style="width: 70px; height: 70px; object-fit: cover; cursor: zoom-in;" onclick="openPrModal('${img}')">`;
                    });
                    imagesHtml = `
                        <div class="mt-3 d-flex flex-wrap gap-2">
                            ${imgTags}
                        </div>
                    `;
                }

                const isHandledHtml = (a.isHandled || a.status === 'handled')
                    ? `<div class="badge bg-success bg-opacity-10 text-success border border-success"><i class="fas fa-check-circle me-1"></i> טופל ותוקן</div>`
                    : `<div class="badge bg-warning bg-opacity-10 text-warning border border-warning"><i class="fas fa-clock me-1"></i> פתוח / בטיפול</div>`;

                // הצגת עלות תאונה רק אם showCosts מופעל
                let costVal = a.cost || a.repairCost || a.damageCost || null;
                let accidentCostHtml = '';
                if (showCosts) {
                    accidentCostHtml = `
                        <div class="text-md-end mt-3 mt-md-0 d-flex flex-column justify-content-end align-items-start align-items-md-end ms-md-4" style="min-width: 120px;">
                            <div class="fs-5 fw-bold text-danger">₪${costVal ? parseFloat(costVal).toLocaleString() : '-'}</div>
                            <div class="text-muted small">עלות משוערת</div>
                        </div>`;
                }

                html += `
                <div class="pr-event-card danger">
                    <div class="w-100">
                        <div class="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
                            <h6 class="fw-bold mb-0 fs-5"><i class="fas fa-car-crash text-danger me-2"></i> ${a.title || 'תאונה / נזק מדווח'}</h6>
                            ${isHandledHtml}
                        </div>
                        <div class="text-muted small mb-2"><i class="far fa-calendar-alt me-1"></i> תאריך: ${formatCleanDate(a.date)}</div>
                        
                        <p class="text-muted mb-0 mt-2 small" style="white-space: pre-wrap;">${a.description || 'לא הוזן פירוט נזק.'}</p>
                        
                        ${thirdPartyHtml}
                        ${imagesHtml}
                    </div>
                    
                    ${accidentCostHtml}
                </div>`;
            });
            aContainer.innerHTML = html;
        } else {
            aContainer.innerHTML = getEmptyStateHTML('fa-shield-check text-success', 'רכב נקי מתאונות', 'לא נמצאו דיווחים על תאונות או פגיעות פח במערכת.', true);
        }
    }

    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app-content').style.display = 'block';
            document.getElementById('app-content').style.animation = 'fadeIn 0.5s ease-out';
        }, 300);
    }, 600);
}

/**
 * מייצרת רכיב HTML (מחרוזת) המייצג מצב ריק (Empty State) במקרה ואין נתונים זמינים בקטגוריה מסוימת (למשל: אין דוחות, אין טיפולים).
 * נועד להעניק חווית משתמש אחידה כאשר קטגוריה ספציפית ריקה.
 * 
 * @param {string} iconClass - מחלקת ה-CSS (לרוב FontAwesome) של סמל (אייקון) המתאים למצב הריק.
 * @param {string} title - כותרת ראשית לתצוגה במצב הריק.
 * @param {string} desc - תיאור משני (הסבר קצר) לסיבת חוסר הנתונים.
 * @param {boolean} [noBorder=false] - קובע האם להציג את הרכיב ללא מסגרת (לעיצוב נקי יותר), ברירת המחדל היא שקר.
 * @returns {string} - מחרוזת HTML מעוצבת המייצגת את אזור המצב הריק.
 */
function getEmptyStateHTML(iconClass, title, desc, noBorder = false) {
    return `
        <div class="pr-empty-state" ${noBorder ? 'style="border: none; background: rgba(16, 185, 129, 0.05);"' : ''}>
            <i class="fas ${iconClass} pr-empty-icon ${noBorder ? 'text-success' : ''}"></i>
            <h5 class="pr-empty-title">${title}</h5>
            <p class="pr-empty-desc m-0">${desc}</p>
        </div>
    `;
}

/**
 * מפרמטת ומנקה מחרוזות של תאריכים לפורמט סטנדרטי (DD/MM/YYYY) שמוצג למשתמש הישראלי.
 * מטפלת במגוון של פורמטים שמגיעים מהמסד (כגון חותמות זמן מסוג ISO או מחרוזות מופרדות במקף).
 * 
 * @param {string|Date} val - ערך התאריך המקורי (או מחרוזת טקסט כגון 'אין נתונים').
 * @returns {string} - התאריך בפורמט קריא, או מקף (-) אם הנתון חסר או לא חוקי.
 */
function formatCleanDate(val) {
    if (!val || val === 'אין נתונים') return '-';
    if (typeof val === 'string' && val.includes('T')) {
        const part = val.split('T')[0];
        const [y, m, d] = part.split('-');
        return `${d}/${m}/${y}`;
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = val.split('-');
        return `${d}/${m}/${y}`;
    }
    if (typeof val === 'string' && val.includes('-')) {
        const parts = val.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
}

/**
 * מאזין ללחיצה על תמונה מגלריית הרכב (או מתמונות תאונה), ופותח חלון קופץ (Modal) שמציג את התמונה בגודל מלא.
 * 
 * @param {string} src - כתובת או בסיס64 (Base64) של מקור התמונה שתוצג בחלון.
 * @returns {void}
 */
window.openPrModal = function (src) {
    const modal = document.getElementById('prImageModal');
    const img = document.getElementById('prModalImg');
    if (modal && img) {
        img.src = src;
        modal.classList.add('show');
    }
};

/**
 * אלגוריתם שקלול מורכב (Health Score) הבוחן את רמת אמינות התיעוד ורמת התחזוקה של הרכב.
 * מנקד את הרכב (עד 100) על סמך 5 פרמטרים מרכזיים: טיפולים מתועדים (30%), ביטוחים מקיפים וחובה (20%), תיעוד דלקים עקבי (20%), תוקף טסט (15%) והזנת קילומטראז' (15%).
 * זהה לאלגוריתם המרכזי ב-dashboard-overview.js כדי להבטיח עקביות ציונים בכל הדפים.
 * 
 * @param {Object} car - אובייקט הרכב עליו מחושב ציון האמינות.
 * @returns {number} - ציון האמינות הכללי המחושב כמספר שלם.
 */
function calculateLocalReliability(car) {
    let score = 0;

    const isDateFuture = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d > new Date();
    };

    // 1. טיפולים מתועדים עם קבלה (30%)
    const treatmentsWithInvoice = (car.treatments || []).filter(t => t.invoice).length;
    score += Math.min(treatmentsWithInvoice / 5, 1) * 30;

    // 2. ביטוח חובה + מקיף/צד ג' (20%)
    const insObj = car.insurance || {};
    const hasMandatory = insObj.mandatory?.date && isDateFuture(insObj.mandatory.date) && insObj.mandatory.file;
    const hasCompOrThird = (insObj.comprehensive?.date && isDateFuture(insObj.comprehensive.date) && insObj.comprehensive.file)
        || (insObj.thirdparty?.date && isDateFuture(insObj.thirdparty.date) && insObj.thirdparty.file);
    if (hasMandatory) score += 10;
    if (hasCompOrThird) score += 10;

    // 3. תיעוד תדלוקים (20%)
    const fuelCount = (car.fuelLog || []).length;
    score += Math.min(fuelCount / 5, 1) * 20;

    // 4. טסט בתוקף (15%)
    const testDone = !!(car.testDate && isDateFuture(car.testDate));
    if (testDone) score += 15;

    // 5. קילומטראז' מעודכן (15%)
    const kmDone = !!(car.km && car.km > 0);
    if (kmDone) score += 15;

    return Math.round(score);
}
