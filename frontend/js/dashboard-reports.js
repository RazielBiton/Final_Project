const offenseIcons = {
    'parking': 'fa-parking',
    'speeding': 'fa-tachometer-alt',
    'phone': 'fa-mobile-alt',
    'other': 'fa-file-invoice'
};

const offenseTitles = {
    'parking': 'חניה במקום אסור',
    'speeding': 'מהירות מופרזת',
    'phone': 'שימוש בטלפון נייד',
    'other': 'עבירת תנועה'
};

window.loadReports = function () {
    if (!window.currentCar) {
        const stored = localStorage.getItem('currentCar');
        if (stored) window.currentCar = JSON.parse(stored);
    }
    if (!window.currentCar) return;

    const container = document.getElementById('reports-list-container');
    if (!container) return;

    container.innerHTML = '';
    const reports = window.currentCar.reports || [];

    const sortedReports = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedReports.forEach(report => {
        const isPaid = report.status === 'paid';

        // Robust date parsing
        const dateStr = window.formatDate(report.date);
        const dueDateStr = window.formatDate(report.dueDate);

        let statusText = 'אין מועד תשלום מוגדר';
        let statusClass = 'text-muted';
        let progressClass = 'bg-secondary';
        let progressPercent = 0;

        const dDate = report.dueDate ? new Date(report.dueDate) : null;
        if (dDate && !isNaN(dDate.getTime())) {
            const now = new Date();
            const diffDays = Math.ceil((dDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                statusText = 'חלף מועד התשלום!';
                statusClass = 'text-danger';
                progressClass = 'bg-danger';
                progressPercent = 100;
            } else {
                statusText = `נותרו ${diffDays} ימים לתשלום`;
                progressPercent = Math.max(10, 100 - (diffDays * 2)); // Dynamic bar
                if (diffDays <= 7) {
                    statusClass = 'text-warning';
                    progressClass = 'bg-warning';
                } else {
                    statusClass = 'text-success';
                    progressClass = 'bg-success';
                }
            }
        }

        const iconClass = offenseIcons[report.typeVal] || offenseIcons['other'];

        let imageHtml = '';
        if (report.images && report.images.length > 0) {
            imageHtml = `
                <div class="d-flex gap-2 mt-3 overflow-auto pb-2">
                    ${report.images.map(img => {
                        const isPdf = img.startsWith('data:application/pdf');
                        const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : img;
                        const fileType = isPdf ? 'pdf' : 'image';
                        return `<img src="${displaySrc}" style="height: 60px; border-radius: 8px; cursor: pointer; border: 1px solid #e2e8f0; ${isPdf ? 'padding: 5px; background: white;' : ''}" 
                             onclick="window.showFilePreview('${img}', '${fileType}')">`;
                    }).join('')}
                </div>`;
        }

        const cardHtml = `
        <div class="db-card border-0 shadow-sm mb-3 report-item" id="report-${report.id}" data-id="${report.id}" data-status="${report.status}" 
             style="border-radius: 14px; overflow: hidden; border:1px solid #f1f5f9; transition:all 0.3s; 
             ${isPaid ? 'background:#f8fafc; opacity:0.85;' : 'background:#fff;'}">
            <div class="p-3">
                <div class="row align-items-center g-3 text-end" dir="rtl">
                    <div class="col-md-5">
                        <div class="d-flex align-items-center gap-3">
                            <div style="width:48px; height:48px; min-width:48px; border-radius:12px; 
                                 background:${isPaid ? '#f1f5f9' : '#fff7ed'}; 
                                 display:flex; justify-content:center; align-items:center; border:1px solid ${isPaid ? '#e2e8f0' : '#fed7aa'};">
                                <i class="fas ${iconClass}" style="color:${isPaid ? '#94a3b8' : '#f59e0b'}; font-size:1.2rem;"></i>
                            </div>
                            <div>
                                <h6 class="m-0 fw-bold ${isPaid ? 'text-muted' : 'text-dark'}">${report.title || 'עבירת תנועה'}</h6>
                                <div class="small mt-1" style="color:#64748b;">
                                    <i class="fas fa-map-marker-alt ms-1"></i> ${report.location || 'מיקום לא צוין'}
                                    <span class="mx-2 opacity-50">|</span>
                                    <i class="far fa-calendar-alt ms-1"></i> ${dateStr}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3 text-md-center">
                        <div class="d-flex flex-md-column justify-content-center align-items-center gap-2">
                            <div style="background:${isPaid ? '#f1f5f9' : '#fff5f5'}; padding:4px 12px; border-radius:8px;">
                                <span class="fw-bold ${isPaid ? 'text-muted' : 'text-danger'}">₪${report.amount || 0}</span>
                            </div>
                            <div style="background:${isPaid ? '#f1f5f9' : '#fefce8'}; padding:4px 10px; border-radius:8px;">
                                <span class="fw-bold ${isPaid ? 'text-muted' : 'text-warning'}" style="font-size:0.85rem;">${report.points || 0} נקודות</span>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="d-flex justify-content-end align-items-center gap-2">
                             ${isPaid ?
                `<div class="d-flex align-items-center gap-2">
                    <div class="text-success fw-bold small"><i class="fas fa-check-circle me-1"></i>שולמה</div>
                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-2 py-0" onclick="markAsUnpaid('${report.id}')" title="בטל תשלום">
                        <i class="fas fa-undo"></i>
                    </button>
                 </div>`
                :
                `<button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="markAsPaid('${report.id}')">סימון כשולם</button>
                 <a href="https://www.gov.il/he/service/police_fine_payment" target="_blank" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold">שלם</a>`
            }
                            <div style="width:1px; height:20px; background:#e2e8f0; margin:0 5px;"></div>
                            <button class="btn btn-sm text-primary p-1" onclick="editReport('${report.id}')"><i class="fas fa-pen fa-xs"></i></button>
                            <button class="btn btn-sm text-danger p-1" onclick="deleteReport('${report.id}')"><i class="fas fa-trash fa-xs"></i></button>
                        </div>
                    </div>
                </div>

                ${!isPaid ? `
                <div class="mt-3 pt-3 border-top" style="border-top-style: dashed !important;">
                    <div class="d-flex justify-content-between align-items-center mb-1 small fw-bold">
                        <span class="${statusClass}">${statusText}</span>
                        <span class="text-muted">לתשלום עד: ${dueDateStr}</span>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 10px; background-color: #f1f5f9;">
                         <div class="progress-bar ${progressClass}" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                ` : ''}

                ${imageHtml}
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    setTimeout(() => {
        updateVisibilityAndTotals();
        generateSafetyInsights();
    }, 150);
}

window.updateVisibilityAndTotals = function () {
    const emptyState = document.getElementById('reports-empty-state');
    const populatedState = document.getElementById('reports-populated-state');
    if (!emptyState || !populatedState) return;

    const reports = currentCar.reports || [];
    if (reports.length === 0) {
        emptyState.classList.remove('d-none');
        populatedState.classList.add('d-none');
        return;
    }

    emptyState.classList.add('d-none');
    populatedState.classList.remove('d-none');

    let totalAmount = 0;
    let totalPoints = 0;

    reports.forEach(r => {
        totalPoints += (parseInt(r.points) || 0);
        if (r.status !== 'paid') {
            totalAmount += (parseInt(r.amount) || 0);
        }
    });

    const amountEl = document.getElementById('total-amount');
    if (amountEl) amountEl.textContent = '₪' + new Intl.NumberFormat('he-IL').format(totalAmount);

    const pointsEl = document.getElementById('total-points');
    const statusBadge = document.getElementById('points-status-badge');
    const pointsProg = document.getElementById('points-progress-bar');

    if (pointsEl) {
        pointsEl.textContent = Math.min(totalPoints, 36);
        let progWidth = Math.min((totalPoints / 36) * 100, 100);
        if (pointsProg) {
            pointsProg.style.width = progWidth + '%';
            pointsProg.className = 'progress-bar ' + (totalPoints >= 24 ? 'bg-danger' : totalPoints >= 12 ? 'bg-warning' : 'bg-success');
        }

        if (statusBadge) {
            if (totalPoints === 0) {
                statusBadge.textContent = 'סטטוס: נקי';
                statusBadge.style.background = '#f0fdf4';
                statusBadge.style.color = '#15803d';
            } else if (totalPoints < 12) {
                statusBadge.textContent = 'סטטוס: מעקב';
                statusBadge.style.background = '#fefce8';
                statusBadge.style.color = '#854d0e';
            } else if (totalPoints < 24) {
                statusBadge.textContent = 'סטטוס: אזהרה';
                statusBadge.style.background = '#fff7ed';
                statusBadge.style.color = '#9a3412';
            } else {
                statusBadge.textContent = 'סטטוס: קריטי';
                statusBadge.style.background = '#fff1f2';
                statusBadge.style.color = '#991b1b';
            }
        }
    }

    const courseContainer = document.getElementById('mandatory-courses-container');
    if (courseContainer) {
        courseContainer.innerHTML = '';
        if (totalPoints >= 12) {
            const courseText = totalPoints >= 36 ? 'פסילת רישיון ל-3 חודשים' :
                totalPoints >= 24 ? 'קורס נהיגה מונעת מתקדם' : 'קורס נהיגה נכונה בסיסי';
            courseContainer.innerHTML = `
                <div class="alert alert-danger border-0 shadow-sm d-flex align-items-center gap-3" style="border-radius:12px;">
                    <i class="fas fa-exclamation-circle fa-lg"></i>
                    <div><strong>שים לב:</strong> עקב צבירת ${totalPoints} נקודות, הנך נדרש ל:${courseText}.</div>
                </div>`;
        }
    }
}

window.generateSafetyInsights = function () {
    const textEl = document.getElementById('safety-insight-text');
    if (!textEl) return;

    const reports = window.currentCar?.reports || [];
    if (reports.length === 0) {
        textEl.textContent = 'נהג למופת! המשך לשמור על חוקי התנועה.';
        return;
    }

    const tips = [];
    const types = reports.reduce((acc, r) => {
        acc[r.typeVal] = (acc[r.typeVal] || 0) + 1;
        return acc;
    }, {});

    if (types['speeding']) tips.push('מומלץ להשתמש בבקרת שיוט בכבישים מהירים לגילוי מוקדם של מצלמות והימנעות מקנסות.');
    if (types['phone']) tips.push('התקן דיבורית איכותית ברכב כדי למנוע היסח דעת וקנסות כבדים בגין שימוש בנייד.');
    if (types['parking']) tips.push('שים לב לשילוט עירוני והשתמש באפליקציות חניה חכמות (כגון פנגו/סלופארק) כדי להימנע מדוחות.');

    tips.push('זכור: צבירת 36 נקודות תגרור שלילת רישיון נהיגה ל-3 חודשים לפחות.');
    tips.push('נהיגה מונעת מצילה חיים - הקפד על שמירת מרחק ראוי מהרכב שלפניך.');

    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    textEl.textContent = randomTip;
}

window.toggleCustomType = function (val) {
    const container = document.getElementById('custom-type-container');
    if (container) container.style.display = (val === 'other' ? 'block' : 'none');
}

window.openAddReportModal = function () {
    const form = document.getElementById('add-report-form');
    if (form) form.reset();
    document.getElementById('reportIdField').value = '';
    const previewImg = document.getElementById('reportSingleImagePreview');
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }

    const modalTitle = document.querySelector('#addReportModal .modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle me-2"></i>הוספת דוח תנועה חדש';
    }

    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.max = today;
    }

    const modal = new bootstrap.Modal(document.getElementById('addReportModal'));
    modal.show();
}

