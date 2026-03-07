// --- MODULE: INSURANCE & OTHERS ---
const insTypeNames = {
    'mandatory': 'ביטוח חובה',
    'comprehensive': 'ביטוח מקיף',
    'thirdparty': 'ביטוח צד ג\''
};

window.loadInsurance = function () {
    const types = ['mandatory', 'comprehensive', 'thirdparty'];

    types.forEach(type => {
        const insData = currentCar.insurance[type];

        const statusBadge = document.getElementById(`status-${type}`);
        const companyEl = document.getElementById(`company-${type}`);
        const policyEl = document.getElementById(`policy-${type}`);
        const costEl = document.getElementById(`cost-${type}`);
        const dateEl = document.getElementById(`date-${type}`);
        const viewBtn = document.getElementById(`view-${type}`);

        if (insData && insData.date) {
            companyEl.textContent = insData.company || '--';
            policyEl.textContent = insData.policyNum || '--';
            costEl.textContent = insData.cost ? parseInt(insData.cost).toLocaleString() + ' ₪' : '--';
            dateEl.textContent = insData.date;

            if (typeof isDateFuture === 'function' && isDateFuture(insData.date)) {
                statusBadge.textContent = 'פעיל';
                statusBadge.className = 'badge bg-success position-absolute top-0 end-0 m-3';
            } else {
                statusBadge.textContent = 'פג תוקף';
                statusBadge.className = 'badge bg-danger position-absolute top-0 end-0 m-3';
            }

            if (insData.file) {
                viewBtn.classList.remove('d-none');
            } else {
                viewBtn.classList.add('d-none');
            }
        } else {
            companyEl.textContent = '--';
            policyEl.textContent = '--';
            costEl.textContent = '--';
            dateEl.textContent = '--';
            statusBadge.textContent = 'חסר';
            statusBadge.className = 'badge bg-secondary position-absolute top-0 end-0 m-3';
            viewBtn.classList.add('d-none');
        }
    });
}

window.openEditInsurance = function (type) {
    document.getElementById('insType').value = type;
    document.getElementById('editInsuranceModalTitle').textContent = 'עריכת ' + insTypeNames[type];

    const insData = currentCar.insurance[type] || {};
    document.getElementById('insCompany').value = insData.company || '';
    document.getElementById('insPolicyNum').value = insData.policyNum || '';
    document.getElementById('insCost').value = insData.cost || '';

    const dateParts = (insData.date || '').split('/');
    if (dateParts.length === 3) {
        document.getElementById('insDate').value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    } else {
        document.getElementById('insDate').value = insData.date || '';
    }

    document.getElementById('insDoc').value = '';

    const deleteBtn = document.getElementById('insDeleteBtn');
    if (insData.date) {
        deleteBtn.classList.remove('d-none');
    } else {
        deleteBtn.classList.add('d-none');
    }

    new bootstrap.Modal(document.getElementById('editInsuranceModal')).show();
}

window.saveInsurance = function () {
    const type = document.getElementById('insType').value;
    const company = document.getElementById('insCompany').value;
    const policyNum = document.getElementById('insPolicyNum').value;
    const cost = document.getElementById('insCost').value;
    const dateInput = document.getElementById('insDate').value;
    const file = document.getElementById('insDoc').files[0];

    if (!dateInput) {
        alert('יש להזין תוקף ביטוח');
        return;
    }

    const finishSave = (base64Doc) => {
        if (!currentCar.insurance[type]) {
            currentCar.insurance[type] = {};
        }

        currentCar.insurance[type].company = company;
        currentCar.insurance[type].policyNum = policyNum;
        currentCar.insurance[type].cost = cost ? parseInt(cost) : 0;

        const dateParts = dateInput.split('-');
        if (dateParts.length === 3) {
            currentCar.insurance[type].date = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        } else {
            currentCar.insurance[type].date = dateInput;
        }

        if (base64Doc) {
            currentCar.insurance[type].file = base64Doc;
        }

        try {
            window.saveToLocalStorage();
        } catch (err) {
            console.error("Storage Error on Insurance File:", err);
            // Revert just the file so the other data can save
            delete currentCar.insurance[type].file;
            alert('המסמך שצירפת שוקל יותר מדי וחורג מגבלות הזיכרון (2MB). הביטוח נשמר ללא תמונה.');
            window.saveToLocalStorage(); // Try saving again without the large file
        }

        window.loadInsurance();
        if (typeof window.loadOverview === 'function') window.loadOverview();

        bootstrap.Modal.getInstance(document.getElementById('editInsuranceModal')).hide();
        document.getElementById('editInsuranceForm').reset();
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            finishSave(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        finishSave(null);
    }
}

window.deleteInsurance = function () {
    if (confirm('האם אתה בטוח שברצונך למחוק ביטוח זה?')) {
        const type = document.getElementById('insType').value;
        if (currentCar.insurance[type]) {
            delete currentCar.insurance[type];
            window.saveToLocalStorage();
            window.loadInsurance();
            if (typeof window.loadOverview === 'function') window.loadOverview();

            bootstrap.Modal.getInstance(document.getElementById('editInsuranceModal')).hide();
        }
    }
}

window.viewInsuranceDoc = function (type) {
    const insData = currentCar.insurance[type];
    if (insData && insData.file) {
        document.getElementById('insuranceDocPreview').src = insData.file;
        new bootstrap.Modal(document.getElementById('insuranceDocModal')).show();
    }
}
