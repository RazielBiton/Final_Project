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
            sellerComment: "",
            hand: currentCar.hand || "1"
        };
    }

    const s = currentCar.sellSettings;
    const tTreatments = document.getElementById('toggleTreatments');
    const tCosts = document.getElementById('toggleCosts');
    const tInsurance = document.getElementById('toggleInsurance');
    const tAccidents = document.getElementById('toggleAccidents');
    const tComment = document.getElementById('sellerCommentBox');
    const tHand = document.getElementById('sellerHandSelector');

    if (tTreatments) tTreatments.checked = s.showTreatments !== false;
    if (tCosts) tCosts.checked = s.showCosts !== false;
    if (tInsurance) tInsurance.checked = s.showInsurance !== false;
    if (tAccidents) tAccidents.checked = s.showAccidents !== false;
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
    const tComment = document.getElementById('sellerCommentBox');
    const tHand = document.getElementById('sellerHandSelector');

    currentCar.sellSettings.showTreatments = tTreatments ? tTreatments.checked : true;
    currentCar.sellSettings.showCosts = tCosts ? tCosts.checked : true;
    currentCar.sellSettings.showInsurance = tInsurance ? tInsurance.checked : true;
    currentCar.sellSettings.showAccidents = tAccidents ? tAccidents.checked : true;
    currentCar.sellSettings.sellerComment = tComment ? tComment.value.trim() : "";
    if (tHand) currentCar.sellSettings.hand = tHand.value;

    if (window.saveToLocalStorage) {
        window.saveToLocalStorage();
    }
    console.log("Sell settings saved to DB: ", currentCar.sellSettings);
};

/**
 * מחוללת קוד סריקה (QR Code) ייחודי המקושר לדף "דוח רכב ציבורי" (Public Report) המכיל את כלל היסטוריית הרכב המאושרת לחשיפה. הקוד מוצג במודאל וניתן להורדה כקובץ תמונה להדפסה (לצורך הדבקה על הרכב).
 * דורשת מינימום 3 תמונות בגלריה להפקתה.
 */
window.generateStickerQR = function () {
    if (!currentCar) return;

    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק ברקוד סריקה (מדבקה).');
        return;
    }

    window.saveSellSettings(); // Ensure anything edited is flushed to db first

    const qrContainer = document.getElementById('qrcode');
    if (qrContainer) qrContainer.innerHTML = '';

    const host = window.location.origin + window.location.pathname.replace('dashboard.html', '');
    const landingUrl = `${host}public_report.html?id=${currentCar.id}`;

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

/**
 * פונקציית הליבה במודול זה: מפיקה, על בסיס נתוני הרכב וההגדרות שנשמרו, דוח רכב רשמי ומהודר בפורמט PDF ("דוח פרימיום"). הפונקציה בונה דינמית טבלאות HTML עבור טיפולים, פוליסות ביטוח, היסטוריית תאונות וצריכת דלק, ולאחר מכן ממירה אותם פיזית לקובץ PDF הניתן לשמירה וחלוקה לקונים עתידיים.
 */
