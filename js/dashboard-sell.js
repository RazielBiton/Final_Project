window.loadSell = function () {
    // Initialization if needed
};

window.generateStickerQR = function () {
    if (!currentCar) return;

    // Clear previous QR
    const qrContainer = document.getElementById('qrcode');
    if (qrContainer) qrContainer.innerHTML = '';

    // Basic base64 encode for ID to pass via URL
    // For a real app, you'd pass the DB ID. Here we mock it by passing currentCar.id.
    // Ensure the host is correct (assuming same host)
    const host = window.location.origin + window.location.pathname.replace('dashboard.html', '');
    const landingUrl = `${host}public_report.html?id=${currentCar.id}`;

    new QRCode(qrContainer, {
        text: landingUrl,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Add download button if it doesn't exist
    const modalBody = qrContainer.parentElement;
    if (!document.getElementById('downloadQrBtn')) {
        const btn = document.createElement('button');
        btn.id = 'downloadQrBtn';
        btn.className = 'btn btn-primary w-100 mt-3 fw-bold';
        btn.innerHTML = '<i class="fas fa-download me-2"></i> הורד מדבקת סריקה (QR)';
        btn.onclick = function () {
            const img = qrContainer.querySelector('img');
            if (img) {
                const link = document.createElement('a');
                link.download = `QR_Sale_${currentCar.licensePlate}.png`;
                link.href = img.src;
                link.click();
            } else {
                // For browsers where canvas is used instead of img by qrcode.js
                const canvas = qrContainer.querySelector('canvas');
                if (canvas) {
                    const link = document.createElement('a');
                    link.download = `QR_Sale_${currentCar.licensePlate}.png`;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                }
            }
        };
        modalBody.appendChild(btn);
    }
};

window.generateFullPDFReport = function () {
    console.log("PDF Generation triggered. Checking currentCar...");
    if (!currentCar) {
        console.warn("currentCar is not defined. Aborting.");
        return;
    }
    console.log("Building PDF for:", currentCar.licensePlate);

    const brand = currentCar.brandHeb || currentCar.brand || '';
    const validLogo = currentCar.logo && !currentCar.logo.includes('default.png');
    const logoSource = validLogo ? `<img src="${currentCar.logo}" style="width: 80px; height: 80px; object-fit: contain;">` : '';

    // Calculate total expenses roughly
    let totalExpenses = 0;
    const treatments = currentCar.treatments || [];
    const acc = currentCar.accidents || [];

    if (treatments.length > 0) treatments.forEach(t => { if (t.cost) totalExpenses += parseFloat(t.cost); });
    if (currentCar.insurance && currentCar.insurance.cost) totalExpenses += parseFloat(currentCar.insurance.cost);

    // Initial HTML setup with premium typography and structured grid layout
    let html = `
        <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; color: #212529; padding: 30px; background: #fff;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d6efd; padding-bottom: 20px; margin-bottom: 30px;">
                <div>
                    <h1 style="color: #0d6efd; margin: 0; font-size: 32px; font-weight: 700;">דוח שקיפות רכב מלא - ${brand}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 16px; color: #6c757d;">הופק באמצעות ממשק הניהול של EasyCare</p>
                </div>
                <div>${logoSource}</div>
            </div>

            <!-- Vehicle Summary Grid -->
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 25px; margin-bottom: 35px; display: flex; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <div style="flex: 1;">
                    <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #212529;">פרטי רכב בסיסיים</h2>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>יצרן ודגם:</strong> ${brand} ${currentCar.model || ''}</p>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>מספר רישוי:</strong> <span style="background: #ffeb3b; padding: 2px 8px; border-radius: 4px; border: 1px solid #212529; font-weight:bold;">${currentCar.licensePlate}</span></p>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>שנת ייצור:</strong> ${currentCar.year || '-'}</p>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>קילומטראז' נוכחי:</strong> ${currentCar.km ? currentCar.km.toLocaleString() : '-'}</p>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>צבע הרכב:</strong> ${currentCar.color || '-'}</p>
                </div>
                <div style="flex: 1; text-align: left;">
                    <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #f8f9fa;">-</h2>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>טסט בתוקף עד:</strong> ${currentCar.testDate || 'אין נתונים'}</p>
                    <p style="margin: 8px 0; font-size: 16px;"><strong>ציון אמינות משוער:</strong> <span style="color: #0d6efd; font-weight: bold;">${window.calculateReliability ? window.calculateReliability(currentCar) : '--'}%</span></p>
                    <p style="margin: 8px 0; font-size: 16px; color: #dc3545;"><strong>סך הוצאות מתועדות:</strong> מחושב סביב ₪${totalExpenses.toLocaleString()}</p>
                </div>
            </div>

            <!-- Technical Specs Section -->
            <h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> מפרט טכני</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6;">
                <tr>
                    <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%;"><strong>כוח סוס (כ"ס)</strong></td>
                    <td style="padding: 12px; border: 1px solid #dee2e6; width: 25%;">${currentCar.horsePower || '-'}</td>
                    <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%;"><strong>נפח מנוע (סמ"ק)</strong></td>
                    <td style="padding: 12px; border: 1px solid #dee2e6; width: 25%;">${currentCar.engineVolume || '-'}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>צמיגים קדמיים</strong></td>
                    <td style="padding: 12px; border: 1px solid #dee2e6;">${currentCar.tireFront || '-'}</td>
                    <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>צמיגים אחוריים</strong></td>
                    <td style="padding: 12px; border: 1px solid #dee2e6;">${currentCar.tireRear || '-'}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>סוג מנוע / דלק</strong></td>
                    <td style="padding: 12px; border: 1px solid #dee2e6;" colspan="3">${currentCar.fuelType || '-'}</td>
                </tr>
            </table>

            <!-- Treatments Section -->
            ${generateTreatmentsHTML()}

            <!-- Insurance Section -->
            ${generateInsuranceHTML()}

            <!-- Fuel & Accidents Sections -->
            ${generateLogsHTML()}

            <!-- End of main info page footer -->
            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 12px;">
                מסמך זה מהווה ריכוז של הנתונים שהוזנו במערכת. על הקונה לוודא פרטים בבדיקת הרכב.<br>
                יוצר עבור מזהה רישוי ${currentCar.licensePlate} בתאריך ${new Date().toLocaleDateString('he-IL')}
            </div>
        </div>
    `;

    // --- Media Appendices: Iterate and add Page Breaks for Images ---
    let mediaHtml = '';

    // Treatments Images
    treatments.forEach(t => {
        if (t.invoice && t.invoice.startsWith('data:image')) {
            mediaHtml += `
                <div class="html2pdf__page-break"></div>
                <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; padding: 40px; background: #fff;">
                    <h2 style="color: #0d6efd; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">נספח: חשבונית טיפול מאומתת</h2>
                    <p style="font-size: 16px;"><strong>שם הטיפול:</strong> ${t.name || '-'}</p>
                    <p style="font-size: 16px;"><strong>מוסך:</strong> ${t.garage || '-'}</p>
                    <p style="font-size: 16px;"><strong>תאריך:</strong> ${t.date ? t.date.split('-').reverse().join('/') : '-'}</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <img src="${t.invoice}" style="max-width: 100%; max-height: 850px; border: 1px solid #dee2e6; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    </div>
                </div>
            `;
        }
    });

    // Accidents Images (Future proofing)
    acc.forEach(a => {
        if (a.image && a.image.startsWith('data:image')) {
            mediaHtml += `
                <div class="html2pdf__page-break"></div>
                <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; padding: 40px; background: #fff;">
                    <h2 style="color: #dc3545; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">נספח: תיעוד תאונה/נזק</h2>
                    <p style="font-size: 16px;"><strong>תיאור:</strong> ${a.description || '-'}</p>
                    <p style="font-size: 16px;"><strong>תאריך:</strong> ${a.date ? a.date.split('-').reverse().join('/') : '-'}</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <img src="${a.image}" style="max-width: 100%; max-height: 850px; border: 1px solid #dee2e6; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    </div>
                </div>
            `;
        }
    });

    // Combine Data and Media
    const finalDocumentHTML = html + mediaHtml;
    console.log("HTML Template structured successfully. String length:", finalDocumentHTML.length);

    // Show loading text on the triggering button
    const btn = document.querySelector('.action-card button') || document.querySelector('.sell-hero-banner');
    let originalText = '';
    if (btn && btn.tagName === 'BUTTON') {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> מפיק מסמך בקידוד איכותי...';
    }

    console.log("Dispatching string to html2pdf engine...");

    // Configure html2pdf to use the Raw String natively
    const opt = {
        margin: [0.25, 0, 0.25, 0], // Top and bottom margins so text isn't cut off at printer edges
        filename: `Transparency_Report_${currentCar.licensePlate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, imageTimeout: 15000 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Passing the string directly delegates the safe off-screen layout generation entirely to html2pdf itself!
    try {
        html2pdf().set(opt).from(finalDocumentHTML).save().then(() => {
            console.log("PDF generated and saved successfully.");
            if (btn && btn.tagName === 'BUTTON') btn.innerHTML = originalText;
        }).catch(err => {
            console.error("PDF generation promise rejection:", err);
            alert("אירעה שגיאה אינטרנטית בשמירת ה-PDF. אנא בדוק חיבור, נסה שוב או רענן.");
            if (btn && btn.tagName === 'BUTTON') btn.innerHTML = originalText;
        });
    } catch (e) {
        console.error("Critical synchronous error firing html2pdf:", e);
        if (btn && btn.tagName === 'BUTTON') btn.innerHTML = originalText;
    }

    // --- Helper HTML Generators ---

    function generateTreatmentsHTML() {
        if (treatments.length === 0) return `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> ציר זמן טיפולים ותחזוקה</h3><p style="color: #6c757d;">לא תועדו טיפולים.</p>`;

        let tHTML = `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> היסטוריית טיפולים ותחזוקה (${treatments.length})</h3>`;
        tHTML += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6;">
                    <thead><tr style="background: #e9ecef;">
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6; width: 15%;">תאריך</th>
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6; width: 30%;">שם הטיפול</th>
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6; width: 20%;">מוסך</th>
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">ק"מ</th>
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">עלות (₪)</th>
                        <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">חשבונית</th>
                    </tr></thead><tbody>`;
        treatments.forEach(t => {
            tHTML += `<tr>
                <td style="padding: 10px; border: 1px solid #dee2e6;">${t.date ? t.date.split('-').reverse().join('/') : '-'}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>${t.name || '-'}</strong></td>
                <td style="padding: 10px; border: 1px solid #dee2e6;">${t.garage || '-'}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6;">${t.km ? t.km.toLocaleString() : '-'}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6;">${t.cost ? t.cost.toLocaleString() : '-'}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold; color: ${t.invoice ? '#198754' : '#6c757d'};">${t.invoice ? 'מצורפת בנספח ✔' : 'ללא אימות'}</td>
            </tr>`;
        });
        tHTML += `</tbody></table>`;
        return tHTML;
    }

    function generateInsuranceHTML() {
        const ins = currentCar.insurance || {};
        return `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> נתונים ביטוחיים</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6;">
            <tr>
                <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>חברת ביטוח</strong></td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${ins.company || '-'}</td>
                <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>סוג מקיף/צד ג'</strong></td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${ins.type || '-'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>תוקף ביטוח חובה</strong></td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${ins.mandatoryExp ? ins.mandatoryExp.split('-').reverse().join('/') : '-'}</td>
                <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>תוקף מקיף/צד ג'</strong></td>
                <td style="padding: 12px; border: 1px solid #dee2e6;">${ins.comprehensiveExp ? ins.comprehensiveExp.split('-').reverse().join('/') : '-'}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa;"><strong>הערכה כספית (₪)</strong></td>
                <td style="padding: 12px; border: 1px solid #dee2e6;" colspan="3">${ins.cost ? ins.cost.toLocaleString() : '-'}</td>
            </tr>
        </table>`;
    }

    function generateLogsHTML() {
        let rHTML = '';

        // Fuels
        const fuels = currentCar.fuelLog || [];
        if (fuels.length > 0) {
            rHTML += `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> היסטוריית תדלוקים (5 אחרונים)</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6;">
                <thead><tr style="background: #e9ecef;">
                    <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">תאריך</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">ליטרים</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">עלות מתועדת (₪)</th>
                </tr></thead><tbody>`;
            fuels.slice(0, 5).forEach(f => {
                rHTML += `<tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${f.date ? f.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${f.liters ? parseFloat(f.liters).toFixed(2) : '-'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${f.cost ? f.cost.toLocaleString() : '-'}</td>
                </tr>`;
            });
            rHTML += `</tbody></table>`;
        }

        // Accidents
        if (acc.length > 0) {
            rHTML += `<h3 style="border-bottom: 2px solid #dc3545; color: #dc3545; padding-bottom: 10px; margin-top: 35px; font-size: 20px;"> היסטוריית תאונות מדווחות (${acc.length})</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #f5c2c7;">
                <thead><tr style="background: #f8d7da; color: #842029;">
                    <th style="padding: 10px; text-align: right; border: 1px solid #f5c2c7;">תאריך</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #f5c2c7;">תיאור / מיקום</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #f5c2c7;">עלות סיווג / נזק (₪)</th>
                </tr></thead><tbody>`;
            acc.forEach(a => {
                rHTML += `<tr>
                    <td style="padding: 10px; border: 1px solid #f5c2c7;">${a.date ? a.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 10px; border: 1px solid #f5c2c7;">${a.description || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #f5c2c7;">${a.damageCost ? a.damageCost.toLocaleString() : '-'}</td>
                </tr>`;
            });
            rHTML += `</tbody></table>`;
        }

        return rHTML;
    }
};

// --- VEHICLE PHOTO GALLERY ADMIN LOGIC ---

window.renderGallery = function () {
    const grid = document.getElementById('sellGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!currentCar.gallery) currentCar.gallery = [];

    if (currentCar.gallery.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted small py-3">לא הועלו תמונות טרם.</div>';
        return;
    }

    currentCar.gallery.forEach((imgBase64, index) => {
        grid.innerHTML += `
            <div class="col-6 col-md-3 position-relative mt-3">
                <img src="${imgBase64}" class="img-fluid rounded border shadow-sm w-100" style="height: 140px; object-fit: cover;">
                <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle shadow d-flex align-items-center justify-content-center" onclick="window.deleteGalleryImage(${index})" style="width:28px; height:28px; padding:0; line-height:1;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
};

window.handleGalleryUpload = function (event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!currentCar.gallery) currentCar.gallery = [];

    const btnInput = event.target;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentCar.gallery.push(e.target.result);
            try {
                window.saveToLocalStorage();
                window.renderGallery();
            } catch (err) {
                console.error("Storage Error:", err);
                currentCar.gallery.pop(); // Revert the last photo push
                alert('שגיאה: התמונה גדולה מדי לחלל האחסון המקומי. אנא נסה לכווץ אותה או לבחור תמונה ששוקלת פחות מ-2MB.');
            }
        };
        reader.readAsDataURL(file);
    });

    // reset input
    btnInput.value = '';
};

window.deleteGalleryImage = function (index) {
    if (confirm('האם אתה בטוח שברצונך למחוק תמונה זו מהמאגר?')) {
        currentCar.gallery.splice(index, 1);
        window.saveToLocalStorage();
        window.renderGallery();
    }
};