window.saveReport = function (e) {
    e.preventDefault();
    const id = document.getElementById('reportIdField').value;
    const typeSelect = document.getElementById('report-type-select').value;
    const typeCustom = document.getElementById('report-type-custom').value;
    const typeVal = (typeSelect === 'other' ? ('other:' + typeCustom) : typeSelect);

    const images = currentBase64ReportImage ? [currentBase64ReportImage] : [];

    const reportDateStr = document.getElementById('report-date').value;
    const reportDate = new Date(reportDateStr);
    const dueDateObj = new Date(reportDate);
    dueDateObj.setDate(dueDateObj.getDate() + 90);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const reportData = {
        id: id || Date.now().toString(),
        typeVal: typeVal,
        title: offenseTitles[typeSelect] || typeCustom || 'עבירת תנועה',
        date: reportDateStr,
        dueDate: dueDateStr,
        location: document.getElementById('report-location').value,
        amount: document.getElementById('report-amount-input').value,
        points: document.getElementById('report-points-input').value,
        status: 'unpaid',
        images: images
    };

    if (!currentCar.reports) currentCar.reports = [];

    if (id) {
        const idx = currentCar.reports.findIndex(r => String(r.id) === String(id));
        if (idx > -1) {
            // Preserve status if editing an unpaid report but it might have been changed elsewhere
            reportData.status = currentCar.reports[idx].status || 'unpaid';
            currentCar.reports[idx] = reportData;
        }
    } else {
        currentCar.reports.push(reportData);
    }

    const modalEl = document.getElementById('addReportModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    saveToLocalStorage();
    loadReports();
}

window.editReport = function (id) {
    const report = currentCar.reports.find(r => String(r.id) === String(id));
    if (!report) return;

    document.getElementById('reportIdField').value = report.id;

    const typeVal = report.typeVal || '';
    if (typeVal.startsWith('other:')) {
        document.getElementById('report-type-select').value = 'other';
        document.getElementById('report-type-custom').value = typeVal.substring(6);
        document.getElementById('custom-type-container').style.display = 'block';
    } else {
        document.getElementById('report-type-select').value = typeVal;
        document.getElementById('custom-type-container').style.display = 'none';
    }

    document.getElementById('report-date').value = window.toInputDate(report.date);
    document.getElementById('report-location').value = report.location || '';
    document.getElementById('report-amount-input').value = report.amount || 0;
    document.getElementById('report-points-input').value = report.points || 0;

    const previewImg = document.getElementById('reportSingleImagePreview');
    if (previewImg) {
        if (report.images && report.images.length > 0) {
            previewImg.src = report.images[0];
            previewImg.style.display = 'block';
        } else {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
    }

    const modalTitle = document.querySelector('#addReportModal .modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit me-2"></i>עריכת דוח קיים';
    }

    const modal = new bootstrap.Modal(document.getElementById('addReportModal'));
    modal.show();
}

window.deleteReport = function (id) {
    if (confirm('האם אתה בטוח שברצונך למחוק דוח זה?')) {
        currentCar.reports = currentCar.reports.filter(r => String(r.id) !== String(id));
        saveToLocalStorage();
        loadReports();
    }
}

window.markAsPaid = function (id) {
    const report = currentCar.reports.find(r => String(r.id) === String(id));
    if (report) {
        report.status = 'paid';
        saveToLocalStorage();
        loadReports();
    }
}

window.markAsUnpaid = function (id) {
    const report = currentCar.reports.find(r => String(r.id) === String(id));
    if (report) {
        report.status = 'unpaid';
        saveToLocalStorage();
        loadReports();
    }
}

window.filterReports = function (status) {
    const container = document.getElementById('reports-list-container');
    const items = container.querySelectorAll('.report-item');
    const btn = document.getElementById('reportFilterBtn');

    btn.innerHTML = `<i class="fas fa-filter me-1"></i> ${status === 'all' ? 'הכל' : status === 'unpaid' ? 'רק פתוחים' : 'שולמו'}`;

    items.forEach(item => {
        if (status === 'all') item.style.display = 'block';
        else if (status === 'unpaid' && item.dataset.status !== 'paid') item.style.display = 'block';
        else if (status === 'paid' && item.dataset.status === 'paid') item.style.display = 'block';
        else item.style.display = 'none';
    });
}

// Handle image uploads via button
let currentBase64ReportImage = null;
let currentReportImageType = null;

document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'reportImageInput') {
        const file = e.target.files[0];
        if (!file) return;

        currentReportImageType = file.type;
        const reader = new FileReader();

        reader.onload = function (event) {
            if (file.type.startsWith('image/') && typeof window.compressImage === 'function') {
                window.compressImage(event.target.result, 800, 0.7, function (compressed) {
                    currentBase64ReportImage = compressed;
                    renderReportImagePreview();
                });
            } else {
                currentBase64ReportImage = event.target.result;
                renderReportImagePreview();
            }
        };
        reader.readAsDataURL(file);
    }
});

