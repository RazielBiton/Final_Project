// --- MODULE: REPORTS ---

const offenseIcons = {
    'parking': 'fa-parking',
    'speeding': 'fa-tachometer-alt',
    'phone': 'fa-mobile-alt',
    'other': 'fa-file-invoice'
};

const offenseTitles = {
    'parking': 'חניה במקום אסור',
    'speeding': 'מהירות מופרזת',
    'phone': 'שימוש בטלפון נייד בעת נהיגה',
    'other': 'עבירה אחרת'
};

let currentBase64ReportImages = [];

window.compressImage = function (dataUrl, maxWidth, quality, callback) {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = function () {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        callback(compressedDataUrl);
    };
    img.onerror = function () {
        callback(dataUrl);
    };
};

window.attachReportImageListener = function () {
    const rImageInput = document.getElementById('reportImageInput');
    if (!rImageInput) return;

    rImageInput.onchange = function (e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function (event) {
                    window.compressImage(event.target.result, 800, 0.7, function (compressed) {
                        currentBase64ReportImages.push(compressed);
                        window.renderReportImagesPreview();
                    });
                };
                reader.readAsDataURL(file);
            });
        }
    };
};

window.renderReportImagesPreview = function () {
    const container = document.getElementById('reportImagesPreviewContainer');
    const list = document.getElementById('reportImagesList');
    const placeholder = document.getElementById('reportUploadPlaceholder');
    if (!container || !list || !placeholder) return;

    list.innerHTML = '';

    if (currentBase64ReportImages.length > 0) {
        placeholder.classList.add('d-none');
        container.classList.remove('d-none');

        currentBase64ReportImages.forEach((imgSrc, index) => {
            const imgHtml = `
            <div class="position-relative d-inline-block">
                <img src="${imgSrc}" class="img-fluid rounded shadow-sm" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff;">
                <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="removeReportImage(${index})" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%);">
                    <i class="fas fa-times" style="font-size: 10px;"></i>
                </button>
            </div>`;
            list.insertAdjacentHTML('beforeend', imgHtml);
        });
    } else {
        placeholder.classList.remove('d-none');
        container.classList.add('d-none');
    }
};

window.removeReportImage = function (index) {
    currentBase64ReportImages.splice(index, 1);
    window.renderReportImagesPreview();
};

window.clearReportImages = function () {
    currentBase64ReportImages = [];
    const input = document.getElementById('reportImageInput');
    if (input) input.value = '';
    window.renderReportImagesPreview();
};

window.viewReportImage = function (reportId, imageIdx) {
    const report = (currentCar.reports || []).find(r => r.id == reportId);
    if (!report) return;
    const imgSrc = report.images[imageIdx];
    if (imgSrc) {
        const modalImg = document.getElementById('invoicePreviewImg');
        if (modalImg) modalImg.src = imgSrc;
        new bootstrap.Modal(document.getElementById('invoiceModal')).show();
    }
};

window.openAddReportModal = function () {
    const typeSelect = document.getElementById('report-type-select');
    if (typeSelect) typeSelect.value = '';
    window.toggleCustomType('');

    const form = document.getElementById('add-report-form');
    if (form) form.reset();

    const idField = document.getElementById('reportIdField');
    if (idField) idField.value = '';

    window.clearReportImages();
    window.attachReportImageListener();
    new bootstrap.Modal(document.getElementById('addReportModal')).show();
};

