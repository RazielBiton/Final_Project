// --- SELL & TRADE-IN DASHBOARD MODULE ---

window.loadSell = function () {
    if (!currentCar) return;

    // Initialize default sell settings if missing
    if (!currentCar.sellSettings) {
        currentCar.sellSettings = {
            showTreatments: true,
            showCosts: true,
            showInsurance: true,
            showAccidents: true,
            sellerComment: ""
        };
    }

    // Load state to UI toggles
    const s = currentCar.sellSettings;
    const tTreatments = document.getElementById('toggleTreatments');
    const tCosts = document.getElementById('toggleCosts');
    const tInsurance = document.getElementById('toggleInsurance');
    const tAccidents = document.getElementById('toggleAccidents');
    const tComment = document.getElementById('sellerCommentBox');

    if (tTreatments) tTreatments.checked = s.showTreatments !== false;
    if (tCosts) tCosts.checked = s.showCosts !== false;
    if (tInsurance) tInsurance.checked = s.showInsurance !== false;
    if (tAccidents) tAccidents.checked = s.showAccidents !== false;
    if (tComment) tComment.value = s.sellerComment || "";

    window.renderGallery();
};

window.saveSellSettings = async function () {
    if (!currentCar) return;
    if (!currentCar.sellSettings) currentCar.sellSettings = {};

    const tTreatments = document.getElementById('toggleTreatments');
    const tCosts = document.getElementById('toggleCosts');
    const tInsurance = document.getElementById('toggleInsurance');
    const tAccidents = document.getElementById('toggleAccidents');
    const tComment = document.getElementById('sellerCommentBox');

    currentCar.sellSettings.showTreatments = tTreatments ? tTreatments.checked : true;
    currentCar.sellSettings.showCosts = tCosts ? tCosts.checked : true;
    currentCar.sellSettings.showInsurance = tInsurance ? tInsurance.checked : true;
    currentCar.sellSettings.showAccidents = tAccidents ? tAccidents.checked : true;
    currentCar.sellSettings.sellerComment = tComment ? tComment.value.trim() : "";

    // SYNC TO DB
    if (window.saveToLocalStorage) {
        window.saveToLocalStorage();
    }
    console.log("Sell settings saved to DB: ", currentCar.sellSettings);
};

