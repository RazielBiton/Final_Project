// --- MODULE: OVERVIEW ---
window.loadOverview = function () {
    document.getElementById('kpi-km').textContent = (currentCar.km || 125000).toLocaleString();

    // 1. Calculate Total Expenses logic
    const totalTreatments = (currentCar.treatments || []).reduce((acc, t) => acc + (parseInt(t.cost) || 0), 0);

    let totalInsurance = 0;
    if (currentCar.insurance) {
        if (currentCar.insurance.mandatory && currentCar.insurance.mandatory.cost) totalInsurance += parseInt(currentCar.insurance.mandatory.cost);
        if (currentCar.insurance.comprehensive && currentCar.insurance.comprehensive.cost) totalInsurance += parseInt(currentCar.insurance.comprehensive.cost);
        if (currentCar.insurance.thirdparty && currentCar.insurance.thirdparty.cost) totalInsurance += parseInt(currentCar.insurance.thirdparty.cost);
    }

    const totalAccidents = (currentCar.accidents || [])
        .reduce((acc, a) => acc + (parseInt(a.cost) || 0), 0);

    const totalReports = (currentCar.reports || [])
        .filter(r => r.status === 'paid')
        .reduce((acc, r) => acc + (parseInt(r.amount) || 0), 0);

    const totalFuel = (currentCar.fuelLog || []).reduce((acc, f) => acc + (parseInt(f.cost) || 0), 0);

    const totalExpense = totalTreatments + totalInsurance + totalFuel + totalAccidents + totalReports;
    document.getElementById('kpi-expense').textContent = totalExpense.toLocaleString() + ' ₪';

    // 1a. Update List UI
    const updateE = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val.toLocaleString() + ' ₪'; };
    updateE('exp-treatments', totalTreatments);
    updateE('exp-insurance', totalInsurance);
    updateE('exp-fuel', totalFuel);
    updateE('exp-accidents', totalAccidents);
    updateE('exp-reports', totalReports);
    updateE('exp-total', totalExpense);

    // 2. Test Date
    document.getElementById('kpi-test').textContent = currentCar.testDate || '01/01/2026';

    // 3. Status Logic
    const statusEl = document.getElementById('kpi-status');
    // Logic: If test date is passed or empty -> Warning
    // For now simple year check
    if (currentCar.year < 2010) {
        statusEl.textContent = 'נדרש טיפול';
        statusEl.className = 'fs-7 primary-text';
    } else {
        statusEl.textContent = 'תקין';
        statusEl.className = 'fs-5 primary-text';
    }

    // 4. Fill Extra Info
    // Color mapping
    const colorMap = {
        'שחור': 'black',
        'לבן': 'white',
        'כסף': 'silver',
        'אפור': 'gray',
        'כחול': 'blue',
        'אדום': 'red',
        'ירוק': 'green',
        'צהוב': 'yellow',
        'חום': 'brown',
        'זהב': 'gold',
        'כתום': 'orange',
        'תכלת': 'lightblue',
        'בז\'': 'beige',
        'בורדו': 'maroon'
    };
    const carColorText = currentCar.color || 'לא ידוע';
    document.getElementById('info-color').textContent = carColorText;
    const colorIcon = document.getElementById('car-color-preview');
    if (colorIcon) {
        let mappedColor = 'transparent';
        for (const [hebText, engColor] of Object.entries(colorMap)) {
            if (carColorText.includes(hebText)) {
                mappedColor = engColor;
                break;
            }
        }
        colorIcon.style.backgroundColor = mappedColor;
        colorIcon.style.border = (mappedColor === 'white' || mappedColor === 'transparent') ? '1px solid #ccc' : '1px solid ' + mappedColor;
    }

    // Fuel mapping
    const fuelText = currentCar.fuelType || 'בנזין';
    document.getElementById('info-fuel').textContent = fuelText;
    const fuelIcon = document.getElementById('fuel-type-icon');
    if (fuelIcon) {
        let fuelImg = 'gasoline.png';
        if (fuelText.includes('חשמל/בנזין')) fuelImg = 'hybrid.png';
        else if (fuelText.includes('חשמל')) fuelImg = 'electricity.png';
        else if (fuelText.includes('דיזל')) fuelImg = 'diesel.png';

        fuelIcon.src = 'images/icons/' + fuelImg;
        fuelIcon.style.display = 'block';
    }

    document.getElementById('info-tire-f').textContent = currentCar.tireFront || '--';
    document.getElementById('info-tire-r').textContent = currentCar.tireRear || '--';

    const tagBadge = document.getElementById('info-tag');
    if (currentCar.hasDisabledTag) {
        tagBadge.textContent = 'תו נכה פעיל ♿';
        tagBadge.className = 'badge bg-success';
    } else {
        tagBadge.textContent = 'ללא תו נכה';
        tagBadge.className = 'badge bg-secondary';
    }

    // New Specs
    document.getElementById('info-volume').textContent = currentCar.engineVolume || '--';
    document.getElementById('info-hp').textContent = currentCar.horsePower || '--';

    // Init Chart
    if (typeof initExpensesChart === 'function') {
        initExpensesChart(totalTreatments, totalInsurance, totalFuel, totalAccidents, totalReports);
    }

    // Alerts (using real dates if available)
    const alertsList = document.getElementById('alertsList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const testDate = currentCar.testDate ? parseDate(currentCar.testDate) : null;

    let alertsHtml = '';

    if (testDate) {
        const diffTime = testDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            alertsHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-danger px-3 py-2 border-0 border-bottom">
                    <div class="fw-bold"><i class="fas fa-calendar-times me-2"></i> טסט שנתי פג!</div>
                    <span class="badge bg-danger rounded-pill shadow-sm">לפני ${Math.abs(diffDays)} ימים</span>
                </li>`;
        } else if (diffDays <= 30) {
            alertsHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-warning px-3 py-2 border-0 border-bottom">
                    <div class="fw-bold"><i class="fas fa-calendar-alt text-warning me-2"></i> טסט שנתי קרוב</div>
                    <span class="badge bg-warning text-dark rounded-pill shadow-sm">בעוד ${diffDays} ימים</span>
                </li>`;
        } else {
            alertsHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent px-3 py-2 border-0 border-bottom">
                    <div class="text-dark fw-medium"><i class="fas fa-calendar-alt text-primary-custom me-2"></i> חידוש טסט</div>
                    <span class="badge bg-secondary rounded-pill">בעוד ${diffDays} ימים</span>
                </li>`;
        }
    } else {
        alertsHtml += `
            <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent px-3 py-2 border-0 border-bottom">
                <div class="text-dark fw-medium"><i class="fas fa-calendar-alt text-muted me-2"></i> טסט חסר</div>
                <span class="badge bg-secondary rounded-pill">אין נתונים</span>
            </li>`;
    }

    // Check Insurances
    if (currentCar.insurance) {
        const insTypes = [
            { key: 'mandatory', name: 'ביטוח חובה' },
            { key: 'comprehensive', name: 'ביטוח מקיף' },
            { key: 'thirdparty', name: "ביטוח צד ג'" }
        ];

        insTypes.forEach(ins => {
            const data = currentCar.insurance[ins.key];
            if (data && data.expiration) {
                const expDate = parseDate(data.expiration);
                if (expDate) {
                    const diffTime = expDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) {
                        alertsHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-danger px-3 py-2 border-0 border-bottom">
                            <div class="fw-bold"><i class="fas fa-shield-alt me-2"></i> ${ins.name} פג!</div>
                            <span class="badge bg-danger rounded-pill shadow-sm">לפני ${Math.abs(diffDays)} ימים</span>
                        </li>`;
                    } else if (diffDays <= 30) {
                        alertsHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-warning px-3 py-2 border-0 border-bottom">
                            <div class="fw-bold"><i class="fas fa-shield-alt text-warning me-2"></i> לחדש ${ins.name}</div>
                            <span class="badge bg-warning text-dark rounded-pill shadow-sm">בעוד ${diffDays} ימים</span>
                        </li>`;
                    }
                }
            }
        });
    }

    alertsList.innerHTML = alertsHtml || '<li class="list-group-item text-center text-muted border-0 mt-3">אין התראות כרגע</li>';

    // 5. Reliability Score
    const reliability = calculateReliability(currentCar);
    updateReliabilityUI(reliability);
}

window.calculateReliability = function (car) {
    let score = 0;
    let missing = [];
    const maxScore = 100;

    // Criteria 1: Maintenance (>= 5 treatments with invoice/image) - Weight: 30%
    const treatmentsWithInvoice = (car.treatments || []).filter(t => t.invoice).length;
    if (treatmentsWithInvoice >= 5) {
        score += 30;
    } else {
        score += (treatmentsWithInvoice / 5) * 30;
        missing.push(`טיפולים מתועדים (${treatmentsWithInvoice}/5)`);
    }

    // Criteria 2: Insurance Check
    const insObj = car.insurance || {};
    const mandatory = insObj.mandatory || {};
    const comprehensive = insObj.comprehensive || {};
    const thirdparty = insObj.thirdparty || {};

    const hasMandatory = mandatory.date && isDateFuture(mandatory.date) && mandatory.file;
    const hasComprehensive = comprehensive.date && isDateFuture(comprehensive.date) && comprehensive.file;
    const hasThirdParty = thirdparty.date && isDateFuture(thirdparty.date) && thirdparty.file;

    if (hasMandatory && (hasComprehensive || hasThirdParty)) {
        score += 20;
    } else {
        if (!mandatory.date || !isDateFuture(mandatory.date)) {
            missing.push("ביטוח חובה פג תוקף / לא הוזן תאריך");
        } else if (!mandatory.file) {
            missing.push("יש תאריך לביטוח חובה אך לא הועלה מסמך");
        }

        if (!comprehensive.date && !thirdparty.date) {
            missing.push("חסר ביטוח מקיף או צד ג' (לא הוזן תאריך)");
        } else if (!hasComprehensive && !hasThirdParty) {
            missing.push("יש תאריך למקיף/צד ג' אך לא הועלה מסמך");
        }
    }

    // Criteria 3: Fuel Logs (>= 5 reports) - Weight: 20%
    const fuelLogsCount = (car.fuelLog || []).length;
    if (fuelLogsCount >= 5) {
        score += 20;
    } else {
        score += (fuelLogsCount / 5) * 20;
        missing.push(`תיעוד תדלוקים (${fuelLogsCount}/5)`);
    }

    // Criteria 4: Valid Test Date (Weight: 15%)
    if (car.testDate && isDateFuture(car.testDate)) {
        score += 15;
    } else {
        missing.push("טסט בתוקף");
    }

    // Criteria 5: Mileage Updated (Weight: 15%)
    // Simplified check: mileage > 0 and exists
    if (car.km && car.km > 0) {
        score += 15;
    } else {
        missing.push("עדכון קילומטראז'");
    }

    return { score: Math.round(score), missing };
}

window.updateReliabilityUI = function (data) {
    const score = data.score;
    const missing = data.missing;

    const scoreEl = document.getElementById('reliability-score');
    const scoreTextEl = document.getElementById('reliability-text');
    const scoreBarEl = document.getElementById('reliability-bar');
    const missingContainer = document.getElementById('reliability-missing-container');
    const missingList = document.getElementById('reliability-missing-list');

    // Colors
    let colorClass = 'bg-danger';
    let textClass = 'text-danger';
    let label = 'נמוכה';

    if (score >= 80) {
        colorClass = 'bg-success';
        textClass = 'text-success';
        label = 'מצוינת';
    } else if (score >= 50) {
        colorClass = 'bg-warning';
        textClass = 'text-warning';
        label = 'בינונית';
    }

    if (scoreEl) scoreEl.textContent = score + '%';
    if (scoreTextEl) {
        scoreTextEl.textContent = label;
        scoreTextEl.className = `fs-4 fw-bold ${textClass}`;
    }
    if (scoreBarEl) {
        scoreBarEl.style.width = score + '%';
        scoreBarEl.className = `progress-bar ${colorClass}`;
        scoreBarEl.setAttribute('aria-valuenow', score);
    }

    // Missing Items List
    if (missingList && missingContainer) {
        missingList.innerHTML = '';
        if (score < 100 && missing.length > 0) {
            missingContainer.classList.remove('d-none');
            missing.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-exclamation-circle text-danger me-2"></i> ${item}`;
                missingList.appendChild(li);
            });
        } else {
            missingContainer.classList.add('d-none');
        }
    }
}
