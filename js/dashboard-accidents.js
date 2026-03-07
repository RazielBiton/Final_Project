// --- MODULE: ACCIDENTS ---
window.loadAccidents = function () {
    const listContainer = document.getElementById('accidents-list-container');
    const emptyState = document.getElementById('accidents-empty-state');
    const populatedState = document.getElementById('accidents-populated-state');

    if (!listContainer || !emptyState || !populatedState) return;

    listContainer.innerHTML = ''; // Clear container

    // Ensure array exists
    if (!currentCar.accidents) currentCar.accidents = [];

    if (currentCar.accidents.length === 0) {
        emptyState.classList.remove('d-none');
        populatedState.classList.add('d-none');
        return;
    } else {
        emptyState.classList.add('d-none');
        populatedState.classList.remove('d-none');
    }

    // Sort by status first (resolved last), then date descending
    const sortedAccidents = [...currentCar.accidents].sort((a, b) => {
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;

        const da = a.date.split('/').reverse().join('-');
        const db = b.date.split('/').reverse().join('-');
        return new Date(db) - new Date(da);
    });

    sortedAccidents.forEach(acc => {
        const isResolved = acc.status === 'resolved';
        const statusBadgeClass = isResolved ? 'bg-success' : 'bg-warning text-dark';
        const statusIcon = isResolved ? 'fa-check-circle' : 'fa-exclamation-circle';
        const statusText = isResolved ? 'טופל ותוקן' : 'ממתין לטיפול';

        // Formatted Date
        const badgeHtml = `<span class="badge ${statusBadgeClass} rounded-pill px-3 py-2 shadow-sm"><i class="fas ${statusIcon} me-1"></i> ${statusText}</span>`;

        let involvedHtml = '';
        if (acc.involvedVehicles && acc.involvedVehicles.length > 0) {
            let vhtml = acc.involvedVehicles.map(v => {
                let logoHtml = v.logo ? `<img src="${v.logo}" class="rounded-circle border ms-2 bg-white" width="30" height="30" style="object-fit: contain; padding: 2px;">` : '';
                return `
                <div class="d-flex align-items-center justify-content-between mt-2">
                    <div class="d-flex align-items-center">
                        ${logoHtml}
                        <div>
                            <span class="fw-bold text-dark d-block" style="font-size: 0.9rem;">${v.title || 'רכב לא ידוע'}</span>
                            <span class="text-muted small">${v.color || '-'} | שנת ${v.year || '-'}</span>
                        </div>
                    </div>
                    <div class="badge ${isResolved ? 'bg-secondary' : 'bg-light border border-secondary'} text-dark px-2 py-1 mx-2" dir="ltr" style="font-size: 0.75rem;">
                        ${v.plate} <span class="ms-1">🇮🇱</span>
                    </div>
                </div>
            `}).join('');

            involvedHtml = `
            <div class="mt-3 p-2 rounded" style="background-color: ${isResolved ? '#e9ecef' : '#fff3f3'}; border-right: 3px solid ${isResolved ? '#6c757d' : '#e63946'};">
                <small class="${isResolved ? 'text-secondary' : 'text-danger'} fw-bold mb-1 d-block"><i class="fas fa-car-side me-1"></i> כלי רכב מעורבים (${acc.involvedVehicles.length})</small>
                ${vhtml}
            </div>`;
        } else if (acc.involvedVehicle && acc.involvedVehicle.plate) {
            // Backwards compatibility
            let logoHtml = acc.involvedVehicle.logo ? `<img src="${acc.involvedVehicle.logo}" class="rounded-circle border ms-2 bg-white" width="30" height="30" style="object-fit: contain; padding: 2px;">` : '';
            involvedHtml = `
            <div class="mt-3 p-2 rounded" style="background-color: ${isResolved ? '#e9ecef' : '#fff3f3'}; border-right: 3px solid ${isResolved ? '#6c757d' : '#e63946'};">
                <small class="${isResolved ? 'text-secondary' : 'text-danger'} fw-bold mb-1 d-block"><i class="fas fa-car-side me-1"></i> כלי רכב מעורבים (1)</small>
                <div class="d-flex align-items-center justify-content-between mt-2">
                    <div class="d-flex align-items-center">
                        ${logoHtml}
                        <div>
                            <span class="fw-bold text-dark d-block" style="font-size: 0.9rem;">${acc.involvedVehicle.title || 'רכב לא ידוע'}</span>
                            <span class="text-muted small">${acc.involvedVehicle.color || '-'} | שנת ${acc.involvedVehicle.year || '-'}</span>
                        </div>
                    </div>
                    <div class="badge ${isResolved ? 'bg-secondary' : 'bg-light border border-secondary'} text-dark px-2 py-1 mx-2" dir="ltr" style="font-size: 0.75rem;">
                        ${acc.involvedVehicle.plate} <span class="ms-1">🇮🇱</span>
                    </div>
                </div>
            </div>`;
        }

        let imageHtml = '';
        if (acc.images && acc.images.length > 0) {
            let imgsHtml = acc.images.map((img, idx) => `
                <img src="${img}" class="img-fluid rounded shadow-sm m-1" style="height: 60px; width: 60px; object-fit: cover; cursor: pointer; display: inline-block; filter: ${isResolved ? 'grayscale(80%) opacity(0.8)' : 'none'};" onclick="viewAccidentImage('${acc.id}', ${idx})" title="לחץ להגדלה">
            `).join('');
            imageHtml = `<div class="mt-3 text-start">${imgsHtml}</div>`;
        } else if (acc.image) {
            // Backwards compatibility
            imageHtml = `<div class="mt-3 text-start"><img src="${acc.image}" class="img-fluid rounded shadow-sm m-1" style="height: 60px; width: 60px; object-fit: cover; cursor: pointer; display: inline-block; filter: ${isResolved ? 'grayscale(80%) opacity(0.8)' : 'none'};" onclick="viewAccidentImage('${acc.id}', 0)" title="לחץ להגדלה"></div>`;
        }

        const cardBgClass = isResolved ? 'bg-light' : 'bg-white';
        const cardHtml = `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card ${cardBgClass} border-0 shadow-sm h-100" style="border-radius: 12px; transition: transform 0.2s; border-top: 4px solid ${isResolved ? '#6c757d' : '#ffc107'}!important;">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title fw-bold text-dark mb-0">${acc.title}</h5>
                        ${badgeHtml}
                    </div>
                    <h6 class="card-subtitle mb-3 text-muted">
                        <i class="far fa-calendar-alt me-1"></i> ${acc.date} &nbsp;|&nbsp; 
                        <i class="fas fa-shekel-sign me-1"></i> ${parseInt(acc.cost).toLocaleString()}
                    </h6>
                    <p class="card-text text-secondary mb-3 flex-grow-1" style="font-size: 0.95rem;">${acc.description}</p>
                    
                    ${involvedHtml}
                    ${imageHtml}
                </div>
                <div class="card-footer ${cardBgClass} border-top-0 pt-0 pb-3 d-flex justify-content-between">
                    <button class="btn btn-outline-secondary btn-sm rounded-pill fw-bold" onclick="toggleAccidentStatus(${acc.id})">
                        ${isResolved ? '<i class="fas fa-undo me-1"></i> סמן כלא טופל' : '<i class="fas fa-check me-1"></i> הגדר כטופל'}
                    </button>
                    <div>
                        <button class="btn btn-light btn-sm text-primary rounded-circle shadow-sm me-1" onclick="editAccident(${acc.id})" title="ערוך">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-light btn-sm text-danger rounded-circle shadow-sm" onclick="deleteAccident(${acc.id})" title="מחק">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        listContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Modal Toggle Functions
window.openAddAccidentModal = function () {
    document.getElementById('addAccidentForm').reset();
    document.getElementById('accidentId').value = '';
    document.getElementById('accidentModalTitle').innerHTML = '<i class="fas fa-car-crash me-2"></i> דיווח נזק חדש';

    // Bind image listener
    attachAccidentImageListener();

    // Reset image preview
    clearAccidentImage();

    // Reset radio buttons
    document.getElementById('accRadioNo').checked = true;
    toggleInvolvedVehicle();

    new bootstrap.Modal(document.getElementById('addAccidentModal')).show();
}

let currentInvolvedVehicles = [];

window.toggleInvolvedVehicle = function () {
    const isYes = document.getElementById('accRadioYes').checked;
    const container = document.getElementById('involvedVehicleContainer');

    if (isYes) {
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
        document.getElementById('accInvolvedPlate').value = '';
        document.getElementById('involvedCarDetails').classList.add('d-none');
        currentInvolvedVehicles = [];
        renderInvolvedVehicles();
    }
}

// Global Image logic
let currentBase64AccidentImages = [];

window.attachAccidentImageListener = function () {
    const accImageInput = document.getElementById('accImageInput');
    if (accImageInput) {
        accImageInput.onchange = function (e) {
            const files = e.target.files;
            if (files && files.length > 0) {
                Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        if (typeof window.compressImage === 'function') {
                            window.compressImage(event.target.result, 800, 0.7, function (compressed) {
                                currentBase64AccidentImages.push(compressed);
                                renderAccidentImagesPreview();
                            });
                        } else {
                            currentBase64AccidentImages.push(event.target.result);
                            renderAccidentImagesPreview();
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        };
    }
}

window.renderAccidentImagesPreview = function () {
    const listContainer = document.getElementById('accImagesList');
    const placeholder = document.getElementById('accImagePlaceholder');
    const previewContainer = document.getElementById('accImagePreviewsContainer');

    if (!listContainer || !placeholder || !previewContainer) return;

    listContainer.innerHTML = '';

    if (currentBase64AccidentImages.length > 0) {
        placeholder.classList.add('d-none');
        previewContainer.classList.remove('d-none');

        currentBase64AccidentImages.forEach((imgSrc, index) => {
            const imgHtml = `
            <div class="position-relative d-inline-block">
                <img src="${imgSrc}" class="img-fluid rounded shadow-sm" style="height: 80px; width: 80px; object-fit: cover; border: 2px solid #fff;">
                <button type="button" class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 shadow" onclick="removeAccidentImage(${index})" style="width:22px; height:22px; padding:0; line-height:1; transform: translate(30%, -30%);">
                    <i class="fas fa-times" style="font-size: 10px;"></i>
                </button>
            </div>`;
            listContainer.insertAdjacentHTML('beforeend', imgHtml);
        });
    } else {
        placeholder.classList.remove('d-none');
        previewContainer.classList.add('d-none');
    }
}

window.removeAccidentImage = function (index) {
    currentBase64AccidentImages.splice(index, 1);
    renderAccidentImagesPreview();
}

window.clearAccidentImage = function () {
    currentBase64AccidentImages = [];
    const input = document.getElementById('accImageInput');
    if (input) input.value = '';
    renderAccidentImagesPreview();
}

let currentFetchedInvolvedCar = null;

window.renderInvolvedVehicles = function () {
    const container = document.getElementById('selectedInvolvedVehiclesContainer');
    if (!container) return;
    container.innerHTML = '';

    currentInvolvedVehicles.forEach((vehicle, index) => {
        let logoHtml = vehicle.logo ? `<img src="${vehicle.logo}" class="rounded-circle border bg-white ms-2" width="40" height="40" style="object-fit: contain; padding: 2px;">` : '';
        const vHtml = `
        <div class="d-flex align-items-center justify-content-between bg-white p-2 rounded border shadow-sm border-start border-danger border-4">
            <div class="d-flex align-items-center">
                ${logoHtml}
                <div>
                    <span class="fw-bold text-dark d-block fs-7">${vehicle.title}</span>
                    <span class="badge bg-light text-dark border border-secondary shadow-sm px-2 py-1 mt-1" dir="ltr" style="font-size: 0.75rem;">
                        ${vehicle.plate} <span class="ms-1">🇮🇱</span>
                    </span>
                </div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm rounded-circle" onclick="removeInvolvedVehicle(${index})" title="הסר רכב" style="width: 32px; height: 32px; padding: 0;">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
        container.insertAdjacentHTML('beforeend', vHtml);
    });
}