window.loadReports = function () {
    if (!currentCar.reports) currentCar.reports = [];

    const container = document.getElementById('reports-list-container');
    if (!container) return;
    container.innerHTML = '';

    // Sort: unpaid first, then by date descending
    const sortedReports = [...currentCar.reports].sort((a, b) => {
        if (a.status === 'paid' && b.status !== 'paid') return 1;
        if (a.status !== 'paid' && b.status === 'paid') return -1;

        const da = a.date.split('/').reverse().join('-');
        const db = b.date.split('/').reverse().join('-');
        return new Date(db) - new Date(da);
    });

    sortedReports.forEach(report => {
        const isPaid = (report.status === 'paid');
        const iconClass = offenseIcons[report.typeVal] || 'fa-file-invoice';

        // Calculate days left
        const today = new Date();
        const dueDate = new Date(report.dueDate);
        const timeDiff = dueDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        const dateStr = report.date.split('-').reverse().join('/');
        const dueDateStr = report.dueDate.split('-').reverse().join('/');

        let statusText = 'נותרו ' + daysLeft + ' ימים לתשלום';
        let statusClass = 'text-primary-custom';
        let progressClass = 'bg-primary-custom';
        let progressBg = '#e9ecef';
        let progressPercent = 50;

        if (daysLeft < 0) {
            statusText = 'פג תוקף! איחור של ' + Math.abs(daysLeft) + ' ימים';
            statusClass = 'text-danger';
            progressClass = 'bg-danger';
            progressBg = '#fee2e2';
            progressPercent = 100;
        } else if (daysLeft <= 3) {
            statusText = 'נותרו ' + daysLeft + ' ימים לתשלום!';
            statusClass = 'text-danger';
            progressClass = 'bg-danger';
            progressBg = '#fee2e2';
            progressPercent = 90;
        } else if (daysLeft > 30) {
            progressPercent = 10;
        }

        if (isPaid) {
            statusText = 'שולם בהצלחה';
            statusClass = 'text-success fw-bold';
            progressPercent = 100;
            progressClass = 'bg-success';
        }

        const pointsBadgeClass = parseInt(report.points) > 0 ? 'bg-danger' : 'bg-secondary';
        const cardBgClass = isPaid ? 'bg-light' : 'bg-white';
        const filterStyle = isPaid ? 'filter: grayscale(80%) opacity(0.8);' : '';

        let imageHtml = '';
        if (report.images && report.images.length > 0) {
            let imgsHtml = report.images.map((img, idx) => `
                <img src="${img}" class="img-fluid rounded shadow-sm m-1" style="height: 60px; width: 60px; object-fit: cover; cursor: pointer; display: inline-block; filter: ${isPaid ? 'grayscale(80%) opacity(0.8)' : 'none'};" onclick="viewReportImage('${report.id}', ${idx})" title="לחץ להגדלה">
            `).join('');
            imageHtml = `<div class="mt-3 text-start border-top pt-2">${imgsHtml}</div>`;
        }

        const cardHtml = `
        <div class="card report-card border-0 shadow-sm mb-3 report-item" id="${report.id}" data-status="${report.status}" style="border-radius: 12px; overflow: hidden; background-color: ${isPaid ? '#e9ecef' : '#ffffff'}; ${filterStyle}">
            <div class="card-body p-0">
                <div class="d-flex align-items-center p-3 border-bottom ${cardBgClass} report-header">
                    <div class="icon-lg-wrapper me-3" style="background-color: #e9ecef; color: #495057; width: 48px; height: 48px;">
                        <i class="fas ${iconClass} fa-lg"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold text-dark">${report.title}</h6>
                        <p class="text-muted mb-0" style="font-size: 0.85rem;">
                            <i class="fas fa-map-marker-alt ms-1 text-secondary"></i> ${report.location}
                            <span class="mx-2 text-light">|</span>
                            <i class="far fa-calendar-alt ms-1 text-secondary"></i> ${dateStr}
                        </p>
                    </div>
                    <div class="text-start ms-3">
                        <div class="d-flex flex-column align-items-end">
                            <div class="fw-bold fs-5 text-dark mb-1 report-amount" data-amount="${report.amount}">₪ ${report.amount}</div>
                            <div class="badge ${pointsBadgeClass} rounded-pill px-2 py-1 fw-normal shadow-sm report-points"
                                data-points="${report.points}">${report.points} נקודות</div>
                        </div>
                    </div>
                </div>

                <div class="d-flex flex-column p-3 report-footer" style="background-color: ${isPaid ? '#e9ecef' : '#fcfcfc'};">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="flex-grow-1 me-4">
                            <div class="d-flex justify-content-between small mb-1">
                                <span class="${statusClass} payment-status-text">${statusText}</span>
                                <span class="text-muted dead-line-text">לתשלום עד: ${dueDateStr}</span>
                            </div>
                            <div class="progress shadow-sm report-progress-container" style="height: 6px; border-radius: 10px; background-color: ${progressBg}; display: ${isPaid ? 'none' : 'flex'};">
                                <div class="progress-bar ${progressClass} report-progress-bar" role="progressbar" style="width: ${progressPercent}%"></div>
                            </div>
                        </div>
                        <div class="d-flex gap-2 ms-3 actions-container">
                            ${isPaid ?
                `<span class="badge bg-success rounded-pill px-3 py-2 fw-bold d-flex align-items-center"><i class="fas fa-check me-1"></i> שולם</span>`
                :
                `<button type="button" class="btn btn-outline-success btn-sm rounded-pill px-3 fw-bold mark-paid-btn" onclick="markAsPaid('${report.id}')">סמן כשולם</button>
                                 <a href="https://www.gov.il/he/service/police_fine_payment" target="_blank" class="btn btn-primary btn-sm rounded-pill px-3 fw-bold bg-primary-custom border-0 shadow-sm pay-now-btn">שלם עכשיו</a>`
            }
                        </div>
                    </div>
                    ${imageHtml}
                    <!-- Edit/Delete Buttons row -->
                    <div class="d-flex align-items-center justify-content-end mt-2">
                        <button class="btn btn-light btn-sm text-primary rounded-circle shadow-sm me-1" onclick="editReport('${report.id}')" title="ערוך">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-light btn-sm text-danger rounded-circle shadow-sm" onclick="deleteReport('${report.id}')" title="מחק">
                            <i class="fas fa-trash"></i>
                        </button>
                     </div>
                </div>
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    updateVisibilityAndTotals();
}

window.saveReport = function (e) {
    if (e) e.preventDefault();

    const idField = document.getElementById('reportIdField').value;
    const typeSelect = document.getElementById('report-type-select');
    const customTypeInput = document.getElementById('report-type-custom');

    // Gather inputs
    const typeVal = typeSelect.value;
    const customTitle = customTypeInput.value.trim();
    const dateVal = document.getElementById('report-date').value;
    const dueDateVal = document.getElementById('report-due-date').value;
    const locationVal = document.getElementById('report-location').value;
    const amountVal = document.getElementById('report-amount-input').value;
    const pointsVal = document.getElementById('report-points-input').value;

    const parsedPoints = parseInt(pointsVal) || 0;

    // --- POINTS CAP VALIDATION ---
    // Sum existing points (ignoring the report being edited)
    let totalOtherPoints = 0;
    if (currentCar.reports) {
        currentCar.reports.forEach(r => {
            if (idField && r.id == idField) return; // Skip currently edited report
            totalOtherPoints += (parseInt(r.points) || 0);
        });
    }

    if (totalOtherPoints + parsedPoints > 35) {
        alert('לא ניתן לשמור דוח זה: חריגה מהמגבלה המקסימלית של 35 נקודות.\n(סה"כ נקודות אחרות: ' + totalOtherPoints + ')');
        return;
    }
    // -----------------------------

    let finalTitle = offenseTitles[typeVal];
    if (typeVal === 'other' && customTitle !== '') {
        finalTitle = customTitle;
    }

    if (!currentCar.reports) currentCar.reports = [];

    const newReport = {
        id: idField ? parseInt(idField) : Date.now(),
        typeVal: typeVal,
        title: finalTitle,
        customTitle: customTitle,
        date: dateVal,
        dueDate: dueDateVal,
        location: locationVal,
        amount: parseInt(amountVal),
        points: parseInt(pointsVal),
        images: [...currentBase64ReportImages],
        status: idField ? (currentCar.reports.find(r => r.id == idField)?.status || 'unpaid') : 'unpaid'
    };

    if (idField) {
        const idx = currentCar.reports.findIndex(r => r.id == idField);
        if (idx > -1) {
            currentCar.reports[idx] = newReport;
        }
    } else {
        currentCar.reports.push(newReport);
    }

    saveToLocalStorage();
    loadReports();
    if (typeof loadOverview === 'function') loadOverview();

    const addModal = bootstrap.Modal.getInstance(document.getElementById('addReportModal'));
    if (addModal) addModal.hide();
};

window.editReport = function (reportId) {
    const report = (currentCar.reports || []).find(r => r.id == reportId);
    if (!report) return;

    document.getElementById('reportIdField').value = report.id;
    const typeSelect = document.getElementById('report-type-select');
    typeSelect.value = report.typeVal;

    window.toggleCustomType(report.typeVal);

    if (report.typeVal === 'other') {
        document.getElementById('report-type-custom').value = report.customTitle || '';
    }

    document.getElementById('report-date').value = report.date;
    document.getElementById('report-due-date').value = report.dueDate;
    document.getElementById('report-location').value = report.location;
    document.getElementById('report-amount-input').value = report.amount;
    document.getElementById('report-points-input').value = report.points;

    currentBase64ReportImages = report.images ? [...report.images] : [];
    window.attachReportImageListener();
    window.renderReportImagesPreview();

    new bootstrap.Modal(document.getElementById('addReportModal')).show();
};

// Global function to toggle the custom input to ensure it fires reliably
window.toggleCustomType = function (selectedValue) {
    const customTypeContainer = document.getElementById('custom-type-container');
    const customTypeInput = document.getElementById('report-type-custom');

    if (!customTypeContainer || !customTypeInput) return;

    if (selectedValue === 'other') {
        customTypeContainer.style.display = 'block';
        customTypeInput.setAttribute('required', 'required');
        // Focus on the input purely for UX
        setTimeout(() => customTypeInput.focus(), 50);
    } else {
        customTypeContainer.style.display = 'none';
        customTypeInput.removeAttribute('required');
        customTypeInput.value = '';
    }
};

window.markAsPaid = function (reportId) {
    const report = (currentCar.reports || []).find(r => r.id == reportId);
    if (report) {
        report.status = 'paid';
        saveToLocalStorage();
        loadReports();
        if (typeof loadOverview === 'function') loadOverview();
    }
};

window.deleteReport = function (reportId) {
    if (confirm('האם אתה בטוח שברצונך למחוק דוח זה לצמיתות?')) {
        const idx = (currentCar.reports || []).findIndex(r => r.id == reportId);
        if (idx > -1) {
            currentCar.reports.splice(idx, 1);
            saveToLocalStorage();
            loadReports();
            if (typeof loadOverview === 'function') loadOverview();
        }
    }
};

window.updateVisibilityAndTotals = function () {
    // Elements
    const emptyState = document.getElementById('reports-empty-state');
    const populatedState = document.getElementById('reports-populated-state');
    const container = document.getElementById('reports-list-container');

    if (!emptyState || !populatedState || !container) return; // Prevent crash if not loaded

    // Count total reports
    const allReports = container.querySelectorAll('.report-item');

    // If 0 reports at all, show empty, hide populated.
    if (allReports.length === 0) {
        emptyState.classList.remove('d-none');
        populatedState.classList.add('d-none');
        return;
    } else {
        emptyState.classList.add('d-none');
        populatedState.classList.remove('d-none');
    }

    // Calculation variables
    let totalAmount = 0;
    let totalPoints = 0; // Historically we counted all points, active or paid. Points don't disappear when fine is paid.

    // Iterate all reports for points
    allReports.forEach(report => {
        const pointsEl = report.querySelector('.report-points');
        if (pointsEl && pointsEl.dataset.points) {
            totalPoints += parseInt(pointsEl.dataset.points) || 0;
        }
    });

    // Iterate ONLY non-paid (active) reports to build the cash total
    const activeReports = container.querySelectorAll('.report-item:not([data-status="paid"])');

    activeReports.forEach(report => {
        const amountEl = report.querySelector('.report-amount');
        if (amountEl && amountEl.dataset.amount) {
            totalAmount += parseInt(amountEl.dataset.amount) || 0;
        }
    });

    // Update UI amount
    const totalAmountEl = document.getElementById('total-amount');
    if (totalAmountEl) totalAmountEl.textContent = '₪ ' + totalAmount;

    // Update UI points
    const pointsElement = document.getElementById('total-points');
    const wrapper = document.getElementById('points-icon-wrapper');

    if (pointsElement && wrapper) {
        pointsElement.className = 'm-0 fw-bold';

        if (totalPoints === 0) {
            pointsElement.classList.add('text-success');
            wrapper.style.backgroundColor = '#d1e7dd';
            wrapper.style.color = '#198754';
        } else if (totalPoints < 8) {
            pointsElement.classList.add('text-warning');
            wrapper.style.backgroundColor = '#fff3cd';
            wrapper.style.color = '#ffc107';
        } else {
            pointsElement.classList.add('text-danger');
            wrapper.style.backgroundColor = '#f8d7da';
            wrapper.style.color = '#dc3545';
        }

        pointsElement.innerHTML = totalPoints + ' <span class="fs-6 text-muted fw-normal">/ 35</span>';
    }

    // --- MANDATORY DRIVING COURSES LOGIC ---
    const courseContainer = document.getElementById('mandatory-courses-container');
    if (courseContainer) {
        courseContainer.innerHTML = '';
        courseContainer.classList.add('d-none');

        let courseHtml = '';
        let hasAlertsOrHistory = false;

        // Basic Course Logic (12 to 21 points, or if advanced is needed basic is also implicitly active unless done)
        if (totalPoints >= 12) {
            hasAlertsOrHistory = true;
            if (currentCar.basicCourseDone) {
                // History display
                courseHtml += `
                    <div class="alert alert-success border-0 shadow-sm p-3 mb-2 d-flex justify-content-between align-items-center" style="border-radius: 10px;">
                        <div><i class="fas fa-check-circle me-2"></i> קורס נהיגה נכונה בסיסי ("נהיגה מונעת") בוצע ומעודכן בהיסטוריה.</div>
                    </div>
                `;
            } else {
                // Active alert
                courseHtml += `
                    <div class="alert alert-danger border-0 shadow-sm p-3 mb-2 d-flex justify-content-between align-items-center" style="border-radius: 10px;">
                        <div>
                            <h6 class="fw-bold mb-1"><i class="fas fa-exclamation-triangle me-2"></i> חובה לביצוע: קורס נהיגה נכונה בסיסי</h6>
                            <small>צברת ${totalPoints} נקודות. עליך לעבור קורס נהיגה נכונה בסיסי ("נהיגה מונעת") ומבחן בסיומו.</small>
                        </div>
                        <button class="db-btn db-btn-sm btn-outline-danger fw-bold rounded-pill px-3" onclick="markCourseDone('basic')">סמן כבוצע</button>
                    </div>
                `;
            }
        }

        // Advanced Course Logic (22 to 35 points)
        if (totalPoints >= 22) {
            hasAlertsOrHistory = true;
            if (currentCar.advancedCourseDone) {
                // History display
                courseHtml += `
                    <div class="alert alert-success border-0 shadow-sm p-3 mb-2 d-flex justify-content-between align-items-center" style="border-radius: 10px;">
                        <div><i class="fas fa-check-double me-2"></i> קורס נהיגה נכונה ייעודי בוצע ומעודכן בהיסטוריה.</div>
                    </div>
                `;
            } else {
                // Active alert
                courseHtml += `
                    <div class="alert alert-danger border-0 shadow-sm p-3 mb-2 d-flex justify-content-between align-items-center" style="background-color: #f8d7da; border-radius: 10px; border-right: 4px solid #dc3545 !important;">
                        <div>
                            <h6 class="fw-bold mb-1 text-danger"><i class="fas fa-exclamation-triangle me-2"></i> חובה לביצוע: קורס נהיגה נכונה ייעודי !</h6>
                            <small class="text-danger">צברת מעל 21 נקודות. עליך לעבור בנוסף קורס נהיגה ייעודי.</small>
                        </div>
                        <button class="db-btn db-btn-sm btn-danger text-white fw-bold rounded-pill px-3 shadow-sm" onclick="markCourseDone('advanced')">סמן כבוצע</button>
                    </div>
                `;
            }
        }

        if (hasAlertsOrHistory) {
            courseContainer.classList.remove('d-none');
            courseContainer.innerHTML = courseHtml;
        }
    }
}

window.markCourseDone = function (type) {
    if (confirm('האם אתה בטוח שברצונך לסמן קורס זה כבוצע? (הוא יועבר להיסטוריה)')) {
        if (type === 'basic') {
            currentCar.basicCourseDone = true;
        } else if (type === 'advanced') {
            currentCar.advancedCourseDone = true;
        }
        saveToLocalStorage();
        updateVisibilityAndTotals();
    }
}

