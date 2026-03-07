// --- MODULE: FUEL TRACKING ---
let fetchedEnergyPrices = false;
window.livePrices = { fuel95: '7.02', elecKwh: '0.6402', fuel98: '8.37' };

window.loadFuel = function () {
    if (!currentCar.fuelLog) currentCar.fuelLog = [];

    const addBtn = document.getElementById('addFuelBtn');
    const evMessage = document.getElementById('evFuelMessage');
    const historyContainer = document.getElementById('fuelHistoryContainer');
    const listContainer = document.getElementById('fuel-list');
    const kpiCards = document.getElementById('fuel-kpi-cards');

    if (!listContainer) return;

    // 1. Calculate and update KPI Cards
    const totalRefuels = currentCar.fuelLog.length;
    const totalCost = currentCar.fuelLog.reduce((sum, f) => sum + (Number(f.cost) || 0), 0);

    if (document.getElementById('fuel-total-count')) document.getElementById('fuel-total-count').textContent = totalRefuels;
    if (document.getElementById('fuel-total-cost')) document.getElementById('fuel-total-cost').textContent = `₪${new Intl.NumberFormat('he-IL').format(totalCost)}`;

    if (!fetchedEnergyPrices) {
        fetchIsraelEnergyPrices();
    }

    // 2. Determine Vehicle Type Details
    const ft = currentCar.fuelType || "";
    const isEV = ft === "חשמל";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    // Update Add Button Text dynamically
    if (isEV) {
        addBtn.innerHTML = `<i class="fas fa-charging-station me-2"></i> הוסף טעינה`;
        addBtn.className = "db-btn db-btn-primary";
    } else if (isHybrid) {
        addBtn.innerHTML = `<i class="fas fa-bolt me-1"></i>/<i class="fas fa-gas-pump mx-1"></i> הוסף הזנת אנרגיה`;
        addBtn.className = "db-btn db-btn-primary";
    } else {
        addBtn.innerHTML = `<i class="fas fa-gas-pump me-2"></i> הוסף תדלוק`;
        addBtn.className = "db-btn db-btn-primary";
    }

    addBtn.classList.remove('d-none');
    evMessage.classList.add('d-none');
    historyContainer.classList.remove('d-none');

    // 3. Render List
    if (currentCar.fuelLog.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-gas-pump fa-3x mb-3 opacity-25"></i>
                <p>אין נתוני אנרגיה להצגה.</p>
            </div>
        `;
        return;
    }

    // Sort descending by date
    const sortedFuel = [...currentCar.fuelLog].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sortedFuel.forEach(f => {
        const isElectricity = f.energyType === 'electricity';

        // Define display attributes based on energy type
        const amountText = f.amount ? (isElectricity ? `${f.amount} קוט״ש` : `${f.amount} ליטר`) : 'כמות לא צוינה';
        const titleText = isElectricity ? 'טעינת חשמל' : 'תדלוק בנזין';
        const iconClass = isElectricity ? 'fa-charging-station' : 'fa-gas-pump';
        const bgClass = isElectricity ? 'bg-success text-white' : 'bg-warning text-dark';
        const amountIcon = isElectricity ? 'fa-bolt' : 'fa-fill-drip';

        const dateFormatted = new Date(f.date).toLocaleString('he-IL', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        html += `
            <div class="db-list-item d-flex justify-content-between align-items-center flex-wrap" style="border-left:none; border-right:none; border-top:none;">
                <div class="d-flex align-items-center mb-2 mb-sm-0">
                    <div class="icon-lg-wrapper ${bgClass} ms-3 rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <div>
                        <h6 class="m-0 fw-bold primary-text">${titleText}</h6>
                        <small class="text-muted"><i class="fas fa-calendar-alt me-1"></i> ${dateFormatted} | <i class="fas ${amountIcon} me-1"></i> ${amountText}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <h5 class="m-0 fw-bold me-3 text-dark">₪${new Intl.NumberFormat('he-IL').format(f.cost)}</h5>
                    <button class="db-btn db-btn-sm text-secondary p-1 me-1" onclick="editFuel('${f.id}')" title="ערוך"><i class="fas fa-edit"></i></button>
                    <button class="db-btn db-btn-sm text-danger p-1" onclick="deleteFuel('${f.id}')" title="מחק"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;
};

window.toggleEnergyFields = function () {
    const isElectricSelected = document.getElementById('energyElectric').checked;
    const amountLabel = document.getElementById('fAmountLabel');
    const amountInput = document.getElementById('fAmount');
    const priceInput = document.getElementById('fPricePerUnit');
    const priceLabel = document.getElementById('fPriceLabel');

    if (isElectricSelected) {
        amountLabel.textContent = 'כמות קוט״ש (אופציונלי)';
        amountInput.placeholder = "לדוג': 45.5";
        priceLabel.textContent = 'מחיר לקוט״ש (₪)';
        priceInput.value = window.livePrices.elecKwh;
    } else {
        amountLabel.textContent = 'כמות ליטרים (אופציונלי)';
        amountInput.placeholder = "לדוג': 25";
        priceLabel.textContent = 'מחיר לליטר (₪)';
        priceInput.value = window.livePrices.fuel95;
    }

    // Recalculate cost if amount exists
    calculateTotalFuelCost();
};

window.calculateTotalFuelCost = function () {
    const amount = parseFloat(document.getElementById('fAmount').value);
    const price = parseFloat(document.getElementById('fPricePerUnit').value);
    const costInput = document.getElementById('fCost');

    if (!isNaN(amount) && !isNaN(price) && amount > 0 && price > 0) {
        costInput.value = (amount * price).toFixed(2);
    }
};

window.calculatePricePerUnit = function () {
    const amount = parseFloat(document.getElementById('fAmount').value);
    const cost = parseFloat(document.getElementById('fCost').value);
    const priceInput = document.getElementById('fPricePerUnit');

    if (!isNaN(amount) && !isNaN(cost) && amount > 0 && cost > 0) {
        priceInput.value = (cost / amount).toFixed(4);
    }
};

window.openAddFuelModal = function () {
    document.getElementById('add-fuel-form').reset();
    document.getElementById('editFuelId').value = ""; // Reset edit ID

    const ft = currentCar.fuelType || "";
    const isEV = ft === "חשמל";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    const selectorDiv = document.getElementById('energyTypeSelector');
    const modalTitle = document.getElementById('addFuelModalTitle');
    const submitBtn = document.getElementById('saveFuelSubmitBtn');

    if (isHybrid) {
        // Show radio buttons
        selectorDiv.classList.remove('d-none');
        document.getElementById('energyPetrol').checked = true; // default
        modalTitle.textContent = 'הוספת הזנת אנרגיה';
        submitBtn.textContent = 'שמור הזנה';
    } else {
        // Hide radio buttons and force correct value
        selectorDiv.classList.add('d-none');
        if (isEV) {
            document.getElementById('energyElectric').checked = true;
            modalTitle.textContent = 'הוספת רישום טעינה';
            submitBtn.textContent = 'שמור טעינה';
        } else {
            document.getElementById('energyPetrol').checked = true;
            modalTitle.textContent = 'הוספת תדלוק חדש';
            submitBtn.textContent = 'שמור תדלוק';
        }
    }

    // Adjust hints and pull default prices
    toggleEnergyFields();

    // Set current time as default
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('fDate').value = now.toISOString().slice(0, 16);

    new bootstrap.Modal(document.getElementById('addFuelModal')).show();
};

window.editFuel = function (id) {
    const record = currentCar.fuelLog.find(f => f.id === id);
    if (!record) return;

    // 1. Setup UI similarly to open modal rules
    const ft = currentCar.fuelType || "";
    const isEV = ft === "חשמל";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    const selectorDiv = document.getElementById('energyTypeSelector');
    const modalTitle = document.getElementById('addFuelModalTitle');
    const submitBtn = document.getElementById('saveFuelSubmitBtn');

    modalTitle.textContent = 'עריכת רישום קודם';
    submitBtn.textContent = 'עדכן רישום';

    if (isHybrid) {
        selectorDiv.classList.remove('d-none');
    } else {
        selectorDiv.classList.add('d-none');
    }

    // 2. Select Radio based on type
    if (record.energyType === 'electricity') {
        document.getElementById('energyElectric').checked = true;
    } else {
        document.getElementById('energyPetrol').checked = true;
    }

    toggleEnergyFields(); // Update labels

    // 3. Fill existing values
    document.getElementById('editFuelId').value = record.id;
    document.getElementById('fDate').value = record.date;
    document.getElementById('fAmount').value = record.amount || "";
    document.getElementById('fCost').value = record.cost;

    // Calculate price per unit backwards if both amount and cost exist
    if (record.amount && record.amount > 0 && record.cost && record.cost > 0) {
        document.getElementById('fPricePerUnit').value = (record.cost / record.amount).toFixed(4);
    }

    new bootstrap.Modal(document.getElementById('addFuelModal')).show();
};

window.saveFuel = function () {
    const editId = document.getElementById('editFuelId').value;
    const cost = document.getElementById('fCost').value;
    const date = document.getElementById('fDate').value;
    const amount = document.getElementById('fAmount').value;
    const energyType = document.getElementById('energyElectric').checked ? 'electricity' : 'fuel';

    if (!cost || !date) {
        alert('יש למלא עלות ותאריך.');
        return;
    }

    if (!currentCar.fuelLog) currentCar.fuelLog = [];

    if (editId) {
        // Edit mode
        const idx = currentCar.fuelLog.findIndex(f => f.id === editId);
        if (idx > -1) {
            currentCar.fuelLog[idx] = {
                ...currentCar.fuelLog[idx],
                cost: Number(cost),
                date: date,
                amount: amount ? Number(amount) : null,
                energyType: energyType
            };
        }
    } else {
        // Add Mode
        const newFuel = {
            id: Date.now().toString(),
            cost: Number(cost),
            date: date,
            amount: amount ? Number(amount) : null,
            energyType: energyType
        };
        currentCar.fuelLog.push(newFuel);
    }

    saveToLocalStorage();
    bootstrap.Modal.getInstance(document.getElementById('addFuelModal')).hide();

    // Refresh globally
    loadFuel();
    if (typeof loadOverview === 'function') loadOverview();
    if (typeof loadExpenses === 'function') loadExpenses();
};

window.deleteFuel = function (id) {
    if (confirm('האם אתה בטוח שברצונך למחוק תיעוד תדלוק זה?')) {
        currentCar.fuelLog = currentCar.fuelLog.filter(f => f.id !== id);
        saveToLocalStorage();

        // Refresh globally
        loadFuel();
        if (typeof loadOverview === 'function') loadOverview();
        if (typeof loadExpenses === 'function') loadExpenses();
    }
};

window.fetchIsraelEnergyPrices = async function () {
    fetchedEnergyPrices = true; // prevent multiple triggers
    const FUEL_RESOURCE_ID = "593c6df6-3914-460d-bc01-e289454f7627";
    const ELEC_RESOURCE_ID = "7f8f9038-f80e-450f-870b-8041c2106e23";
    const url = "https://data.gov.il/api/3/action/datastore_search";

    let fuel95 = '7.02';
    let elecKwh = '0.6402';
    let fuel98 = '8.37'; // Estimated

    try {
        const fuelRes = await fetch(`${url}?resource_id=${FUEL_RESOURCE_ID}&limit=5&sort=_id desc`);
        const fuelData = await fuelRes.json();
        if (fuelData.success && fuelData.result.records.length > 0) {
            const record = fuelData.result.records[0];
            fuel95 = record['שירות עצמי'] || record['מחיר לצרכן בשירות עצמי'] || record['price_including_vat'] || fuel95;
            window.livePrices.fuel95 = fuel95;
        }
    } catch (e) { console.error("Fuel fetch error", e); }

    try {
        const elecRes = await fetch(`${url}?resource_id=${ELEC_RESOURCE_ID}&limit=1&sort=_id desc`);
        const elecData = await elecRes.json();
        if (elecData.success && elecData.result.records.length > 0) {
            const record = elecData.result.records[0];
            const rawVal = record['Value'] || record['תעריף'];
            if (rawVal) {
                let val = parseFloat(rawVal);
                if (val > 10) val = val / 100; // agorot to shekels
                elecKwh = val.toFixed(4);
                window.livePrices.elecKwh = elecKwh;
            }
        }
    } catch (e) { console.error("Elec fetch error", e); }

    if (document.getElementById('price-fuel-95')) document.getElementById('price-fuel-95').textContent = `${parseFloat(fuel95).toFixed(2)}`;
    if (document.getElementById('price-fuel-98')) document.getElementById('price-fuel-98').textContent = `~${parseFloat(fuel98).toFixed(2)}`;
    if (document.getElementById('price-elec')) document.getElementById('price-elec').textContent = `${parseFloat(elecKwh).toFixed(4)}`;
};
