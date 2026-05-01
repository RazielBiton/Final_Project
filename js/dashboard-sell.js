// --- SELL & TRADE-IN DASHBOARD MODULE ---

window.loadSell = function () {
    if(!currentCar) return;
    
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
    
    if(tTreatments) tTreatments.checked = s.showTreatments !== false;
    if(tCosts) tCosts.checked = s.showCosts !== false;
    if(tInsurance) tInsurance.checked = s.showInsurance !== false;
    if(tAccidents) tAccidents.checked = s.showAccidents !== false;
    if(tComment) tComment.value = s.sellerComment || "";

    window.renderGallery();
};

window.saveSellSettings = function () {
    if(!currentCar) return;
    if(!currentCar.sellSettings) currentCar.sellSettings = {};
    
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

    saveToLocalStorage();
    console.log("Sell settings saved privately: ", currentCar.sellSettings);
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

/* --- PREMIUM PDF GENERATOR (Apple Certificate Style) --- */
window.generateFullPDFReport = function () {
    if (!currentCar) return;

    // REQUIREMENT: Minimum 3 photos
    const photos = currentCar.gallery || [];
    if (photos.length < 3) {
        alert('יש להעלות לפחות 3 תמונות לגלריה כדי להפיק דוח PDF רשמי.');
        return;
    }

    window.saveSellSettings(); // Sync state before generating
    
    console.log("Generating Premium PDF Export...");
    const s = currentCar.sellSettings;

    // 1. Populate Header
    const brand = currentCar.brandHeb || currentCar.brand || '';
    document.getElementById('pdf-subtitle').innerText = `${brand} ${currentCar.model || ''} - מספר רישוי: ${currentCar.licensePlate}`;
    
    const validLogo = currentCar.logo && !currentCar.logo.includes('default.png');
    document.getElementById('pdf-logo').src = validLogo ? currentCar.logo : '';
    document.getElementById('pdf-logo').style.display = validLogo ? 'block' : 'none';

    // 2. Populate Seller Pitch
    const pitchContainer = document.getElementById('pdf-seller-pitch-container');
    if (s.sellerComment && s.sellerComment.trim().length > 0) {
        document.getElementById('pdf-seller-pitch-text').innerText = `"${s.sellerComment}"`;
        pitchContainer.style.display = 'block';
    } else {
        pitchContainer.style.display = 'none';
    }

    // 3. Populate Metrics
    const reliabilityScore = window.calculateReliability ? window.calculateReliability(currentCar).score : '--';
    document.getElementById('pdf-metric-year').innerText = currentCar.year || '-';
    document.getElementById('pdf-metric-km').innerText = currentCar.km ? currentCar.km.toLocaleString() : '-';
    document.getElementById('pdf-metric-test').innerText = currentCar.testDate || '-';
    document.getElementById('pdf-metric-score').innerText = `${reliabilityScore}%`;

    // 4. Populate Specs
    document.getElementById('pdf-spec-fuel').innerText = currentCar.fuelType || '-';
    document.getElementById('pdf-spec-color').innerText = currentCar.color || '-';
    document.getElementById('pdf-spec-hp').innerText = currentCar.horsePower ? currentCar.horsePower + ' כ"ס' : '-';
    document.getElementById('pdf-spec-engine').innerText = currentCar.engineVolume ? currentCar.engineVolume + ' סמ"ק' : '-';
    document.getElementById('pdf-spec-tiref').innerText = currentCar.tireFront || '-';
    document.getElementById('pdf-spec-tirer').innerText = currentCar.tireRear || '-';

    // 5. Build Dynamic Content (Treatments, Insurance, Accidents)
    let dynamicHtml = '';

    // Treatments
    if (s.showTreatments) {
        const trs = currentCar.treatments || [];
        dynamicHtml += `<h3 class="pdf-section-title" style="color: #059669; margin-top: 30px;">לוג טיפולים ${trs.length ? `(${trs.length})` : ''}</h3>`;
        if (trs.length === 0) {
            dynamicHtml += `<p style="color: #64748b; font-size: 13px;">לא הוכנס תיעוד במערכת.</p>`;
        } else {
            dynamicHtml += `<table class="pdf-table">
                <thead><tr>
                    <th>תאריך</th>
                    <th>תיאור הטיפול</th>
                    <th>מוסך מבצע</th>
                    <th>ק"מ</th>
                    ${s.showCosts ? '<th>עלות</th>' : ''}
                </tr></thead><tbody>`;
            trs.slice().reverse().forEach(t => {
                dynamicHtml += `<tr>
                    <td dir="ltr">${t.date ? t.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="font-weight: bold; color: #0f172a;">${t.name || t.type || '-'}</td>
                    <td>${t.garage || '-'}</td>
                    <td>${t.km ? t.km.toLocaleString() : '-'}</td>
                    ${s.showCosts ? `<td style="color: #10b981; font-weight: bold;">${t.cost ? '₪' + t.cost.toLocaleString() : '-'}</td>` : ''}
                </tr>`;
            });
            dynamicHtml += `</tbody></table>`;
        }
    }

    // Insurance
    if (s.showInsurance) {
        const ins = currentCar.insurance || {};
        const mandatory = ins.mandatory || {};
        const comp = ins.comprehensive || ins.thirdparty || {};
        const compType = ins.comprehensive ? 'מקיף' : (ins.thirdparty ? "צד ג'" : "-");
        
        dynamicHtml += `<h3 class="pdf-section-title" style="color: #2563eb; margin-top: 30px;">שקיפות מידע ביטוחי</h3>
        <div class="pdf-insurance-grid">
            <div class="pdf-ins-card">
                <div class="pdf-ins-label">ביטוח חובה</div>
                <div class="pdf-ins-company">${mandatory.company || 'לא מוגדר'}</div>
                <div class="pdf-ins-date">תוקף: ${mandatory.date ? mandatory.date.split('-').reverse().join('/') : '-'}</div>
                ${s.showCosts ? `<div class="pdf-ins-cost">₪${mandatory.cost || '-'} לשנה</div>` : ''}
            </div>
            <div class="pdf-ins-card">
                <div class="pdf-ins-label">ביטוח המשך (${compType})</div>
                <div class="pdf-ins-company">${comp.company || 'לא מוגדר'}</div>
                <div class="pdf-ins-date">תוקף: ${comp.date ? comp.date.split('-').reverse().join('/') : '-'}</div>
                ${s.showCosts ? `<div class="pdf-ins-cost">₪${comp.cost || '-'} לשנה</div>` : ''}
            </div>
        </div>`;
    }

    // Accidents
    if (s.showAccidents) {
        const accs = currentCar.accidents || [];
        dynamicHtml += `<h3 class="pdf-section-title" style="color: #ef4444; margin-top: 30px;">חריגים ותאונות מתועדות ${accs.length ? `(${accs.length})` : ''}</h3>`;
        if (accs.length === 0) {
            dynamicHtml += `<div style="padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #16a34a; font-size: 13px;"><strong>מצוין!</strong> רכב זה מוגדר במערכת כנקי ללא היסטוריית תאונות או נזקים מתועדים.</div>`;
        } else {
            dynamicHtml += `<table class="pdf-table" style="border-color: #fecaca;">
                <thead><tr style="background: #fef2f2; color: #991b1b;">
                    <th style="border-color: #fecaca;">תאריך הנזק</th>
                    <th style="border-color: #fecaca;">סיווג ולוג נזק</th>
                    ${s.showCosts ? '<th style="border-color: #fecaca;">עלות / ירידת ערך</th>' : ''}
                </tr></thead><tbody>`;
            accs.forEach(a => {
                dynamicHtml += `<tr>
                    <td dir="ltr" style="border-color: #fecaca; color: #7f1d1d;">${a.date ? a.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="border-color: #fecaca; font-weight: bold; color: #7f1d1d;">${a.title || 'פגיעה כללית'} <span style="font-weight:normal; color:#991b1b;">- ${a.description||''}</span></td>
                    ${s.showCosts ? `<td style="border-color: #fecaca; color: #991b1b;">${a.repairCost ? '₪' + a.repairCost.toLocaleString() : '-'}</td>` : ''}
                </tr>`;
            });
            dynamicHtml += `</tbody></table>`;
        }
    }

    // Gallery (Appended directly to dynamicHtml with a page break)
    if (photos.length > 0) {
        dynamicHtml += `<div class="pdf-page-break"></div>
        <h2 class="pdf-title" style="margin-bottom: 20px;">נספח תמונות רכב</h2>
        <div class="pdf-gallery-grid">`;
        photos.forEach(img => {
            dynamicHtml += `<div class="pdf-gallery-item"><img src="${img}" alt="Car Photo"></div>`;
        });
        dynamicHtml += `</div>`;
    }

    document.getElementById('pdf-dynamic-content').innerHTML = dynamicHtml;

    // Footer Time
    document.getElementById('pdf-footer-time').innerText = `הופק בתאריך ${new Date().toLocaleDateString('he-IL')} שעה ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

    // Prepare container
    const container = document.getElementById('pdf-export-container');
    container.style.display = 'block';

    const btn = document.querySelector('.sell-hero-banner');
    let originalText = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<h3 class="text-white text-center mt-3"><i class="fas fa-spinner fa-spin me-2"></i> מפיק תעודת רכב מקצועית...</h3>';

    // PDF Options
    const opt = {
        margin:       0,
        filename:     `EasyCare_Certificate_${currentCar.licensePlate}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Generate
    try {
        html2pdf().set(opt).from(container.querySelector('.pdf-document')).save().then(() => {
            if (btn) btn.innerHTML = originalText;
            container.style.display = 'none';
        }).catch(err => {
            alert("שגיאת יצוא.");
            if (btn) btn.innerHTML = originalText;
            container.style.display = 'none';
        });
    } catch (e) {
        if (btn) btn.innerHTML = originalText;
        container.style.display = 'none';
    }
};

window.renderGallery = function () {
    const grid = document.getElementById('sellGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!currentCar.gallery) currentCar.gallery = [];

    if (currentCar.gallery.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted small py-4" style="background: #f8fafc; border-radius: 12px;">מערכת ההדפסה והצגת הרכב תשמח לתמונת השוויצה מציאותית. הוסף לכאן.</div>';
        return;
    }

    currentCar.gallery.forEach((imgBase64, index) => {
        grid.innerHTML += `
            <div class="col-6 col-md-4 position-relative mt-3">
                <div style="border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02); height: 160px;">
                    <img src="${imgBase64}" class="w-100 h-100" style="object-fit: cover;">
                    <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle shadow-sm d-flex align-items-center justify-content-center hover-lift" onclick="window.deleteGalleryImage(${index})" style="width:30px; height:30px; padding:0;">
                        <i class="fas fa-trash-alt" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        `;
    });
};

window.handleGalleryUpload = function (event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!currentCar.gallery) currentCar.gallery = [];

    // REQUIREMENT: Maximum 10 photos
    if (currentCar.gallery.length + files.length > 10) {
        alert(`ניתן להעלות עד 10 תמונות בלבד. כרגע קיימות ${currentCar.gallery.length} תמונות.`);
        return;
    }

    const btnInput = event.target;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentCar.gallery.push(e.target.result);
            try {
                window.saveToLocalStorage();
                window.renderGallery();
            } catch (err) {
                currentCar.gallery.pop();
                alert('התמונה חורגת מנפח הזיכרון. רצוי להעלות תמונות קטנות מ-2MB למערכת חופשית היברידית.');
            }
        };
        reader.readAsDataURL(file);
    });
    btnInput.value = '';
};

window.deleteGalleryImage = function (index) {
    if (confirm('האם אתה בטוח שברצונך למחוק תמונה זו? היא תרד גם מהדוח הרשמי.')) {
        currentCar.gallery.splice(index, 1);
        window.saveToLocalStorage();
        window.renderGallery();
    }
};