window.removeInvolvedVehicle = function (index) {
    currentInvolvedVehicles.splice(index, 1);
    renderInvolvedVehicles();
}

window.addInvolvedCarToList = function () {
    if (!currentFetchedInvolvedCar) return;

    if (currentInvolvedVehicles.find(v => v.plate === currentFetchedInvolvedCar.plate)) {
        alert("רכב זה כבר נוסף לרשימה");
        return;
    }

    currentInvolvedVehicles.push(currentFetchedInvolvedCar);
    renderInvolvedVehicles();

    document.getElementById('accInvolvedPlate').value = '';
    document.getElementById('involvedCarDetails').classList.add('d-none');
    currentFetchedInvolvedCar = null;
}

window.fetchInvolvedCarDetails = async function () {
    const plate = document.getElementById('accInvolvedPlate').value.trim();
    const btnSearch = document.getElementById('btnFetchInvolved');
    const detailsContainer = document.getElementById('involvedCarDetails');

    if (!plate || plate.length < 5) {
        alert("נא להזין מספר רישוי תקין");
        return;
    }

    btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btnSearch.disabled = true;

    currentFetchedInvolvedCar = null;

    try {
        const carResId = '053cea08-09bc-40ec-8f7a-156f0677aff3';
        const carUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${carResId}&q=${plate}`;

        const response = await fetch(carUrl);
        const data = await response.json();

        if (data.success && data.result.records.length > 0) {
            const car = data.result.records[0];
            const hebrewBrand = car.tozeret_nm.split('-')[0].trim();

            const brandOverrides = {
                'לינק אנד קו': 'lynk-and-co'
            };

            let englishBrandLogo = null;
            try {
                let englishBrand = typeof window.getEnglishBrandName === 'function'
                    ? window.getEnglishBrandName(hebrewBrand)
                    : 'default';

                englishBrandLogo = `images/logos/${englishBrand}.png`;
            } catch (e) { console.log('Translate error', e); }

            currentFetchedInvolvedCar = {
                plate: plate,
                title: `${car.tozeret_nm} ${car.degem_nm}`,
                color: car.tzeva_rechev || 'לא צוין צבע',
                year: car.shnat_yitzur || '-',
                logo: englishBrandLogo
            };

            let finalLogoHtml = englishBrandLogo ? `<img src="${englishBrandLogo}" class="rounded-circle border bg-white" width="40" height="40" style="object-fit: contain; padding:2px;">` : `<i class="fas fa-car fs-4"></i>`;

            document.getElementById('involvedCarTitle').textContent = currentFetchedInvolvedCar.title;
            document.getElementById('involvedCarColor').textContent = currentFetchedInvolvedCar.color;
            document.getElementById('involvedCarYear').textContent = currentFetchedInvolvedCar.year;

            const iconWrapper = document.getElementById('involvedCarDetails').querySelector('.icon-lg-wrapper');
            if (iconWrapper) {
                iconWrapper.innerHTML = finalLogoHtml;
            }

            detailsContainer.classList.remove('d-none');
        } else {
            alert("רכב לא נמצא במאגר");
            detailsContainer.classList.add('d-none');
        }
    } catch (e) {
        console.error(e);
        alert("שגיאה בתקשורת מול המאגר");
    } finally {
        btnSearch.innerHTML = '<i class="fas fa-search me-1"></i> חפש';
        btnSearch.disabled = false;
    }
}

window.saveAccident = function () {
    const idField = document.getElementById('accidentId').value;
    const title = document.getElementById('accTitle').value.trim();
    const cost = document.getElementById('accCost').value.trim();
    const dateInput = document.getElementById('accDate').value;
    const desc = document.getElementById('accDescription').value.trim();

    if (!title || !cost || !dateInput || !desc) {
        alert("נא למלא את כל שדות החובה");
        return;
    }

    const isYes = document.getElementById('accRadioYes').checked;
    let involvedVehiclesToSave = [];

    if (isYes) {
        const plate = document.getElementById('accInvolvedPlate').value.trim();
        const detailsContainer = document.getElementById('involvedCarDetails');

        // Check if there was an active un-added search that the user meant to add
        if (plate && !detailsContainer.classList.contains('d-none') && currentFetchedInvolvedCar) {
            if (!currentInvolvedVehicles.find(v => v.plate === currentFetchedInvolvedCar.plate)) {
                currentInvolvedVehicles.push(currentFetchedInvolvedCar);
            }
        } else if (plate && detailsContainer.classList.contains('d-none') && plate.length >= 5) {
            if (!currentInvolvedVehicles.find(v => v.plate === plate)) {
                currentInvolvedVehicles.push({
                    plate: plate,
                    title: 'לא נבדק במאגר',
                    color: '-',
                    year: '-'
                });
            }
        }

        if (currentInvolvedVehicles.length === 0) {
            alert("נא להוסיף רכב מעורב");
            return;
        }

        involvedVehiclesToSave = [...currentInvolvedVehicles];
    }

    // Convert date string YYYY-MM-DD to DD/MM/YYYY
    const dParts = dateInput.split('-');
    const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

    const newAccident = {
        id: idField ? parseInt(idField) : Date.now(),
        title: title,
        cost: cost,
        date: formattedDate,
        description: desc,
        images: currentBase64AccidentImages,
        involvedVehicles: involvedVehiclesToSave,
        status: idField ? currentCar.accidents.find(a => a.id == idField)?.status : 'unresolved' // preserve status if edit
    };

    if (!currentCar.accidents) currentCar.accidents = [];

    if (idField) {
        // Edit mode
        const index = currentCar.accidents.findIndex(a => a.id == idField);
        if (index !== -1) {
            currentCar.accidents[index] = newAccident;
        }
    } else {
        // Add mode
        currentCar.accidents.push(newAccident);
    }

    saveToLocalStorage();
    loadAccidents();
    // Also re-load overview to potentially include cost in future logic
    if (typeof loadOverview === 'function') loadOverview();

    const addModal = bootstrap.Modal.getInstance(document.getElementById('addAccidentModal'));
    if (addModal) addModal.hide();
}

window.deleteAccident = function (id) {
    if (confirm("האם למחוק דיווח זה? הנתונים לא ניתנים לשחזור.")) {
        currentCar.accidents = currentCar.accidents.filter(a => a.id !== id);
        saveToLocalStorage();
        loadAccidents();
        if (typeof loadOverview === 'function') loadOverview();
    }
}

window.editAccident = function (id) {
    const acc = currentCar.accidents.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('accidentId').value = acc.id;
    document.getElementById('accidentModalTitle').innerHTML = '<i class="fas fa-edit me-2"></i> מתקן דיווח קיים';
    document.getElementById('accTitle').value = acc.title;
    document.getElementById('accCost').value = acc.cost;
    document.getElementById('accDescription').value = acc.description;

    // date from DD/MM/YYYY to YYYY-MM-DD
    if (acc.date) {
        const parts = acc.date.split('/');
        if (parts.length === 3) {
            document.getElementById('accDate').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    // Arrays initialization backwards compatibility
    if (acc.images && acc.images.length > 0) {
        currentBase64AccidentImages = [...acc.images];
    } else if (acc.image) {
        currentBase64AccidentImages = [acc.image];
    } else {
        clearAccidentImage();
    }

    // Render images preview
    renderAccidentImagesPreview();

    if (acc.involvedVehicles && acc.involvedVehicles.length > 0) {
        document.getElementById('accRadioYes').checked = true;

        currentInvolvedVehicles = [...acc.involvedVehicles];
        toggleInvolvedVehicle();
    } else if (acc.involvedVehicle) {
        document.getElementById('accRadioYes').checked = true;

        currentInvolvedVehicles = [acc.involvedVehicle];
        toggleInvolvedVehicle();
    } else {
        document.getElementById('accRadioNo').checked = true;
        toggleInvolvedVehicle();
    }

    new bootstrap.Modal(document.getElementById('addAccidentModal')).show();
}

window.toggleAccidentStatus = function (id) {
    const acc = currentCar.accidents.find(a => a.id === id);
    if (acc) {
        acc.status = acc.status === 'resolved' ? 'unresolved' : 'resolved';
        saveToLocalStorage();
        loadAccidents();
    }
}

window.viewAccidentImage = function (id, imageIndex = 0) {
    const acc = currentCar.accidents.find(a => a.id == id);
    if (!acc) return;

    let targetImage = null;

    if (acc.images && acc.images.length > imageIndex) {
        targetImage = acc.images[imageIndex];
    } else if (acc.image) {
        targetImage = acc.image; // backwards compat
    }

    if (targetImage) {
        document.getElementById('accidentImageModalPreview').src = targetImage;
        new bootstrap.Modal(document.getElementById('accidentImageModal')).show();
    }
}
