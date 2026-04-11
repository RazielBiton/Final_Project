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
    // Initial HTML setup with premium typography and structured grid layout
    let html = `
        <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; text-align: right; color: #212529; padding: 30px; background: #ffffff;">
            <!-- Header -->
            <table width="100%" dir="rtl" style="border-bottom: 3px solid #0d6efd; padding-bottom: 15px; margin-bottom: 25px; margin-top: 10px;">
                <tr>
                    <td style="vertical-align: middle; text-align: right;">
                        <h1 style="color: #0d6efd; margin: 0; font-size: 32px; font-weight: 700;">דוח&nbsp;שקיפות&nbsp;רכב&nbsp;מלא&nbsp;-&nbsp;${brand}</h1>
                        <p style="margin: 5px 0 0 0; font-size: 16px; color: #6c757d;">הופק&nbsp;אוטומטית&nbsp;ממערכת&nbsp;EasyCare</p>
                    </td>
                    <td style="vertical-align: middle; text-align: left; width: 120px;">
                        ${logoSource}
                    </td>
                </tr>
            </table>

            <!-- Vehicle Summary Grid -->
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #212529; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">פרטי&nbsp;רכב&nbsp;בסיסיים</h2>
                <table width="100%" dir="rtl" style="font-size: 16px; line-height: 1.6; table-layout: fixed;">
                    <tr>
                        <td width="50%" style="vertical-align: top; padding-right: 10px;">
                            <table width="100%" dir="rtl" style="font-size: 16px;">
                                <tr>
                                    <td style="width: 45%; padding-bottom: 8px;"><strong>יצרן&nbsp;ודגם:</strong></td>
                                    <td style="width: 55%; padding-bottom: 8px; text-align: right;" dir="rtl">${brand}&nbsp;${currentCar.model || ''}</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>מספר&nbsp;רישוי:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><span style="background: #ffeb3b; color: #000; padding: 2px 8px; border-radius: 4px; border: 1px solid #212529; font-weight:bold; letter-spacing: 1px;" dir="ltr">${currentCar.licensePlate}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>שנת&nbsp;ייצור:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;" dir="rtl">${currentCar.year || '-'}</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>קילומטראז'&nbsp;נוכחי:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;" dir="rtl">${currentCar.km ? currentCar.km.toLocaleString() : '-'}&nbsp;ק"מ</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>צבע&nbsp;הרכב:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;" dir="rtl">${currentCar.color || '-'}</td>
                                </tr>
                            </table>
                        </td>
                        <td width="50%" style="vertical-align: top; padding-right: 20px; border-right: 1px solid #dee2e6;">
                            <table width="100%" dir="rtl" style="font-size: 16px;">
                                <tr>
                                    <td style="width: 50%; padding-bottom: 8px;"><strong>טסט&nbsp;בתוקף&nbsp;עד:</strong></td>
                                    <td style="width: 50%; padding-bottom: 8px; text-align: right;" dir="rtl">${currentCar.testDate || 'אין&nbsp;נתונים'}</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>ציון&nbsp;אמינות&nbsp;משוער:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><span style="color: #0d6efd; font-weight: bold; font-size: 18px;" dir="ltr">${window.calculateReliability ? window.calculateReliability(currentCar).score : '--'}%</span></td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px; color: #dc3545;"><strong>סך&nbsp;הוצאות&nbsp;מתועדות:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;" dir="rtl">₪${totalExpenses.toLocaleString()}&nbsp;משוער</td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><strong>סטטוס&nbsp;המערכת:</strong></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><span style="color: #198754; font-weight: bold;" dir="rtl">${currentCar.status || 'פעיל'}</span></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Technical Specs Section -->
            <h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">מפרט&nbsp;טכני</h3>
            <table width="100%" dir="rtl" style="border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6; text-align: right;">
                <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%; font-weight: bold;">כוח&nbsp;סוס&nbsp;(כ"ס)</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; width: 25%; text-align: right;" dir="ltr">${currentCar.horsePower || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%; font-weight: bold;">נפח&nbsp;מנוע&nbsp;(סמ"ק)</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; width: 25%; text-align: right;" dir="ltr">${currentCar.engineVolume || '-'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">צמיגים&nbsp;קדמיים</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: right;" dir="ltr">${currentCar.tireFront || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">צמיגים&nbsp;אחוריים</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: right;" dir="ltr">${currentCar.tireRear || '-'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">סוג&nbsp;מנוע&nbsp;/&nbsp;דלק</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: right;" colspan="3" dir="rtl">${currentCar.fuelType || '-'}</td>
                </tr>
            </table>

            <!-- Treatments Section -->
            ${generateTreatmentsHTML()}

            <!-- Insurance Section -->
            ${generateInsuranceHTML()}

            <!-- Fuel & Accidents Sections -->
            ${generateLogsHTML()}

            <!-- End of main info page footer -->
            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 13px;" dir="rtl">
                מסמך&nbsp;זה&nbsp;הופק&nbsp;ישירות&nbsp;מממשק&nbsp;EasyCare&nbsp;ומהווה&nbsp;ריכוז&nbsp;נתונים&nbsp;כפי&nbsp;שהווזנו&nbsp;במערכת.&nbsp;על&nbsp;הקונה&nbsp;לוודא&nbsp;פרטים&nbsp;בבדיקת&nbsp;הרכב.<br>
                יוצר&nbsp;עבור&nbsp;מזהה&nbsp;רישוי&nbsp;<span dir="ltr">${currentCar.licensePlate}</span>&nbsp;בתאריך&nbsp;${new Date().toLocaleDateString('he-IL')}&nbsp;שעה&nbsp;${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </div>
            
            <br>
        </div>
    `;

    // --- Media Appendices: Iterate and add Page Breaks for Images ---
    let mediaHtml = '';

    // Treatments Images
    treatments.forEach(t => {
        if (t.invoice && t.invoice.startsWith('data:image')) {
            mediaHtml += `
                <div class="html2pdf__page-break"></div>
                <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; text-align: right; padding: 40px; background: #fff;">
                    <h2 style="color: #0d6efd; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">נספח:&nbsp;חשבונית&nbsp;טיפול&nbsp;מאומתת</h2>
                    <table width="100%" dir="rtl" style="font-size: 16px;">
                        <tr><td width="20%"><strong>שם&nbsp;הטיפול:</strong></td><td>${t.type || t.name || '-'}</td></tr>
                        <tr><td><strong>מוסך:</strong></td><td>${t.garage || '-'}</td></tr>
                        <tr><td><strong>תאריך:</strong></td><td dir="ltr" style="text-align:right;">${t.date ? t.date.split('-').reverse().join('/') : '-'}</td></tr>
                    </table>
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
                <div style="font-family: 'Rubik', Arial, sans-serif; direction: rtl; text-align: right; padding: 40px; background: #fff;">
                    <h2 style="color: #dc3545; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">נספח:&nbsp;תיעוד&nbsp;תאונה/נזק</h2>
                    <table width="100%" dir="rtl" style="font-size: 16px;">
                        <tr><td width="20%"><strong>תיאור:</strong></td><td>${a.description || '-'}</td></tr>
                        <tr><td><strong>תאריך:</strong></td><td dir="ltr" style="text-align:right;">${a.date ? a.date.split('-').reverse().join('/') : '-'}</td></tr>
                    </table>
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
        if (treatments.length === 0) return `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">ציר&nbsp;זמן&nbsp;טיפולים&nbsp;ותחזוקה</h3><p style="color: #6c757d;">לא&nbsp;תועדו&nbsp;טיפולים.</p>`;

        let tHTML = `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">היסטוריית&nbsp;טיפולים&nbsp;ותחזוקה&nbsp;(${treatments.length})</h3>`;
        tHTML += `<table width="100%" dir="rtl" style="border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6; text-align: right; font-size: 14px;">
                    <thead><tr style="background: #e9ecef;">
                        <th style="padding: 8px; border: 1px solid #dee2e6; width: 15%; text-align: right;">תאריך</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6; width: 30%; text-align: right;">שם&nbsp;הטיפול</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6; width: 25%; text-align: right;">מוסך</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6; width: 10%; text-align: right;">ק"מ</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">עלות&nbsp;(₪)</th>
                    </tr></thead><tbody>`;
        treatments.forEach(t => {
            tHTML += `<tr>
                <td style="padding: 8px; border: 1px solid #dee2e6;" dir="ltr">${t.date ? t.date.split('-').reverse().join('/') : '-'}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;" dir="rtl"><strong>${t.type || t.name || '-'}</strong></td>
                <td style="padding: 8px; border: 1px solid #dee2e6;" dir="rtl">${t.garage || '-'}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;" dir="ltr">${t.km ? t.km.toLocaleString() : '-'}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6; color: #198754; font-weight: bold;" dir="ltr">${t.cost ? t.cost.toLocaleString() : '-'}</td>
            </tr>`;
        });
        tHTML += `</tbody></table>`;
        return tHTML;
    }

    function generateInsuranceHTML() {
        const ins = currentCar.insurance || {};
        const mandatory = ins.mandatory || {};
        const comp = ins.comprehensive || ins.thirdparty || {};
        const compType = ins.comprehensive ? 'מקיף' : (ins.thirdparty ? "צד ג'" : "-");

        let costSum = (mandatory.cost ? parseInt(mandatory.cost) : 0) + (comp.cost ? parseInt(comp.cost) : 0);

        return `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">נתונים&nbsp;ביטוחיים</h3>
        <table width="100%" dir="rtl" style="border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6; text-align: right; font-size: 14px;">
            <tr>
                <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%; font-weight: bold;">חברת&nbsp;ביטוח&nbsp;חובה</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; width: 25%;" dir="rtl">${mandatory.company || '-'}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; width: 25%; font-weight: bold;">תוקף&nbsp;הביטוח</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; width: 25%;" dir="ltr" style="text-align: right;">${mandatory.date ? mandatory.date.split('-').reverse().join('/') : '-'}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">ביטוח&nbsp;המשך</td>
                <td style="padding: 10px; border: 1px solid #dee2e6;" dir="rtl">${compType === '-' ? 'אין&nbsp;תיעוד' : compType + '&nbsp;מטעם&nbsp;' + (comp.company || '')}</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">תוקף&nbsp;סיום</td>
                <td style="padding: 10px; border: 1px solid #dee2e6;" dir="ltr" style="text-align: right;">${comp.date ? comp.date.split('-').reverse().join('/') : '-'}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">עלות&nbsp;שנתית&nbsp;משוערת</td>
                <td style="padding: 10px; border: 1px solid #dee2e6; color: #198754; font-weight: bold;" colspan="3" dir="ltr" style="text-align: right;">${costSum > 0 ? costSum.toLocaleString() + '&nbsp;₪' : '-'}</td>
            </tr>
        </table>`;
    }

    function generateLogsHTML() {
        let rHTML = '';
        const fuels = currentCar.fuelLog || [];
        if (fuels.length > 0) {
            rHTML += `<h3 style="border-bottom: 2px solid #0d6efd; color: #0d6efd; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">היסטוריית&nbsp;תדלוקים&nbsp;(5&nbsp;אחרונים)</h3>
            <table width="100%" dir="rtl" style="border-collapse: collapse; margin-top: 15px; border: 1px solid #dee2e6; text-align: right; font-size: 14px;">
                <thead><tr style="background: #e9ecef;">
                    <th style="padding: 8px; border: 1px solid #dee2e6; width: 33%; text-align: right;">תאריך</th>
                    <th style="padding: 8px; border: 1px solid #dee2e6; width: 33%; text-align: right;">כמות&nbsp;(ליטר/קוט"ש)</th>
                    <th style="padding: 8px; border: 1px solid #dee2e6; width: 33%; text-align: right;">עלות&nbsp;סופית&nbsp;(₪)</th>
                </tr></thead><tbody>`;
            fuels.slice(0, 5).forEach(f => {
                rHTML += `<tr>
                    <td style="padding: 8px; border: 1px solid #dee2e6;" dir="ltr" style="text-align: right;">${f.date ? f.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;" dir="ltr" style="text-align: right;">${f.amount ? parseFloat(f.amount).toFixed(2) : (f.liters ? parseFloat(f.liters).toFixed(2) : '-')}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; color: #198754; font-weight: bold;" dir="ltr" style="text-align: right;">${f.cost ? f.cost.toLocaleString() : '-'}</td>
                </tr>`;
            });
            rHTML += `</tbody></table>`;
        }

        if (acc.length > 0) {
            rHTML += `<h3 style="border-bottom: 2px solid #dc3545; color: #dc3545; padding-bottom: 8px; margin-top: 25px; font-size: 20px;">היסטוריית&nbsp;תאונות&nbsp;ונזקים&nbsp;(${acc.length}&nbsp;נרשמו)</h3>
            <table width="100%" dir="rtl" style="border-collapse: collapse; margin-top: 15px; border: 1px solid #f5c2c7; text-align: right; font-size: 14px;">
                <thead><tr style="background: #f8d7da; color: #842029;">
                    <th style="padding: 8px; border: 1px solid #f5c2c7; width: 20%; text-align: right;">תאריך</th>
                    <th style="padding: 8px; border: 1px solid #f5c2c7; width: 55%; text-align: right;">נושא&nbsp;/&nbsp;סיווג&nbsp;התיאור</th>
                    <th style="padding: 8px; border: 1px solid #f5c2c7; width: 25%; text-align: right;">עלות&nbsp;תביעה&nbsp;/&nbsp;נזק</th>
                </tr></thead><tbody>`;
            acc.forEach(a => {
                rHTML += `<tr>
                    <td style="padding: 8px; border: 1px solid #f5c2c7;" dir="ltr" style="text-align: right;">${a.date ? a.date.split('-').reverse().join('/') : '-'}</td>
                    <td style="padding: 8px; border: 1px solid #f5c2c7;" dir="rtl"><strong>${a.title || ''}</strong> ${a.title ? '-' : ''} ${a.description || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #f5c2c7;" dir="ltr" style="text-align: right;">${a.repairCost ? a.repairCost.toLocaleString() : (a.damageCost ? a.damageCost.toLocaleString() : '-')}</td>
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
