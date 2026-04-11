// --- MODULE: FUEL TRACKING ---
let fetchedEnergyPrices = false;
window.livePrices = { fuel95: '7.95', elecKwh: '0.62', fuel98: '9.50' };

window.loadFuel = function () {
    if (!currentCar.fuelLog) currentCar.fuelLog = [];

    const addBtn = document.getElementById('addFuelBtn');
    const evMessage = document.getElementById('evFuelMessage');
    const listContainer = document.getElementById('fuel-list');

    if (!listContainer) return;

    // 1. Calculate and update KPI Cards
    const records = currentCar.fuelLog || [];
    const totalRefuels = records.length;
    const totalCost = records.reduce((sum, f) => sum + (Number(f.cost) || 0), 0);

    if (document.getElementById('fuel-total-count')) document.getElementById('fuel-total-count').textContent = totalRefuels;
    if (document.getElementById('fuel-total-cost')) document.getElementById('fuel-total-cost').textContent = `₪${new Intl.NumberFormat('he-IL').format(totalCost)}`;

    if (!window.fetchedEnergyPrices) {
        window.fetchIsraelEnergyPrices();
    } else {
        // If already fetched, just ensure UI is updated with what we have
        if (typeof updateFuelPriceUI === 'function') updateFuelPriceUI();
        else if (window.updateFuelPriceUI) window.updateFuelPriceUI();
    }

    // 2. Determine Vehicle Type Details
    const ft = currentCar.fuelType || "";
    const isEV = ft === "חשמל";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    // Update Add Button Text dynamically
    if (addBtn) {
        if (isEV) {
            addBtn.innerHTML = `<i class="fas fa-charging-station me-2"></i> הוסף טעינה`;
        } else if (isHybrid) {
            addBtn.innerHTML = `<i class="fas fa-bolt me-1"></i>/<i class="fas fa-gas-pump mx-1"></i> הוסף הזנה`;
        } else {
            addBtn.innerHTML = `<i class="fas fa-plus me-2"></i> הוסף תדלוק`;
        }
    }

    if (evMessage) {
        if (isEV) evMessage.classList.remove('d-none');
        else evMessage.classList.add('d-none');
    }

    // 3. Render List
    if (records.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-gas-pump fa-4x mb-4 opacity-10"></i>
                <h6 class="fw-bold">אין נתוני אנרגיה להצגה</h6>
                <p class="small">לחץ על 'הוסף תדלוק' כדי להתחיל לעקוב אחר הוצאות האנרגיה שלך.</p>
            </div>
        `;
        return;
    }

    // Sort descending by date
    const sortedFuel = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sortedFuel.forEach(f => {
        const isElectricity = f.energyType === 'electricity';

        // Define display attributes based on energy type
        const amountText = f.amount ? (isElectricity ? `${f.amount} קוט״ש` : `${f.amount} ליטר`) : 'כמות לא צוינה';
        const titleText = isElectricity ? 'טעינת חשמל' : 'תדלוק בנזין';
        const iconClass = isElectricity ? 'fa-bolt' : 'fa-gas-pump';
        const iconBg = isElectricity ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)';

        const dateFormatted = window.formatDate(f.date);

        html += `
            <div class="p-3 mb-3 d-flex justify-content-between align-items-center flex-wrap" style="background:#fff; border:1px solid #f1f5f9; border-radius:18px; transition:all 0.2s; border-right: 4px solid ${isElectricity ? '#10b981' : '#f59e0b'};">
                <div class="d-flex align-items-center mb-3 mb-md-0">
                    <div style="width:48px; height:48px; background:${iconBg}; border-radius:12px; display:flex; justify-content:center; align-items:center; box-shadow:0 4px 10px rgba(0,0,0,0.1); margin-inline-start: 15px;">
                        <i class="fas ${iconClass}" style="color:white; font-size:1.1rem;"></i>
                    </div>
                    <div>
                        <h6 class="m-0 fw-bold" style="color:#1e293b; font-size:1rem;">${titleText}</h6>
                        <div style="font-size:0.8rem; color:#64748b; margin-top: 2px;">
                            <i class="far fa-calendar-alt ms-1"></i> ${dateFormatted}
                            <span class="mx-2 opacity-25">|</span>
                            <i class="fas ${isElectricity ? 'fa-battery-three-quarters' : 'fa-tint'} ms-1"></i> ${amountText}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-4">
                    <div style="text-align: left;">
                        <h5 class="m-0 fw-bold" style="color:#0f172a; font-size:1.2rem;">₪${new Intl.NumberFormat('he-IL').format(f.cost)}</h5>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm text-primary" style="background: #eff6ff; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;" onclick="window.editFuel('${f.id}')" title="ערוך"><i class="fas fa-pen fa-xs"></i></button>
                        <button class="btn btn-sm text-danger" style="background: #fef2f2; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;" onclick="window.deleteFuel('${f.id}')" title="מחק"><i class="fas fa-trash fa-xs"></i></button>
                    </div>
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

    if (!amountLabel || !amountInput || !priceInput || !priceLabel) return;

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

    calculateTotalFuelCost();
};

window.calculateTotalFuelCost = function () {
    const amount = parseFloat(document.getElementById('fAmount').value);
    const price = parseFloat(document.getElementById('fPricePerUnit').value);
    const costInput = document.getElementById('fCost');

    if (costInput && !isNaN(amount) && !isNaN(price) && amount > 0 && price > 0) {
        costInput.value = (amount * price).toFixed(2);
    }
};

window.calculatePricePerUnit = function () {
    const amount = parseFloat(document.getElementById('fAmount').value);
    const cost = parseFloat(document.getElementById('fCost').value);
    const priceInput = document.getElementById('fPricePerUnit');

    if (priceInput && !isNaN(amount) && !isNaN(cost) && amount > 0 && cost > 0) {
        priceInput.value = (cost / amount).toFixed(4);
    }
};

window.openAddFuelModal = function () {
    const form = document.getElementById('add-fuel-form');
    if (form) form.reset();
    
    document.getElementById('editFuelId').value = "";

    const ft = currentCar.fuelType || "";
    const isEV = ft === "חשמל";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    const selectorDiv = document.getElementById('energyTypeSelector');
    const modalTitle = document.getElementById('addFuelModalTitle');
    const submitBtn = document.getElementById('saveFuelSubmitBtn');

    if (isHybrid) {
        if (selectorDiv) selectorDiv.classList.remove('d-none');
        document.getElementById('energyPetrol').checked = true;
        if (modalTitle) modalTitle.textContent = 'הוספת הזנת אנרגיה';
        if (submitBtn) submitBtn.textContent = 'שמור הזנה';
    } else {
        if (selectorDiv) selectorDiv.classList.add('d-none');
        if (isEV) {
            document.getElementById('energyElectric').checked = true;
            if (modalTitle) modalTitle.textContent = 'הוספת רישום טעינה';
            if (submitBtn) submitBtn.textContent = 'שמור טעינה';
        } else {
            document.getElementById('energyPetrol').checked = true;
            if (modalTitle) modalTitle.textContent = 'הוספת תדלוק חדש';
            if (submitBtn) submitBtn.textContent = 'שמור תדלוק';
        }
    }

    window.toggleEnergyFields();

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('fDate').value = now.toISOString().slice(0, 16);

    const modalEl = document.getElementById('addFuelModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

window.editFuel = function (id) {
    const record = currentCar.fuelLog.find(f => String(f.id) === String(id));
    if (!record) return;

    const ft = currentCar.fuelType || "";
    const isHybrid = ft.includes("חשמל/בנזין") || ft.includes("בנזין/חשמל");

    const selectorDiv = document.getElementById('energyTypeSelector');
    const modalTitle = document.getElementById('addFuelModalTitle');
    const submitBtn = document.getElementById('saveFuelSubmitBtn');

    if (modalTitle) modalTitle.textContent = 'עריכת רישום קודם';
    if (submitBtn) submitBtn.textContent = 'עדכן רישום';

    if (isHybrid) {
        if (selectorDiv) selectorDiv.classList.remove('d-none');
    } else {
        if (selectorDiv) selectorDiv.classList.add('d-none');
    }

    if (record.energyType === 'electricity') {
        document.getElementById('energyElectric').checked = true;
    } else {
        document.getElementById('energyPetrol').checked = true;
    }

    window.toggleEnergyFields();

    document.getElementById('editFuelId').value = record.id;
    document.getElementById('fDate').value = window.toInputDate(record.date);
    document.getElementById('fAmount').value = record.amount || "";
    document.getElementById('fCost').value = record.cost;

    if (record.amount && record.amount > 0 && record.cost && record.cost > 0) {
        document.getElementById('fPricePerUnit').value = (record.cost / record.amount).toFixed(4);
    }

    const modalEl = document.getElementById('addFuelModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
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
        const idx = currentCar.fuelLog.findIndex(f => String(f.id) === String(editId));
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
    
    const modalEl = document.getElementById('addFuelModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.loadFuel();
    if (typeof loadOverview === 'function') loadOverview();
    if (typeof loadExpenses === 'function') loadExpenses();
};

window.deleteFuel = function (id) {
    if (confirm('האם אתה בטוח שברצונך למחוק תיעוד תדלוק זה?')) {
        currentCar.fuelLog = currentCar.fuelLog.filter(f => String(f.id) !== String(id));
        saveToLocalStorage();
        window.loadFuel();
        if (typeof loadOverview === 'function') loadOverview();
        if (typeof loadExpenses === 'function') loadExpenses();
    }
};

window.fetchIsraelEnergyPrices = async function () {
    const CACHE_KEY = 'fuel_prices_cache';
    const CACHE_DURATION = 1000 * 60 * 60 * 12; // 12 hours
    const cachedData = localStorage.getItem(CACHE_KEY);
    
    if (cachedData) {
        try {
            const { prices, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log("Using cached fuel prices:", prices);
                window.livePrices = prices;
                updateFuelPriceUI();
                return;
            }
        } catch(e) { console.warn("Cache parse failed", e); }
    }

    if (fetchedEnergyPrices) return;
    fetchedEnergyPrices = true;
    
    console.log("Fetching live energy prices from AI...");
    try {
        const res = await fetch('/api/current-fuel-ai');
        if (!res.ok) throw new Error('API request failed');
        const prices = await res.json();
        
        if (prices.fuel95) window.livePrices.fuel95 = prices.fuel95;
        if (prices.fuel98) window.livePrices.fuel98 = prices.fuel98;
        if (prices.elecKwh) window.livePrices.elecKwh = prices.elecKwh;
        
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            prices: window.livePrices,
            timestamp: Date.now()
        }));
        
    } catch (e) { 
        console.error("AI Price fetch error, using safe fallbacks.", e);
        window.livePrices = { fuel95: '7.95', elecKwh: '0.62', fuel98: '9.50' };
    } finally {
        updateFuelPriceUI();
    }
};

function updateFuelPriceUI() {
    if (document.getElementById('price-fuel-95')) document.getElementById('price-fuel-95').textContent = window.livePrices.fuel95;
    if (document.getElementById('price-fuel-98')) document.getElementById('price-fuel-98').textContent = window.livePrices.fuel98;
    if (document.getElementById('price-elec')) document.getElementById('price-elec').textContent = window.livePrices.elecKwh;
    
    const modeInput = document.getElementById('fPricePerUnit');
    if (modeInput) {
        window.toggleEnergyFields();
    }
}
