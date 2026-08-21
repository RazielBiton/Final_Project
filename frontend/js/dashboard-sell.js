/**
 * @fileoverview frontend/js/dashboard-sell.js
 * @description מודול המוקדש לתהליך מכירת הרכב (Sell & Trade-In). המודול מאפשר להציג "שקיפות מלאה" לקונה על ידי יצירת מדבקת חלון (QR Code) חכמה, ובניית דוח PDF מהודר הכולל את היסטוריית הטיפולים, התאונות וגלריית תמונות, הכל תחת בחירה קפדנית של המשתמש מה לחשוף.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * נטענת בעת פתיחת אזור המכירה (Sell & Trade-In) בלוח הבקרה. מושכת את הגדרות התצוגה המותאמות של המשתמש (כגון אילו מדדים לחשוף לקונה הפוטנציאלי) ומאכלסת את מתגי ה-UI ואת מלל המוכר בהתאם.
 */
window.loadSell = function () {
    if (!currentCar) return;

    if (!currentCar.sellSettings) {
        currentCar.sellSettings = {
            showTreatments: true,
            showCosts: true,
            showInsurance: true,
            showAccidents: true,
            showFuelLogs: true,
            showFines: true,
            sellerComment: "",
            hand: currentCar.hand || "1"
        };
    }

    const s = currentCar.sellSettings;
    const tTreatments = document.getElementById('toggleTreatments');
    const tCosts = document.getElementById('toggleCosts');
    const tInsurance = document.getElementById('toggleInsurance');
    const tAccidents = document.getElementById('toggleAccidents');
    const tFuelLogs = document.getElementById('toggleFuelLogs');
    const tFines = document.getElementById('toggleFines');
    const tComment = document.getElementById('sellerCommentBox');
    const tHand = document.getElementById('sellerHandSelector');

    if (tTreatments) tTreatments.checked = s.showTreatments !== false;
    if (tCosts) tCosts.checked = s.showCosts !== false;
    if (tInsurance) tInsurance.checked = s.showInsurance !== false;
    if (tAccidents) tAccidents.checked = s.showAccidents !== false;
    if (tFuelLogs) tFuelLogs.checked = s.showFuelLogs !== false;
    if (tFines) tFines.checked = s.showFines !== false;
    if (tComment) tComment.value = s.sellerComment || "";
    if (tHand) tHand.value = s.hand || currentCar.hand || "1";

    window.renderGallery();
};

/**
 * שומרת באופן אסינכרוני את בחירות המשתמש (מתגים לבקרת חשיפת היסטוריית טיפולים, תאונות, עלויות וטקסט אישי חופשי) אל תוך מאגר הנתונים המקומי לצורך הפקת דוח שקיפות מדויק.
 * @returns {Promise<void>}
 */
