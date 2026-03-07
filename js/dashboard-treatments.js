// --- MODULE: TREATMENTS & INVOICES ---
window.loadTreatments = function () {
    const tbody = document.getElementById('treatmentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Ensure array exists
    if (!currentCar.treatments) currentCar.treatments = [];

    // Stats
    const statTreatments = document.getElementById('stat-total-treatments');
    if (statTreatments) statTreatments.textContent = currentCar.treatments.length;

    const totalCost = currentCar.treatments.reduce((acc, t) => acc + (parseInt(t.cost) || 0), 0);
    const statCosts = document.getElementById('stat-total-cost');
    if (statCosts) statCosts.textContent = totalCost.toLocaleString() + ' ₪';

    currentCar.treatments.forEach(t => {
        const tr = document.createElement('tr');

        // Highlight row if invoice is missing
        if (!t.invoice) {
            tr.style.backgroundColor = '#fdeaea'; // light red background
        }

        let invoiceHtml = '<span class="text-muted">-</span>';
        if (t.invoice) {
            invoiceHtml = `<button class="btn btn-sm btn-link" onclick="window.viewInvoice('${t.id}')"><i class="fas fa-file-image"></i> צפה</button>`;
        }

        tr.innerHTML = `
            <td>${t.date}</td>
            <td>${t.type}</td>
            <td>${t.garage}</td>
            <td>${t.km.toLocaleString()}</td>
            <td>${invoiceHtml}</td>
            <td>${parseInt(t.cost).toLocaleString()} ₪</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" style="margin-left: 5px;" onclick="window.openEditTreatmentModal(${t.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTreatment(${t.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.saveTreatment = function () {
    const tName = document.getElementById('tName').value;
    const tDate = document.getElementById('tDate').value;
    const tGarage = document.getElementById('tGarage').value;
    const tKm = document.getElementById('tKm').value;
    const tCost = document.getElementById('tCost').value;
    const tFile = document.getElementById('tInvoice').files[0];

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    // Function to finish saving after (optional) file read
    const finishSave = (base64Invoice) => {
        const newTreatment = {
            id: Date.now(),
            type: tName,
            date: tDate,
            garage: tGarage,
            km: parseInt(tKm),
            cost: parseInt(tCost),
            invoice: base64Invoice || null
        };

        if (!currentCar.treatments) {
            currentCar.treatments = [];
        }

        // Auto-update global mileage if the treatment km is higher
        const parsedKm = parseInt(tKm);
        const currentKm = parseInt(currentCar.km) || 0;
        if (parsedKm > currentKm) {
            currentCar.km = parsedKm;
            // Instantly update the Header visual if it exists
            const headerKmElem = document.getElementById('vehicleKm');
            if (headerKmElem) headerKmElem.textContent = parsedKm.toLocaleString();
        }

        currentCar.treatments.push(newTreatment);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview(); // Update expenses

        // Modal & Reset
        const addModal = bootstrap.Modal.getInstance(document.getElementById('addTreatmentModal'));
        if (addModal) addModal.hide();
        document.getElementById('addTreatmentForm').reset();
    };

    if (tFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (typeof compressImage === 'function') {
                window.compressImage(e.target.result, 800, 0.7, finishSave);
            } else {
                finishSave(e.target.result); // Fallback if no compression method found
            }
        };
        reader.readAsDataURL(tFile);
    } else {
        finishSave(null);
    }
}

window.deleteTreatment = function (id) {
    if (confirm('האם למחוק טיפול זה?')) {
        currentCar.treatments = currentCar.treatments.filter(t => t.id !== id);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();
    }
}

window.viewInvoice = function (tId) {
    const t = currentCar.treatments.find(x => x.id == tId);
    if (t && t.invoice) {
        document.getElementById('invoicePreviewImg').src = t.invoice;
        new bootstrap.Modal(document.getElementById('invoiceModal')).show();
    }
}

window.openEditTreatmentModal = function (tId) {
    const t = currentCar.treatments.find(x => x.id === tId);
    if (!t) return;

    document.getElementById('editTId').value = t.id;
    document.getElementById('editTName').value = t.type;
    document.getElementById('editTDate').value = t.date;
    document.getElementById('editTGarage').value = t.garage;
    document.getElementById('editTKm').value = t.km;
    document.getElementById('editTCost').value = t.cost;

    // Clear invoice input so previous file label reflects 'unchanged' if no new file is added
    document.getElementById('editTInvoice').value = "";

    new bootstrap.Modal(document.getElementById('editTreatmentModal')).show();
}

window.updateTreatment = function () {
    const tId = parseInt(document.getElementById('editTId').value);
    const tName = document.getElementById('editTName').value;
    const tDate = document.getElementById('editTDate').value;
    const tGarage = document.getElementById('editTGarage').value;
    const tKm = document.getElementById('editTKm').value;
    const tCost = document.getElementById('editTCost').value;
    const tFile = document.getElementById('editTInvoice').files[0];

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    const tIndex = currentCar.treatments.findIndex(x => x.id === tId);
    if (tIndex === -1) return;

    const finishUpdate = (base64Invoice) => {
        currentCar.treatments[tIndex].type = tName;
        currentCar.treatments[tIndex].date = tDate;
        currentCar.treatments[tIndex].garage = tGarage;
        currentCar.treatments[tIndex].km = parseInt(tKm);
        currentCar.treatments[tIndex].cost = parseInt(tCost);

        if (base64Invoice) {
            currentCar.treatments[tIndex].invoice = base64Invoice;
        }

        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();

        const editModal = bootstrap.Modal.getInstance(document.getElementById('editTreatmentModal'));
        if (editModal) editModal.hide();
        document.getElementById('editTreatmentForm').reset();
    };

    if (tFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (typeof compressImage === 'function') {
                window.compressImage(e.target.result, 800, 0.7, finishUpdate);
            } else {
                finishUpdate(e.target.result); // Fallback
            }
        };
        reader.readAsDataURL(tFile);
    } else {
        finishUpdate(null);
    }
}