window.renderReportImagePreview = function () {
    const placeholder = document.getElementById('reportUploadPlaceholder');
    const previewContainer = document.getElementById('reportPreviewContainer');
    const previewArea = document.getElementById('reportPreviewArea');

    if (!placeholder || !previewContainer || !previewArea) return;

    if (currentBase64ReportImage) {
        placeholder.classList.add('d-none');
        previewContainer.classList.remove('d-none');

        const isPdf = currentReportImageType === 'application/pdf';
        const displaySrc = isPdf ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : currentBase64ReportImage;
        const previewType = isPdf ? 'pdf' : 'image';

        previewArea.innerHTML = `
        <div class="position-relative d-inline-block" style="cursor: pointer;" onclick="window.showFilePreview('${currentBase64ReportImage}', '${previewType}')">
            <img src="${displaySrc}" class="img-fluid rounded shadow-sm bg-white" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff; padding: ${isPdf ? '10px' : '0'}">
            <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="event.stopPropagation(); removeReportImage()" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%); z-index: 2;">
                <i class="fas fa-times" style="font-size: 10px;"></i>
            </button>
            <div class="position-absolute bottom-0 start-50 translate-middle-x w-100 text-center" style="background: rgba(0,0,0,0.5); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
                <i class="fas fa-eye text-white" style="font-size: 10px; padding: 2px 0;"></i>
            </div>
        </div>`;
    } else {
        placeholder.classList.remove('d-none');
        previewContainer.classList.add('d-none');
        previewArea.innerHTML = '';
    }
}

window.removeReportImage = function () {
    currentBase64ReportImage = null;
    currentReportImageType = null;
    const input = document.getElementById('reportImageInput');
    if (input) input.value = '';
    renderReportImagePreview();
}

// Ensure the form reset clears the upload too
document.addEventListener('hidden.bs.modal', function (e) {
    if (e.target.id === 'addReportModal') {
        removeReportImage();
    }
});

// INITIALIZE FORM SUBMISSION VIA DELEGATION (Crucial for dynamic loading)
document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'add-report-form') {
        window.saveReport(e);
    }
});

window.openReportImage = function (src) {
    const preview = document.getElementById('reportImageModalPreview');
    if (preview) {
        preview.src = src;
        const modal = new bootstrap.Modal(document.getElementById('reportImageModal'));
        modal.show();
    }
};

// Attach autocomplete to report location exactly like treatments
(function initReportLocationAutocomplete() {
    const tryAttach = () => {
        if (typeof window.attachAddressAutocomplete === 'function') {
            window.attachAddressAutocomplete(document.getElementById('report-location'));
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryAttach);
    } else {
        tryAttach();
    }
    // Also try on modal open (inputs may be lazy)
    document.addEventListener('show.bs.modal', () => setTimeout(tryAttach, 100));
})();