window.saveSellSettings = async function () {
    if (!currentCar) return;
    if (!currentCar.sellSettings) currentCar.sellSettings = {};

    const tTreatments = document.getElementById('toggleTreatments');
    const tCosts = document.getElementById('toggleCosts');
    const tInsurance = document.getElementById('toggleInsurance');
    const tAccidents = document.getElementById('toggleAccidents');
    const tFuelLogs = document.getElementById('toggleFuelLogs');
    const tFines = document.getElementById('toggleFines');
    const tComment = document.getElementById('sellerCommentBox');
    const tHand = document.getElementById('sellerHandSelector');

    currentCar.sellSettings.showTreatments = tTreatments ? tTreatments.checked : true;
    currentCar.sellSettings.showCosts = tCosts ? tCosts.checked : true;
    currentCar.sellSettings.showInsurance = tInsurance ? tInsurance.checked : true;
    currentCar.sellSettings.showAccidents = tAccidents ? tAccidents.checked : true;
    currentCar.sellSettings.showFuelLogs = tFuelLogs ? tFuelLogs.checked : true;
    currentCar.sellSettings.showFines = tFines ? tFines.checked : true;
    currentCar.sellSettings.sellerComment = tComment ? tComment.value.trim() : "";
    currentCar.sellSettings.hand = tHand ? tHand.value : (currentCar.hand || "1");

    // עדכון הזיכרון המקומי (sessionStorage) כמו בסנכרון המלא, אך ללא העלאת כל נתוני הרכב
    const carIndex = savedCars.findIndex(c => parseInt(c.id) === parseInt(currentCar.id));
    if (carIndex !== -1) {
        savedCars[carIndex] = currentCar;
        sessionStorage.setItem('userCars', JSON.stringify(savedCars));
    }

    try {
        const userId = sessionStorage.getItem('userId') || '1';
        const resp = await fetch(`/api/vehicles/${currentCar.id}/sell-settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'userid': userId
            },
            body: JSON.stringify({ sellSettings: currentCar.sellSettings })
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            console.error("Sell settings sync failed:", errData.details || errData.error || resp.status);
        } else {
            console.log("Sell settings saved to DB: ", currentCar.sellSettings);
        }
    } catch (e) {
        console.error("Sell settings sync failed (network error):", e);
    }
};

/**
 * מחוללת קוד סריקה (QR Code) ייחודי המקושר לדף "דוח רכב ציבורי" (Public Report) המכיל את כלל היסטוריית הרכב המאושרת לחשיפה. הקוד מוצג במודאל וניתן להורדה כקובץ תמונה להדפסה (לצורך הדבקה על הרכב).
 * דורשת מינימום 3 תמונות בגלריה להפקתה.
 */
window.generateStickerQR = async function () {
    if (!currentCar) return;

    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק ברקוד סריקה (מדבקה).');
        return;
    }

    await window.saveSellSettings(); // Ensure anything edited is flushed to db first

    const qrContainer = document.getElementById('qrcode');
    if (qrContainer) qrContainer.innerHTML = '';

    const host = window.location.origin + window.location.pathname.replace('dashboard.html', '');
    const landingUrl = `${host}public_report.html?id=${currentCar.id}&v=${new Date().getTime()}`;

    new QRCode(qrContainer, {
        text: landingUrl,
        width: 180,
        height: 180,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    const modalBody = qrContainer.parentElement;
    let oldBtn = document.getElementById('downloadQrBtn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'downloadQrBtn';
    btn.className = 'btn w-100 mt-4 fw-bold';
    btn.style.cssText = "background: #3b82f6; color: white; border-radius: 12px; padding: 12px;";
    btn.innerHTML = '<i class="fas fa-download me-2"></i> שמור ברקוד להדפסה';
    btn.onclick = function () {
        const img = qrContainer.querySelector('img');
        const link = document.createElement('a');
        link.download = `Premium_QR_${currentCar.licensePlate}.png`;
        if (img && img.src.length > 100) {
            link.href = img.src; link.click();
        } else {
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) { link.href = canvas.toDataURL("image/png"); link.click(); }
        }
    };
    modalBody.appendChild(btn);

    const qrModalEl = document.getElementById('qrModal');
    if (qrModalEl) {
        const qrModal = bootstrap.Modal.getInstance(qrModalEl) || new bootstrap.Modal(qrModalEl);
        qrModal.show();
    }
};

/* =========================================================
   פונקציות עזר לרינדור טקסט עברי בדוח ה-PDF.
   ספריית ההמרה (html2canvas) "בולעת" רווחים ומערבבת סדר מילים בטקסט עברי (RTL),
   ולכן כל מילה נעטפת ב-span מבודד (unicode-bidi:plaintext) - כך כל מילה מרונדרת
   כיחידה עצמאית והרווחים, הסדר וסימני הפיסוק נשמרים במקומם הנכון.
   ========================================================= */

const PDF_SPACE = '<span style="unicode-bidi:plaintext"> </span>';

function pdfEscapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** עוטפת טקסט עברי (או מעורב) כך שישרוד את רינדור html2canvas ללא הדבקת מילים. */
function pdfHeb(str, fallback = '-') {
    if (str === null || str === undefined || String(str).trim() === '') return fallback;
    return String(str).trim().split(/\s+/)
        .map(w => `<span style="unicode-bidi:plaintext">${pdfEscapeHtml(w)}</span>`)
        .join(PDF_SPACE);
}

/** עוטפת ערך שמאל-לימין (מספרים, תאריכים, לוחיות רישוי) במעטפת LTR מבודדת. */
function pdfLtr(str, fallback = '-') {
    if (str === null || str === undefined || String(str).trim() === '') return fallback;
    return `<span dir="ltr">${pdfEscapeHtml(String(str).trim())}</span>`;
}

/** מרנדרת סכום כספי עם סימן שקל בגופן תקין ובכיווניות נכונה. */
function pdfMoney(value) {
    const num = parseFloat(value);
    if (!num) return '-';
    return `<span dir="ltr">${num.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</span>&nbsp;<span class="nis">&#8362;</span>`;
}

/** מרנדרת תגית סטטוס צבעונית (ירוק לחיובי, אדום לשלילי). */
function pdfPill(text, isPositive) {
    return `<span class="pdf-pill ${isPositive ? 'pdf-pill-green' : 'pdf-pill-red'}">${pdfHeb(text)}</span>`;
}

/** בונה אזור טבלה שלם בדוח: כותרת מעוצבת, כותרות עמודות, שורות ושורת סיכום אופציונלית. */
function pdfSection(title, headers, rowsHtml, footHtml = '') {
    const ths = headers.map(h => `<th>${pdfHeb(h)}</th>`).join('');
    return `
    <div class="pdf-section pdf-table-container">
        <h3 class="pdf-section-title">${pdfHeb(title)}</h3>
        <div class="pdf-table-wrap">
            <table class="pdf-table">
                <thead><tr>${ths}</tr></thead>
                <tbody>${rowsHtml}</tbody>
                ${footHtml}
            </table>
        </div>
    </div>`;
}

/**
 * פונקציית הליבה במודול זה: מפיקה, על בסיס נתוני הרכב וההגדרות שנשמרו, דוח רכב רשמי ומהודר בפורמט PDF ("דוח פרימיום"). הפונקציה בונה דינמית טבלאות HTML עבור טיפולים, פוליסות ביטוח, היסטוריית תאונות, צריכת דלק וקנסות, ולאחר מכן ממירה אותם פיזית לקובץ PDF הניתן לשמירה וחלוקה לקונים עתידיים. כל אזור בדוח נשלט על ידי מתגי השקיפות שבדף המכירה.
 */
window.generateFullPDFReport = async function () {
    if (!currentCar) return;

    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק דוח PDF רשמי.');
        return;
    }

    await window.saveSellSettings();

    const s = currentCar.sellSettings || {};
    const showCosts = s.showCosts !== false;
    const fmt = window.formatDate ? window.formatDate.bind(window) : (d => d || '-');
    const fmtDate = d => pdfLtr(fmt(d));

    document.getElementById('pdf-subtitle').innerHTML =
        pdfHeb(`${currentCar.brandHeb || currentCar.brand || ''} ${currentCar.model || ''}`, '') +
        `${PDF_SPACE}&bull;${PDF_SPACE}` +
        pdfHeb('מספר רישוי:') + '&nbsp;' + pdfLtr(currentCar.licensePlate, '');

    const validLogo = currentCar.logo
        && !currentCar.logo.includes('ui-avatars.com')
        && !currentCar.logo.includes('default.png');
    const logoImg = document.getElementById('pdf-logo');
    if (logoImg) {
        if (validLogo) {
            logoImg.src = currentCar.logo;
            logoImg.style.display = 'block';
        } else {
            logoImg.style.display = 'none';
        }
    }

    const pitchContainer = document.getElementById('pdf-seller-pitch-container');
    if (pitchContainer) {
        const hasPitch = s.sellerComment && s.sellerComment.trim().length > 0;
        if (hasPitch) {
            document.getElementById('pdf-seller-pitch-text').innerHTML =
                String(s.sellerComment).split('\n').map(line => pdfHeb(line, '')).join('<br>');
            pitchContainer.style.display = 'block';
        } else {
            pitchContainer.style.display = 'none';
        }
    }

    document.getElementById('pdf-metric-year').innerHTML = pdfLtr(currentCar.year);
    document.getElementById('pdf-metric-km').innerHTML =
        pdfLtr(currentCar.km ? parseInt(currentCar.km).toLocaleString('he-IL') : '0') + PDF_SPACE + pdfHeb('ק"מ');
    document.getElementById('pdf-metric-test').innerHTML = fmtDate(currentCar.testDate);
    document.getElementById('pdf-spec-model').innerHTML = pdfHeb(currentCar.model);
    document.getElementById('pdf-spec-color').innerHTML = pdfHeb(currentCar.color);
    document.getElementById('pdf-spec-engine').innerHTML =
        currentCar.engineVolume ? pdfLtr(currentCar.engineVolume) + PDF_SPACE + pdfHeb('סמ"ק') : '-';
    document.getElementById('pdf-spec-hp').innerHTML =
        currentCar.horsePower ? pdfLtr(currentCar.horsePower) + PDF_SPACE + pdfHeb('כ"ס') : '-';
    document.getElementById('pdf-spec-fuel').innerHTML = pdfHeb(currentCar.fuelType);
    document.getElementById('pdf-spec-hand').innerHTML = pdfLtr(s.hand || currentCar.hand || '1');

    let html = '';

    if (s.showTreatments !== false) {
        const trs = (currentCar.treatments || [])
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (trs.length > 0) {
            let totalCost = 0;
            let rows = '';
            trs.forEach(t => {
                totalCost += parseFloat(t.cost) || 0;
                rows += `<tr>
                    <td>${fmtDate(t.date)}</td>
                    <td style="font-weight:700;">${pdfHeb(t.name || t.type)}</td>
                    <td>${pdfHeb(t.garage)}</td>
                    <td>${pdfLtr(t.km ? parseInt(t.km).toLocaleString('he-IL') : '')}</td>
                    ${showCosts ? `<td class="cost-cell">${pdfMoney(t.cost)}</td>` : ''}
                </tr>`;
            });
            const foot = (showCosts && totalCost > 0)
                ? `<tfoot><tr><td colspan="4">${pdfHeb('סה"כ השקעה מתועדת בטיפולים')}</td><td class="cost-cell">${pdfMoney(totalCost)}</td></tr></tfoot>`
                : '';
            html += pdfSection(
                'היסטוריית טיפולים ותחזוקה',
                ['תאריך', 'תיאור הטיפול', 'מוסך מבצע', 'ק"מ', ...(showCosts ? ['עלות'] : [])],
                rows, foot
            );
        }
    }

    if (s.showInsurance !== false) {
        const ins = currentCar.insurance || {};
        const insRow = (label, data) => {
            if (!data || !data.company) return '';
            return `<tr>
                <td style="font-weight:700;">${pdfHeb(label)}</td>
                <td>${pdfHeb(data.company)}</td>
                <td>${fmtDate(data.date)}</td>
                ${showCosts ? `<td class="cost-cell">${pdfMoney(data.cost)}</td>` : ''}
            </tr>`;
        };

        let rows = insRow('חובה', ins.mandatory) + insRow('מקיף', ins.comprehensive);
        if (!(ins.comprehensive && ins.comprehensive.company)) {
            rows += insRow("צד ג'", ins.thirdparty);
        }
        if (rows) {
            html += pdfSection(
                'סטטוס ביטוחי ומיגון',
                ['סוג ביטוח', 'חברה מבטחת', 'תוקף עד', ...(showCosts ? ['פרמיה שנתית'] : [])],
                rows
            );
        }
    }

    if (s.showAccidents !== false) {
        const accs = currentCar.accidents || [];
        if (accs.length > 0) {
            let rows = '';
            accs.forEach(a => {
                rows += `<tr>
                    <td>${fmtDate(a.date)}</td>
                    <td style="font-weight:700;">${pdfHeb(a.title || 'נזק מתועד')}</td>
                    ${showCosts ? `<td class="cost-cell">${pdfMoney(a.repairCost || a.cost)}</td>` : ''}
                    <td>${pdfPill(a.isHandled ? 'טופל' : 'טרם טופל', !!a.isHandled)}</td>
                </tr>`;
            });
            html += pdfSection(
                'דוח חריגים ונזקים',
                ['תאריך', 'תיאור הנזק', ...(showCosts ? ['עלות תיקון'] : []), 'סטטוס'],
                rows
            );
        }
    }

    if (s.showFuelLogs !== false) {
        const fuels = currentCar.fuelLog || [];
        if (fuels.length > 0) {
            const ft = currentCar.fuelType || '';
            const isElectric = ft.includes('חשמל') || ft.includes('Electric');
            const isHybrid = ft.includes('היבריד') || ft.includes('פלאג') || ft.includes('Hybrid');
            const unitName = isElectric ? 'קוט"ש' : 'ליטר';
            const amountHeader = isElectric ? 'קוט"ש' : 'ליטרים';
            const historyTitle = isElectric
                ? 'היסטוריית טעינות'
                : (isHybrid ? 'היסטוריית תדלוקים וטעינות' : 'היסטוריית תדלוקים');

            let totalFuelCost = 0;
            let rows = '';
            fuels.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(f => {
                let ppl = null;
                if (f.pricePerLiter) {
                    ppl = parseFloat(f.pricePerLiter);
                } else if (f.cost && f.amount && parseFloat(f.amount) > 0) {
                    ppl = parseFloat(f.cost) / parseFloat(f.amount);
                }
                totalFuelCost += parseFloat(f.cost) || 0;
                rows += `<tr>
                    <td>${fmtDate(f.date)}</td>
                    <td>${pdfLtr(f.amount ? parseFloat(f.amount).toLocaleString('he-IL') : '')}</td>
                    ${showCosts ? `<td>${pdfMoney(ppl)}</td><td class="cost-cell">${pdfMoney(f.cost)}</td>` : ''}
                </tr>`;
            });
            const foot = (showCosts && totalFuelCost > 0)
                ? `<tfoot><tr><td colspan="3">${pdfHeb('סה"כ הוצאות אנרגיה מתועדות')}</td><td class="cost-cell">${pdfMoney(totalFuelCost)}</td></tr></tfoot>`
                : '';
            html += pdfSection(
                historyTitle,
                ['תאריך', amountHeader, ...(showCosts ? [`מחיר ל${unitName}`, 'סה"כ'] : [])],
                rows, foot
            );
        }
    }

    if (s.showFines !== false) {
        const fines = currentCar.reports || [];
        if (fines.length > 0) {
            let rows = '';
            fines.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(r => {
                const isPaid = (r.status === 'paid' || r.isHandled === true);
                rows += `<tr>
                    <td>${fmtDate(r.date)}</td>
                    <td style="font-weight:700;">${pdfHeb(r.typeVal || r.offenseType || 'דוח תנועה')}</td>
                    <td>${pdfHeb(r.location)}</td>
                    ${showCosts ? `<td class="cost-cell">${pdfMoney(r.amount)}</td>` : ''}
                    <td>${pdfPill(isPaid ? 'שולם' : 'טרם שולם', isPaid)}</td>
                </tr>`;
            });
            html += pdfSection(
                'קנסות ודוחות',
                ['תאריך', 'סוג העבירה', 'מיקום', ...(showCosts ? ['סכום'] : []), 'סטטוס'],
                rows
            );
        }
    }

    if (photos.length > 0) {
        let items = '';
        photos.forEach(src => {
            items += `<div class="pdf-gallery-item"><img src="${src}" alt="Car" crossorigin="anonymous"></div>`;
        });
        html += `
        <div class="pdf-section pdf-gallery-section">
            <h3 class="pdf-section-title">${pdfHeb('גלריית תמונות הרכב')}</h3>
            <div class="pdf-gallery-grid">${items}</div>
        </div>`;
    }

    document.getElementById('pdf-dynamic-content').innerHTML = html;

    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('pdf-footer-time').innerHTML =
        pdfHeb('הופק בתאריך') + '&nbsp;<span class="ltr-text">' + dateStr + '</span>&nbsp;' +
        pdfHeb('בשעה') + '&nbsp;<span class="ltr-text">' + timeStr + '</span>';
    document.getElementById('pdf-footer-brand').innerHTML =
        pdfHeb('הופק באמצעות מערכת ניהול הרכב') +
        '&nbsp;<span class="ltr-text">EasyCare</span>&nbsp;<span dir="ltr">&copy; ' + now.getFullYear() + '</span>';

    const content = document.getElementById('pdf-content');
    const container = document.getElementById('pdf-export-container');
    container.style.display = 'block';

    const banner = document.querySelector('.sell-hero-banner');
    const originalContent = banner ? banner.innerHTML : '';
    if (banner) {
        banner.innerHTML = `<div class="py-4">
            <div class="spinner-border text-light mb-3" role="status"></div>
            <h3 class="text-white fw-bold">מייצר דוח פרימיום...</h3>
            <p class="text-white-50">אנא המתן</p>
        </div>`;
    }

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `EasyCare_Report_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        pagebreak: { mode: ['css', 'legacy'] },
        html2canvas: {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            letterRendering: true,
            logging: false,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    document.fonts.ready.then(() => {
        setTimeout(() => {
            html2pdf().set(opt).from(content).save().then(() => {
                container.style.display = 'none';
                if (banner) banner.innerHTML = originalContent;
            }).catch(err => {
                console.error('PDF Error:', err);
                alert('שגיאה בהפקת הדוח. אנא נסה שנית.');
                container.style.display = 'none';
                if (banner) banner.innerHTML = originalContent;
            });
        }, 150); // 150ms lets the browser paint the revealed container before capture
    });
};

/**
 * מרנדרת (Render) אל מסך המשתמש את מערך התמונות המקומי (Gallery) שהועלו עבור הרכב. מסדרת אותן בגריד ויזואלי גמיש המאפשר צפייה מקדימה והסרה פרטנית.
 */
window.renderGallery = function () {
    const grid = document.getElementById('sellGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!currentCar.gallery) currentCar.gallery = [];

    if (currentCar.gallery.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted small py-5" style="background: #f8fafc; border-radius: 16px; border: 2px dashed #e2e8f0;">מערכת ההדפסה והצגת הרכב תשמח לתמונת השוויצה מציאותית. הוסף לכאן.</div>';
        return;
    }

    currentCar.gallery.forEach((imgBase64, index) => {
        grid.innerHTML += `
            <div class="col-6 col-md-3 mt-3">
                <div class="position-relative" style="cursor: pointer; aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" onclick="window.showFilePreview('${imgBase64}', 'image')">
                    <img src="${imgBase64}" class="w-100 h-100" style="object-fit: cover;">
                    <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle shadow-sm d-flex align-items-center justify-content-center hover-lift" 
                        onclick="event.stopPropagation(); window.deleteGalleryImage(${index})" 
                        style="width:28px; height:28px; padding:0; z-index: 10; border: 2px solid #fff;">
                        <i class="fas fa-times" style="font-size: 0.8rem;"></i>
                    </button>
                    <div class="position-absolute bottom-0 start-0 w-100 text-center" style="background: rgba(0,0,0,0.5); padding: 4px 0;">
                        <i class="fas fa-eye text-white" style="font-size: 0.9rem;"></i>
                    </div>
                </div>
            </div>
        `;
    });
};

/**
 * מנהלת העלאת קבצי תמונה לגלריית הרכב (עד למקסימום של 10 תמונות). מבצעת קריאת FileReader אסינכרונית כדי להמיר את התמונות ל-Base64 ולשמור אותן במסד הנתונים לשם שילובן בקוד ה-QR או בדוח ה-PDF.
 * @param {Event} event - אירוע העלאת הקבצים משדה ה-Input.
 * @returns {Promise<void>}
 */
window.handleGalleryUpload = async function (event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!currentCar.gallery) currentCar.gallery = [];

    if (currentCar.gallery.length + files.length > 10) {
        alert(`ניתן להעלות עד 10 תמונות בלבד. כרגע קיימות ${currentCar.gallery.length} תמונות.`);
        return;
    }

    const btnInput = event.target;

    try {
        for (let file of files) {
            const reader = new FileReader();
            const res = await new Promise((resolve) => {
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            currentCar.gallery.push(res);
        }

        if (window.saveToLocalStorage) {
            window.saveToLocalStorage();
        }

        window.renderGallery();
        btnInput.value = '';
    } catch (err) {
        console.error("Gallery upload error:", err);
        alert('שגיאה בהעלאת התמונות.');
    }
};

/**
 * מסירה תמונה מסוימת מתוך מערך תמונות הגלריה של הרכב, בהתבסס על מיקומה המדויק במערך (Index), ומעדכנת את תצוגת הגלריה ואת מאגר הנתונים בהתאם.
 * @param {number} index - המיקום של התמונה במערך הגלריה המיועדת למחיקה.
 * @returns {Promise<void>}
 */
window.deleteGalleryImage = async function (index) {
    if (confirm('האם אתה בטוח שברצונך למחוק תמונה זו? היא תרד גם מהדוח הרשמי.')) {
        currentCar.gallery.splice(index, 1);

        if (window.saveToLocalStorage) {
            window.saveToLocalStorage();
        }

        window.renderGallery();
    }
};
