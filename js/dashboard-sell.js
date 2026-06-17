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
            sellerComment: "",
            hand: currentCar.hand || "1"
        };
    }

    // Load state to UI toggles
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
    document.getElementById('pdf-subtitle').innerHTML = `${currentCar.brandHeb || currentCar.brand} ${currentCar.model} &bull; מספר&nbsp;רישוי:&nbsp;${currentCar.licensePlate}`;

    const validLogo = currentCar.logo && !currentCar.logo.includes('ui-avatars.com') && !currentCar.logo.includes('default.png');
    const logoImg = document.getElementById('pdf-logo');
    if (logoImg) {
        logoImg.src = validLogo ? currentCar.logo : 'images/logo-placeholder.png';
        logoImg.style.display = validLogo ? 'block' : 'none';
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

    // 3. Populate Metrics & Specs (Grid)
    document.getElementById('pdf-metric-year').innerText = currentCar.year || '-';
    document.getElementById('pdf-metric-km').innerHTML = currentCar.km ? parseInt(currentCar.km).toLocaleString('he-IL') + '&nbsp;ק"מ' : '0&nbsp;ק"מ';
    document.getElementById('pdf-metric-test').innerText = window.formatDate ? window.formatDate(currentCar.testDate) : (currentCar.testDate || '-');
    document.getElementById('pdf-spec-model').innerHTML = currentCar.model ? currentCar.model.replace(/ /g, '&nbsp;') : '-';
    document.getElementById('pdf-spec-color').innerText = currentCar.color || '-';
    document.getElementById('pdf-spec-engine').innerHTML = currentCar.engineVolume ? currentCar.engineVolume + '&nbsp;סמ"ק' : '-';
    document.getElementById('pdf-spec-hp').innerHTML = currentCar.horsePower ? currentCar.horsePower + '&nbsp;כ"ס' : '-';
    document.getElementById('pdf-spec-fuel').innerText = currentCar.fuelType || '-';
    document.getElementById('pdf-spec-hand').innerText = s.hand || currentCar.hand || '1';

    // 4. Build Dynamic Content
    let html = '';

    // A. Treatments
    if (s.showTreatments !== false) {
        const trs = currentCar.treatments || [];
        if (trs.length > 0) {
            html += `<div class="pdf-section pdf-table-container"><h3 class="pdf-section-title">היסטוריית&nbsp;טיפולים&nbsp;ותחזוקה</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>תאריך</th>
                    <th>תיאור&nbsp;הטיפול</th>
                    <th>מוסך&nbsp;מבצע</th>
                    <th>ק"מ</th>
                    ${s.showCosts ? '<th>עלות&nbsp;(₪)</th>' : ''}
                </tr></thead><tbody>`;
            trs.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
                html += `<tr>
                    <td dir="ltr">${window.formatDate ? window.formatDate(t.date) : t.date}</td>
                    <td style="font-weight:700;">${(t.name || t.type || '-').replace(/ /g, '&nbsp;')}</td>
                    <td>${(t.garage || '-').replace(/ /g, '&nbsp;')}</td>
                    <td>${t.km ? parseInt(t.km).toLocaleString('he-IL') : '-'}</td>
                    ${s.showCosts ? `<td style="color:#111827; font-weight:800;">${t.cost ? '₪' + parseInt(t.cost).toLocaleString() : '-'}</td>` : ''}
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    }

    // B. Insurance
    if (s.showInsurance !== false) {
        const ins = currentCar.insurance || {};
        const hasInsurance = (ins.mandatory && ins.mandatory.company) || (ins.comprehensive && ins.comprehensive.company) || (ins.thirdparty && ins.thirdparty.company);

        if (hasInsurance) {
            html += `<div class="pdf-section pdf-table-container"><h3 class="pdf-section-title">סטטוס&nbsp;ביטוחי&nbsp;ומיגון</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>סוג&nbsp;ביטוח</th>
                    <th>חברה&nbsp;מבטחת</th>
                    <th>תוקף&nbsp;עד</th>
                    ${s.showCosts ? '<th>פרמיה&nbsp;שנתית</th>' : ''}
                </tr></thead><tbody>`;

            if (ins.mandatory && ins.mandatory.company) {
                html += `<tr><td>חובה</td><td>${ins.mandatory.company.replace(/ /g, '&nbsp;')}</td><td dir="ltr">${window.formatDate ? window.formatDate(ins.mandatory.date) : ins.mandatory.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.mandatory.cost).toLocaleString()}</td>` : ''}</tr>`;
            }
            if (ins.comprehensive && ins.comprehensive.company) {
                html += `<tr><td>מקיף</td><td>${ins.comprehensive.company.replace(/ /g, '&nbsp;')}</td><td dir="ltr">${window.formatDate ? window.formatDate(ins.comprehensive.date) : ins.comprehensive.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.comprehensive.cost).toLocaleString()}</td>` : ''}</tr>`;
            } else if (ins.thirdparty && ins.thirdparty.company) {
                html += `<tr><td>צד&nbsp;ג'</td><td>${ins.thirdparty.company.replace(/ /g, '&nbsp;')}</td><td dir="ltr">${window.formatDate ? window.formatDate(ins.thirdparty.date) : ins.thirdparty.date}</td>${s.showCosts ? `<td>₪${parseInt(ins.thirdparty.cost).toLocaleString()}</td>` : ''}</tr>`;
            }
            html += `</tbody></table></div>`;
        }
    }

    // C. Accidents
    if (s.showAccidents !== false) {
        const accs = currentCar.accidents || [];
        if (accs.length > 0) {
            html += `<div class="pdf-section pdf-table-container"><h3 class="pdf-section-title">דוח&nbsp;חריגים&nbsp;ונזקים</h3>
            <table class="pdf-table">
                <thead><tr>
                    <th>תאריך</th>
                    <th>תיאור&nbsp;הנזק</th>
                    ${s.showCosts ? '<th>עלות&nbsp;תיקון</th>' : ''}
                    <th>סטטוס</th>
                </tr></thead><tbody>`;
            accs.forEach(a => {
                html += `<tr>
                    <td dir="ltr">${window.formatDate ? window.formatDate(a.date) : a.date}</td>
                    <td style="font-weight:700;">${(a.title || 'נזק מתועד').replace(/ /g, '&nbsp;')}</td>
                    ${s.showCosts ? `<td>${(a.repairCost || a.cost) ? '₪' + parseInt(a.repairCost || a.cost).toLocaleString() : '-'}</td>` : ''}
                    <td>${a.isHandled ? 'טופל' : 'טרם&nbsp;טופל'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    }

    // D. Gallery
    if (photos.length > 0) {
        html += `<div class="pdf-section"><h3 class="pdf-section-title" style="margin-top:24px;">גלריית&nbsp;תמונות&nbsp;הרכב</h3>
        <div class="pdf-gallery-grid">`;
        photos.forEach(src => {
            html += `
            <div class="pdf-gallery-item">
                <img src="${src}" alt="Car Image" crossorigin="anonymous">
            </div>`;
        });
        html += `</div></div>`;
    }

    document.getElementById('pdf-dynamic-content').innerHTML = html;

    // Footer Time
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('pdf-footer-time').innerHTML = `<div style="display: flex; align-items: center; justify-content: center; direction: rtl; gap: 4px;">
        <span>הופק ב-</span>
        <span style="font-family: Arial, sans-serif;" dir="ltr">EasyCare</span>
        <span>בתאריך ${dateStr} | ${timeStr}</span>
    </div>`;

    // 5. PDF Options & Export with Enterprise Settings
    const content = document.getElementById('pdf-content');
    const container = document.getElementById('pdf-export-container');
    
    // Temporarily show the container for html2canvas
    container.style.display = 'block';

    // UI Feedback
    const banner = document.querySelector('.sell-hero-banner');
    const originalContent = banner.innerHTML;
    banner.innerHTML = `
        <div class="py-4">
            <div class="spinner-border text-light mb-3" role="status"></div>
            <h3 class="text-white fw-bold">מייצר דוח פרימיום...</h3>
            <p class="text-white-50">מעבד את נתוני הרכב למסמך רשמי וממורכז (Enterprise Grade)</p>
        </div>
    `;

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `EasyCare_Report_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            letterRendering: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(content).save().then(() => {
        container.style.display = 'none';
        banner.innerHTML = originalContent;
    }).catch(err => {
        console.error("PDF Export Error:", err);
        alert("שגיאה בהפקת הדוח. אנא נסה שנית.");
        container.style.display = 'none';
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