window.generateStickerQR = function () {
    if (!currentCar) return;

    // REQUIREMENT: Minimum 3 photos
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
};
/* --- PREMIUM PDF GENERATOR (Bulletproof Executive Style) --- FIXED VERSION --- */
window.generateFullPDFReport = function () {
    if (!currentCar) return;

    // REQUIREMENT: Minimum 3 photos
    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק דוח PDF רשמי.');
        return;
    }

    window.saveSellSettings();

    console.log("Generating Premium PDF Export from DB data...");
    const s = currentCar.sellSettings || {};

    // 1. Populate Header
    const brand = currentCar.brandHeb || currentCar.brand || '';
    document.getElementById('pdf-subtitle').innerText = `${brand} ${currentCar.model || ''} • מספר רישוי: ${currentCar.licensePlate}`;

    const validLogo = currentCar.logo && !currentCar.logo.includes('ui-avatars.com') && !currentCar.logo.includes('default.png');
    const logoImg = document.getElementById('pdf-logo');
    if (logoImg) {
        logoImg.src = validLogo ? currentCar.logo : 'images/logo-placeholder.png';
        logoImg.style.display = 'block';
    }

    // 2. Populate Seller Pitch
    const pitchContainer = document.getElementById('pdf-seller-pitch-container');
    if (pitchContainer) {
        if (s.sellerComment && s.sellerComment.trim().length > 0) {
            document.getElementById('pdf-seller-pitch-text').innerText = s.sellerComment;
            pitchContainer.style.display = 'block';
        } else {
            pitchContainer.style.display = 'none';
        }
    }

    // 3. Populate Metrics
    const reliabilityRes = window.calculateReliability ? window.calculateReliability(currentCar) : { score: '--' };
    const scoreVal = typeof reliabilityRes === 'object' ? reliabilityRes.score : reliabilityRes;

    document.getElementById('pdf-metric-year').innerText = currentCar.year || '-';
    document.getElementById('pdf-metric-km').innerText = currentCar.km ? parseInt(currentCar.km).toLocaleString('he-IL') + ' ק"מ' : '0 ק"מ';
    document.getElementById('pdf-metric-test').innerText = window.formatDate ? window.formatDate(currentCar.testDate) : (currentCar.testDate || '-');
    document.getElementById('pdf-metric-score').innerText = `${scoreVal}%`;

    // 4. Populate Specs
    document.getElementById('pdf-spec-model').innerText = currentCar.model || '-';
    document.getElementById('pdf-spec-color').innerText = currentCar.color || '-';
    document.getElementById('pdf-spec-engine').innerText = currentCar.engineVolume ? currentCar.engineVolume + ' סמ"ק' : '-';
    document.getElementById('pdf-spec-hp').innerText = currentCar.horsePower ? currentCar.horsePower + ' כ"ס' : '-';
    document.getElementById('pdf-spec-fuel').innerText = currentCar.fuelType || '-';
    document.getElementById('pdf-spec-hand').innerText = currentCar.hand || '1';

    // 5. Build Dynamic Content
    let html = '';

    // A. Treatments
    if (s.showTreatments !== false) {
        const trs = currentCar.treatments || [];
        if (trs.length > 0) {
            html += `<h3 class="pdf-section-title">היסטוריית טיפולים  ותחזוקה</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>תאריך</th>
                    <th>תיאור הטיפול</th>
                    <th>מוסך מבצע</th>
                    <th>ק"מ</th>
                    ${s.showCosts ? '<th>עלות (₪)</th>' : ''}
                </tr></thead><tbody>`;
            trs.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
                html += `<tr>
                    <td dir="ltr">${window.formatDate ? window.formatDate(t.date) : t.date}</td>
                    <td style="font-weight:700;">${t.name || t.type || '-'}</td>
                    <td>${t.garage || '-'}</td>
                    <td>${t.km ? parseInt(t.km).toLocaleString('he-IL') : '-'}</td>
                    ${s.showCosts ? `<td style="color:#10b981; font-weight:800;">${t.cost ? '₪' + parseInt(t.cost).toLocaleString() : '-'}</td>` : ''}
                </tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    // B. Insurance
    if (s.showInsurance !== false) {
        const ins = currentCar.insurance || {};
        const hasInsurance = (ins.mandatory && ins.mandatory.company) || (ins.comprehensive && ins.comprehensive.company) || (ins.thirdparty && ins.thirdparty.company);

        if (hasInsurance) {
            html += `<h3 class="pdf-section-title">סטטוס ביטוחי ומיגון</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>סוג ביטוח</th>
                    <th>חברה מבטחת</th>
                    <th>תוקף עד</th>
                    ${s.showCosts ? '<th>פרמיה שנתית</th>' : ''}
                </tr></thead><tbody>`;

            if (ins.mandatory && ins.mandatory.company) {
                html += `<tr><td>חובה</td><td>${ins.mandatory.company}</td><td>${window.formatDate ? window.formatDate(ins.mandatory.date) : ins.mandatory.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.mandatory.cost).toLocaleString()}</td>` : ''}</tr>`;
            }
            if (ins.comprehensive && ins.comprehensive.company) {
                html += `<tr><td>מקיף</td><td>${ins.comprehensive.company}</td><td>${window.formatDate ? window.formatDate(ins.comprehensive.date) : ins.comprehensive.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.comprehensive.cost).toLocaleString()}</td>` : ''}</tr>`;
            } else if (ins.thirdparty && ins.thirdparty.company) {
                html += `<tr><td>צד ג'</td><td>${ins.thirdparty.company}</td><td>${window.formatDate ? window.formatDate(ins.thirdparty.date) : ins.thirdparty.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.thirdparty.cost).toLocaleString()}</td>` : ''}</tr>`;
            }
            html += `</tbody></table>`;
        }
    }

    // C. Accidents
    if (s.showAccidents !== false) {
        const accs = currentCar.accidents || [];
        if (accs.length > 0) {
            html += `<h3 class="pdf-section-title">דוח חריגים ונזקים</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>תאריך</th>
                    <th>תיאור הנזק</th>
                    ${s.showCosts ? '<th>עלות תיקון</th>' : ''}
                    <th>סטטוס</th>
                </tr></thead><tbody>`;
            accs.forEach(a => {
                html += `<tr>
                    <td dir="ltr">${window.formatDate ? window.formatDate(a.date) : a.date}</td>
                    <td style="font-weight:700; color:#b91c1c;">${a.title || 'נזק מתועד'}</td>
                    ${s.showCosts ? `<td style="color:#ef4444; font-weight:800;">${(a.repairCost || a.cost) ? '₪' + parseInt(a.repairCost || a.cost).toLocaleString() : '-'}</td>` : ''}
                    <td>${a.isHandled ? 'טופל' : 'טרם טופל'}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    // D. Gallery — FIX: proper sizing, aspect ratio, and grid layout
    if (photos.length > 0) {
        html += `<h3 class="pdf-section-title" style="margin-top:24px; font-family: 'Arial', sans-serif;">גלריית תמונות הרכב</h3>
        <div style="width: 100%; text-align: right; font-family: 'Arial', sans-serif; direction: rtl;">`;
        photos.forEach(src => {
            html += `
            <div style="
                width: 48%;
                margin: 1%;
                display: inline-block;
                box-sizing: border-box;
                overflow: hidden;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            ">
                <img
                    src="${src}"
                    alt="Car Image"
                    style="
                        width: 100%;
                        height: 180px;
                        object-fit: cover;
                        display: block;
                    "
                    crossorigin="anonymous"
                >
            </div>`;
        });
        html += `</div>`;
    }

    document.getElementById('pdf-dynamic-content').innerHTML = html;

    // Footer Time
    const now = new Date();
    document.getElementById('pdf-footer-time').innerText = `הופק ב-EasyCare: ${now.toLocaleDateString('he-IL')} | ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

    // PDF Options & Export — FIX: removed windowWidth/width that broke layout
    const content = document.getElementById('pdf-content');

    // FIX: Set RTL direction on the content container before capture
    content.style.direction = 'rtl';
    content.style.fontFamily = 'Arial, "Helvetica Neue", sans-serif';

    // UI Feedback
    const banner = document.querySelector('.sell-hero-banner');
    const originalContent = banner.innerHTML;
    banner.innerHTML = `
        <div class="py-4">
            <div class="spinner-border text-light mb-3" role="status"></div>
            <h3 class="text-white fw-bold">מייצר דוח פרימיום...</h3>
            <p class="text-white-50">מעבד את נתוני הרכב למסמך רשמי וממורכז</p>
        </div>
    `;

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `EasyCare_Report_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            letterRendering: true,
            // FIX: removed width & windowWidth — these caused shrunken/misaligned layout
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(content).save().then(() => {
        // FIX: reset inline styles added before export
        content.style.direction = '';
        content.style.fontFamily = '';
        banner.innerHTML = originalContent;
    }).catch(err => {
        console.error("PDF Export Error:", err);
        alert("שגיאה בהפקת הדוח. אנא נסה שנית.");
        content.style.direction = '';
        content.style.fontFamily = '';
        banner.innerHTML = originalContent;
    });
};

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
                <div class="position-relative" style="aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <img src="${imgBase64}" class="w-100 h-100" style="object-fit: cover;">
                    <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle shadow-sm d-flex align-items-center justify-content-center hover-lift" 
                        onclick="window.deleteGalleryImage(${index})" 
                        style="width:28px; height:28px; padding:0; z-index: 10; border: 2px solid #fff;">
                        <i class="fas fa-times" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        `;
    });
};

window.handleGalleryUpload = async function (event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!currentCar.gallery) currentCar.gallery = [];

    // REQUIREMENT: Maximum 10 photos
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

        // SYNC TO DB
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

window.deleteGalleryImage = async function (index) {
    if (confirm('האם אתה בטוח שברצונך למחוק תמונה זו? היא תרד גם מהדוח הרשמי.')) {
        currentCar.gallery.splice(index, 1);

        // SYNC TO DB
        if (window.saveToLocalStorage) {
            window.saveToLocalStorage();
        }

        window.renderGallery();
    }
};
