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

    const brand = currentCar.brandHeb || currentCar.brand || '';
    const validLogo = currentCar.logo && !currentCar.logo.includes('default.png');
    const logoSource = validLogo ? `<img src="${currentCar.logo}" style="height: 60px; object-fit: contain;">` : '';

    const reliabilityScore = window.calculateReliability ? window.calculateReliability(currentCar).score : '--';

    // Build Seller Pitch Module
    let sellerPitchHtml = "";
    if (s.sellerComment && s.sellerComment.length > 0) {
        sellerPitchHtml = `
        <div style="background: #f8fafc; border-right: 4px solid #3b82f6; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
            <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6; font-style: italic;">
                "${s.sellerComment}"
            </p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: bold;">-- הערות המוכר</p>
        </div>`;
    }

    // Modern Header structure
    // FIX: Wrapping in a fixed width container (800px) that matches windowWidth in options to prevent floating issues.
    let html = `
        <div style="width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; direction: rtl; text-align: right; color: #0f172a; padding: 40px; background: #ffffff; box-sizing: border-box;">
            
            <!-- OFFICIAL CERTIFICATE HEADER -->
            <table width="100%" dir="rtl" style="margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
                <tr>
                    <td style="vertical-align: middle; text-align: right;">
                        <span style="font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #3b82f6; text-transform: uppercase;">TRANSPARENCY CERTIFICATE</span>
                        <h1 style="color: #0f172a; margin: 5px 0 0 0; font-size: 34px; font-weight: 800; letter-spacing: -0.5px;">תעודת מערכת - דוח רכב</h1>
                        <p style="margin: 5px 0 0 0; font-size: 16px; color: #64748b; font-weight: 500;"> ${brand} ${currentCar.model || ''} - מספר רישוי: <span style="background: #fbbf24; color: black; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: bold; border: 1px solid #d97706;" dir="ltr">${currentCar.licensePlate}</span></p>
                    </td>
                    <td style="vertical-align: middle; text-align: left; width: 120px;">
                        ${logoSource}
                    </td>
                </tr>
            </table>

            ${sellerPitchHtml}

            <!-- CAR METRICS ROW -->
            <table width="100%" dir="rtl" style="margin-bottom: 30px; table-layout: fixed;">
                <tr>
                    <td style="padding: 15px; background: #f8fafc; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; width: 23%;">
                        <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 5px;">שנת ייצור</div>
                        <div style="font-size: 20px; color: #0f172a; font-weight: 800;">${currentCar.year || '-'}</div>
                    </td>
                    <td style="width: 2%;"></td>
                    <td style="padding: 15px; background: #f8fafc; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; width: 23%;">
                        <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 5px;">קילומטראז'</div>
                        <div style="font-size: 20px; color: #0f172a; font-weight: 800;">${currentCar.km ? currentCar.km.toLocaleString() : '-'}</div>
                    </td>
                    <td style="width: 2%;"></td>
                    <td style="padding: 15px; background: #f8fafc; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; width: 23%;">
                        <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 5px;">מועד טסט הבא</div>
                        <div style="font-size: 20px; color: #0f172a; font-weight: 800;">${currentCar.testDate || '-'}</div>
                    </td>
                    <td style="width: 2%;"></td>
                    <td style="padding: 15px; background: #f0f9ff; border-radius: 16px; text-align: center; border: 1px solid #bae6fd; width: 23%;">
                        <div style="font-size: 12px; color: #0284c7; font-weight: 600; margin-bottom: 5px;">ציון אמינות</div>
                        <div style="font-size: 22px; color: #0369a1; font-weight: 800;">${reliabilityScore}%</div>
                    </td>
                </tr>
            </table>

            <!-- SPECS GRID -->
            <div style="margin-bottom: 35px;">
                <h3 style="font-size: 16px; font-weight: 800; color: #334155; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">מפרט טכני</h3>
                <table width="100%" dir="rtl" style="font-size: 14px; text-align: right;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0; width: 50%;"><strong>סוג מנוע:</strong> ${currentCar.fuelType || '-'}</td>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0; width: 50%;"><strong>צבע רכב:</strong> ${currentCar.color || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0;"><strong>כוח סוס:</strong> ${currentCar.horsePower ? currentCar.horsePower + ' כ"ס' : '-'}</td>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0;"><strong>נפח מנוע:</strong> ${currentCar.engineVolume ? currentCar.engineVolume + ' סמ"ק' : '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0;"><strong>צמיגים קדמיים:</strong> <span dir="ltr">${currentCar.tireFront || '-'}</span></td>
                        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0;"><strong>צמיגים אחוריים:</strong> <span dir="ltr">${currentCar.tireRear || '-'}</span></td>
                    </tr>
                </table>
            </div>

            <!-- DYNAMIC BLOCKS BASED ON FILTERS -->
    `;

    // 1. Treatments
    if (s.showTreatments) {
        const trs = currentCar.treatments || [];
        html += `<h3 style="font-size: 16px; font-weight: 800; color: #059669; margin-bottom: 15px; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">לוג טיפולים ${trs.length ? `(${trs.length})` : ''}</h3>`;
        if (trs.length === 0) {
            html += `<p style="color: #64748b; font-size: 13px;">לא הוכנס תיעוד במערכת.</p>`;
        } else {
            html += `<table width="100%" dir="rtl" style="border-collapse: collapse; font-size: 13px; text-align: right; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #475569; font-weight: bold;">
                                <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">תאריך</th>
                                <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">תיאור הטיפול</th>
                                <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">מוסך מבצע</th>
                                <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">ק"מ</th>`;
            if (s.showCosts) html += `<th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">עלות</th>`;
            html += `</tr></thead><tbody>`;
            
            trs.slice().reverse().forEach(t => {
                html += `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;" dir="ltr">${t.date ? t.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${t.name || t.type || '-'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${t.garage || '-'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${t.km ? t.km.toLocaleString() : '-'}</td>`;
                if (s.showCosts) {
                    html += `<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #10b981; font-weight: bold;">${t.cost ? '₪' + t.cost.toLocaleString() : '-'}</td>`;
                }
                html += `</tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    // 2. Insurance Data
    if (s.showInsurance) {
        const ins = currentCar.insurance || {};
        const mandatory = ins.mandatory || {};
        const comp = ins.comprehensive || ins.thirdparty || {};
        const compType = ins.comprehensive ? 'מקיף' : (ins.thirdparty ? "צד ג'" : "-");
        
        html += `<h3 style="font-size: 16px; font-weight: 800; color: #2563eb; margin-bottom: 15px; margin-top: 35px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">שקיפות מידע ביטוחי</h3>`;
        html += `
        <div style="display: flex; justify-content: space-between; gap: 20px;">
            <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background: #ffffff;">
                <div style="font-size: 12px; color: #64748b; font-weight:bold;">ביטוח חובה</div>
                <div style="font-size: 15px; color: #0f172a; font-weight:bold; margin-top: 5px;">${mandatory.company || 'לא מוגדר'}</div>
                <div style="font-size: 13px; color: #475569; margin-top: 4px;">תוקף: ${mandatory.date ? mandatory.date.split('-').reverse().join('/') : '-'}</div>
                ${s.showCosts ? `<div style="font-size: 14px; color: #10b981; font-weight: bold; margin-top: 8px;">₪${mandatory.cost || '-'} לשנה</div>` : ''}
            </div>
            <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background: #ffffff;">
                <div style="font-size: 12px; color: #64748b; font-weight:bold;">ביטוח המשך (${compType})</div>
                <div style="font-size: 15px; color: #0f172a; font-weight:bold; margin-top: 5px;">${comp.company || 'לא מוגדר'}</div>
                <div style="font-size: 13px; color: #475569; margin-top: 4px;">תוקף: ${comp.date ? comp.date.split('-').reverse().join('/') : '-'}</div>
                ${s.showCosts ? `<div style="font-size: 14px; color: #10b981; font-weight: bold; margin-top: 8px;">₪${comp.cost || '-'} לשנה</div>` : ''}
            </div>
        </div>`;
    }

    // 3. Accidents / Anomalies
    if (s.showAccidents) {
        const accs = currentCar.accidents || [];
        html += `<h3 style="font-size: 16px; font-weight: 800; color: #ef4444; margin-bottom: 15px; margin-top: 35px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">חריגים ותאונות יום ${accs.length ? `(${accs.length})` : ''}</h3>`;
        if (accs.length === 0) {
            html += `<div style="padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #16a34a; font-size: 14px;"><strong>מצוין!</strong> רכב זה הוגדר במערכת כנקי ללא היסטוריית תאונות או נזקים מתועדים.</div>`;
        } else {
            html += `<table width="100%" dir="rtl" style="border-collapse: collapse; font-size: 13px; text-align: right; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #fef2f2; color: #991b1b; font-weight: bold;">
                                <th style="padding: 12px; border-bottom: 1px solid #fecaca;">תאריך הנזק</th>
                                <th style="padding: 12px; border-bottom: 1px solid #fecaca;">סיווג ולוג נזק</th>`;
            if (s.showCosts) html += `<th style="padding: 12px; border-bottom: 1px solid #fecaca;">עלות / ירידת ערך</th>`;
            html += `</tr></thead><tbody>`;
            
            accs.forEach(a => {
                html += `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #fecaca; color: #7f1d1d;" dir="ltr">${a.date ? a.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #fecaca; font-weight: bold; color: #7f1d1d;">${a.title || 'פגיעה כללית'} <span style="font-weight:normal; color:#991b1b;">- ${a.description||''}</span></td>`;
                if (s.showCosts) {
                    html += `<td style="padding: 12px; border-bottom: 1px solid #fecaca; color: #991b1b;">${a.repairCost ? '₪' + a.repairCost.toLocaleString() : '-'}</td>`;
                }
                html += `</tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    // Official Footer stamp
    html += `
            <div style="text-align: center; margin-top: 45px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;" dir="rtl">
                מסמך שקיפות זה הופרש רשמית ממערכת EasyCare.<br>
                יוצר עבור ${currentCar.licensePlate} בתאריך ${new Date().toLocaleDateString('he-IL')} שעה ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}. מסמך זה כפוף לבדיקת קניה ולמקוריות הנתוניםשהוזנו למערכת.
            </div>
        </div>
    `;

    // ADDED LOGIC FOR PHOTO GALLERY CARDS
    let mediaHtml = '';
    if (photos.length > 0) {
        mediaHtml += `<div class="html2pdf__page-break"></div>
        <div style="width: 800px; margin: 0 auto; font-family: -apple-system, sans-serif; direction: rtl; padding: 40px; background: #ffffff; box-sizing: border-box;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 800;">נספח תמונות רכב: מוכנות פומבית</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 30px;">`;
        photos.forEach(img => {
            mediaHtml += `<div style="width: 47%; height: 320px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">
                <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>`;
        });
        mediaHtml += `</div></div>`;
    }

    const finalDocumentHTML = html + mediaHtml;

    // Load state
    const btn = document.querySelector('.sell-hero-banner');
    let originalText = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<h3 class="text-white text-center mt-3"><i class="fas fa-spinner fa-spin me-2"></i> מפיק תעודת רכב מקצועית...</h3>';

    const opt = {
        margin: 0,
        filename: `EasyCare_Certificate_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
        html2pdf().set(opt).from(finalDocumentHTML).save().then(() => {
            if (btn) btn.innerHTML = originalText;
        }).catch(err => {
            alert("שגיאת יצוא.");
            if (btn) btn.innerHTML = originalText;
        });
    } catch (e) {
        if (btn) btn.innerHTML = originalText;
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