window.generateFullPDFReport = function () {
    if (!currentCar) return;

    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק דוח PDF רשמי.');
        return;
    }

    window.saveSellSettings();

    const s = currentCar.sellSettings || {};
    const fmt = window.formatDate ? window.formatDate.bind(window) : (d => d || '-');

    const NIS = '<span class="nis">&#8362;</span>'; // ₪ via HTML entity + Arial class

    document.getElementById('pdf-subtitle').innerHTML =
        `${currentCar.brandHeb || currentCar.brand || ''} ${currentCar.model || ''} &bull; מספר&nbsp;רישוי:&nbsp;${currentCar.licensePlate || ''}`;

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
            document.getElementById('pdf-seller-pitch-text').innerText = s.sellerComment;
            pitchContainer.style.display = 'block';
        } else {
            pitchContainer.style.display = 'none';
        }
    }

    document.getElementById('pdf-metric-year').innerText = currentCar.year || '-';
    document.getElementById('pdf-metric-km').innerText =
        currentCar.km ? parseInt(currentCar.km).toLocaleString('he-IL') + ' ק"מ' : '0 ק"מ';
    document.getElementById('pdf-metric-test').innerText = fmt(currentCar.testDate) || '-';
    document.getElementById('pdf-spec-model').innerText = currentCar.model || '-';
    document.getElementById('pdf-spec-color').innerText = currentCar.color || '-';
    document.getElementById('pdf-spec-engine').innerText =
        currentCar.engineVolume ? currentCar.engineVolume + ' סמ"ק' : '-';
    document.getElementById('pdf-spec-hp').innerText =
        currentCar.horsePower ? currentCar.horsePower + ' כ"ס' : '-';
    document.getElementById('pdf-spec-fuel').innerText = currentCar.fuelType || '-';
    document.getElementById('pdf-spec-hand').innerText = s.hand || currentCar.hand || '1';

    let html = '';

    if (s.showTreatments !== false) {
        const trs = (currentCar.treatments || [])
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (trs.length > 0) {
            html += `
            <div class="pdf-section pdf-table-container">
                <h3 class="pdf-section-title">היסטוריית<span style="unicode-bidi:plaintext"> </span>טיפולים<span style="unicode-bidi:plaintext"> </span>ותחזוקה</h3>
                <table class="pdf-table">
                    <thead><tr>
                        <th>תאריך</th>
                        <th>תיאור הטיפול</th>
                        <th>מוסך מבצע</th>
                        <th>ק"מ</th>
                        ${s.showCosts !== false ? '<th>עלות</th>' : ''}
                    </tr></thead>
                    <tbody>`;
            trs.forEach(t => {
                html += `<tr>
                    <td><span dir="ltr">${fmt(t.date)}</span></td>
                    <td style="font-weight:700;">${t.name || t.type || '-'}</td>
                    <td>${t.garage || '-'}</td>
                    <td><span dir="ltr">${t.km ? parseInt(t.km).toLocaleString('he-IL') : '-'}</span></td>
                    ${s.showCosts !== false
                        ? `<td class="cost-cell">${t.cost
                            ? `<span dir="ltr">${parseInt(t.cost).toLocaleString('he-IL')}</span>&nbsp;${NIS}`
                            : '-'}</td>`
                        : ''}
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    }

    if (s.showInsurance !== false) {
        const ins = currentCar.insurance || {};
        const hasIns = (ins.mandatory && ins.mandatory.company)
            || (ins.comprehensive && ins.comprehensive.company)
            || (ins.thirdparty && ins.thirdparty.company);

        if (hasIns) {
            html += `
            <div class="pdf-section pdf-table-container">
                <h3 class="pdf-section-title">סטטוס<span style="unicode-bidi:plaintext"> </span>ביטוחי<span style="unicode-bidi:plaintext"> </span>ומיגון</h3>
                <table class="pdf-table">
                    <thead><tr>
                        <th>סוג ביטוח</th>
                        <th>חברה מבטחת</th>
                        <th>תוקף עד</th>
                        ${s.showCosts !== false ? '<th>פרמיה שנתית</th>' : ''}
                    </tr></thead>
                    <tbody>`;

            function insRow(label, data) {
                if (!data || !data.company) return '';
                const costTd = s.showCosts !== false
                    ? `<td class="cost-cell">${data.cost
                        ? `<span dir="ltr">${parseInt(data.cost).toLocaleString('he-IL')}</span>&nbsp;${NIS}`
                        : '-'}</td>`
                    : '';
                return `<tr>
                    <td>${label}</td>
                    <td>${data.company}</td>
                    <td><span dir="ltr">${fmt(data.date)}</span></td>
                    ${costTd}
                </tr>`;
            }

            html += insRow('חובה', ins.mandatory);
            html += insRow('מקיף', ins.comprehensive);
            if (!(ins.comprehensive && ins.comprehensive.company)) {
                html += insRow("צד ג'", ins.thirdparty);
            }
            html += `</tbody></table></div>`;
        }
    }

    if (s.showAccidents !== false) {
        const accs = currentCar.accidents || [];
        if (accs.length > 0) {
            html += `
            <div class="pdf-section pdf-table-container">
                <h3 class="pdf-section-title">דוח<span style="unicode-bidi:plaintext"> </span>חריגים<span style="unicode-bidi:plaintext"> </span>ונזקים</h3>
                <table class="pdf-table">
                    <thead><tr>
                        <th>תאריך</th>
                        <th>תיאור הנזק</th>
                        ${s.showCosts !== false ? '<th>עלות תיקון</th>' : ''}
                        <th>סטטוס</th>
                    </tr></thead>
                    <tbody>`;
            accs.forEach(a => {
                const repCost = a.repairCost || a.cost;
                html += `<tr>
                    <td><span dir="ltr">${fmt(a.date)}</span></td>
                    <td style="font-weight:700;">${a.title || 'נזק מתועד'}</td>
                    ${s.showCosts !== false
                        ? `<td class="cost-cell">${repCost
                            ? `<span dir="ltr">${parseInt(repCost).toLocaleString('he-IL')}</span>&nbsp;${NIS}`
                            : '-'}</td>`
                        : ''}
                    <td>${a.isHandled ? 'טופל' : 'טרם טופל'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    }

    if (s.showCosts !== false) {
        const fuels = currentCar.fuelLog || [];
        if (fuels.length > 0) {
            const ft = currentCar.fuelType || '';
            const isElectric = ft.includes('חשמל') || ft.includes('Electric');
            const isHybrid = ft.includes('היבריד') || ft.includes('פלאג') || ft.includes('Hybrid');
            const unitName = isElectric ? 'קוט״ש' : 'ליטר';
            const historyTitle = isElectric
                ? 'היסטוריית<span style="unicode-bidi:plaintext"> </span>טעינות'
                : (isHybrid ? 'היסטוריית<span style="unicode-bidi:plaintext"> </span>תדלוקים<span style="unicode-bidi:plaintext"> </span>וטעינות' : 'היסטוריית<span style="unicode-bidi:plaintext"> </span>תדלוקים');

            html += `
            <div class="pdf-section pdf-table-container">
                <h3 class="pdf-section-title">${historyTitle}</h3>
                <table class="pdf-table">
                    <thead><tr>
                        <th>תאריך</th>
                        <th>כמות &#40;${unitName}&#41;</th>
                        <th>מחיר ל${unitName}</th>
                        <th>סה"כ</th>
                    </tr></thead>
                    <tbody>`;
            fuels.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(f => {
                let ppl = null;
                if (f.pricePerLiter) {
                    ppl = parseFloat(f.pricePerLiter);
                } else if (f.cost && f.amount && parseFloat(f.amount) > 0) {
                    ppl = parseFloat(f.cost) / parseFloat(f.amount);
                }
                html += `<tr>
                    <td><span dir="ltr">${fmt(f.date)}</span></td>
                    <td><span dir="ltr">${f.amount ? parseFloat(f.amount).toLocaleString('he-IL') : '-'}</span></td>
                    <td>${ppl ? `<span dir="ltr">${ppl.toFixed(2)}</span>&nbsp;${NIS}` : '-'}</td>
                    <td class="cost-cell">${f.cost ? `<span dir="ltr">${parseFloat(f.cost).toLocaleString('he-IL')}</span>&nbsp;${NIS}` : '-'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    }

    if (photos.length > 0) {
        html += `
        <div class="pdf-section pdf-gallery-section">
            <h3 class="pdf-section-title">גלריית<span style="unicode-bidi:plaintext"> </span>תמונות<span style="unicode-bidi:plaintext"> </span>הרכב</h3>
            <div class="pdf-gallery-grid">`;
        photos.forEach(src => {
            html += `<div class="pdf-gallery-item"><img src="${src}" alt="Car" crossorigin="anonymous"></div>`;
        });
        html += `</div></div>`;
    }

    document.getElementById('pdf-dynamic-content').innerHTML = html;

    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('pdf-footer-time').innerHTML =
        `הופק ב-<span class="ltr-text">EasyCare</span> | <span class="ltr-text">${dateStr} &bull; ${timeStr}</span>`;

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
        image: { type: 'jpeg', quality: 0.95 },
        pagebreak: { mode: ['css', 'legacy'] },
        html2canvas: {
            scale: 2,
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
