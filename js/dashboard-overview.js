// --- MODULE: OVERVIEW ---
window.loadOverview = function () {
    // ── KPI: KM ──────────────────────────────────────────────────
    const kmEl = document.getElementById('kpi-km');
    if (kmEl) kmEl.textContent = (currentCar.km || 0).toLocaleString('he-IL');

    // ── Expenses Calculation ──────────────────────────────────────
    const totalTreatments = (currentCar.treatments || []).reduce((acc, t) => acc + (parseFloat(t.cost) || 0), 0);

    let totalInsurance = 0;
    if (currentCar.insurance) {
        ['mandatory', 'comprehensive', 'thirdparty'].forEach(k => {
            const ins = currentCar.insurance[k];
            if (ins && ins.cost) totalInsurance += parseFloat(ins.cost) || 0;
        });
    }

    const totalAccidents = (currentCar.accidents || []).reduce((acc, a) => acc + (parseFloat(a.cost) || 0), 0);
    const totalReports = (currentCar.reports || []).filter(r => r.status === 'paid').reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    const totalFuel = (currentCar.fuelLog || []).reduce((acc, f) => acc + (parseFloat(f.cost) || 0), 0);
    const totalExpense = totalTreatments + totalInsurance + totalFuel + totalAccidents + totalReports;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = Math.round(val).toLocaleString('he-IL') + ' ₪'; };
    const setPerc = (id, val) => { 
        const e = document.getElementById(id); 
        if (e) {
            e.textContent = totalExpense === 0 ? '0%' : Math.round((val / totalExpense) * 100) + '%';
        }
    };

    setEl('kpi-expense', totalExpense);
    setEl('exp-treatments', totalTreatments);
    setPerc('perc-treatments', totalTreatments);
    setEl('exp-insurance', totalInsurance);
    setPerc('perc-insurance', totalInsurance);
    setEl('exp-fuel', totalFuel);
    setPerc('perc-fuel', totalFuel);
    setEl('exp-accidents', totalAccidents);
    setPerc('perc-accidents', totalAccidents);
    setEl('exp-reports', totalReports);
    setPerc('perc-reports', totalReports);
    setEl('exp-total', totalExpense);

    // ── KPI: Test Date ────────────────────────────────────────────
    const testEl = document.getElementById('kpi-test');
    if (testEl) testEl.textContent = window.formatDate(currentCar.testDate);

    // ── KPI: Status ───────────────────────────────────────────────
    const statusEl = document.getElementById('kpi-status');
    if (statusEl) {
        const hasProblem = currentCar.year < 2010 || !currentCar.testDate;
        statusEl.textContent = hasProblem ? 'דרוש טיפול' : 'תקין';
    }

    // ── Technical Specs ───────────────────────────────────────────
    const colorMap = { 'שחור': 'black', 'לבן': 'white', 'כסף': 'silver', 'אפור': 'gray', 'כחול': 'blue', 'אדום': 'red', 'ירוק': 'green', 'צהוב': 'yellow', 'חום': 'brown', 'זהב': 'gold', 'כתום': 'orange', 'תכלת': 'lightblue', 'בז\'': 'beige', 'בורדו': 'maroon' };
    const carColorText = currentCar.color || '--';
    const colorEl = document.getElementById('info-color');
    if (colorEl) colorEl.textContent = carColorText;
    const colorPreview = document.getElementById('car-color-preview');
    if (colorPreview) {
        let mapped = 'transparent';
        for (const [heb, eng] of Object.entries(colorMap)) {
            if (carColorText.includes(heb)) { mapped = eng; break; }
        }
        colorPreview.style.backgroundColor = mapped;
        colorPreview.style.border = (mapped === 'white' || mapped === 'transparent') ? '1px solid #ccc' : '1px solid ' + mapped;
    }

    const fuelText = currentCar.fuelType || '--';
    const fuelEl = document.getElementById('info-fuel');
    if (fuelEl) fuelEl.textContent = fuelText;
    const fuelIcon = document.getElementById('fuel-type-icon');
    if (fuelIcon) {
        let img = 'gasoline.png';
        if (fuelText.includes('חשמל/בנזין')) img = 'hybrid.png';
        else if (fuelText.includes('חשמל')) img = 'electricity.png';
        else if (fuelText.includes('דיזל')) img = 'diesel.png';
        fuelIcon.src = 'images/icons/' + img;
        fuelIcon.style.display = 'block';
    }

    const setTextEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || '--'; };
    setTextEl('info-tire-f', currentCar.tireFront);
    setTextEl('info-tire-r', currentCar.tireRear);
    setTextEl('info-volume', currentCar.engineVolume);
    setTextEl('info-hp', currentCar.horsePower);

    const tagBadge = document.getElementById('info-tag');
    if (tagBadge) {
        tagBadge.textContent = currentCar.hasDisabledTag ? 'תו נכה פעיל ♿' : 'ללא תו נכה';
        tagBadge.className = currentCar.hasDisabledTag ? 'badge bg-success' : 'badge bg-secondary';
    }

    // ── Expense Chart ─────────────────────────────────────────────
    if (typeof initExpensesChart === 'function') {
        initExpensesChart(totalTreatments, totalInsurance, totalFuel, totalAccidents, totalReports);
    }

    // ── Health Score (Reliability) ────────────────────────────────
    const reliability = calculateReliability(currentCar);
    updateReliabilityUI(reliability);

    // ── Alerts from customAlerts ──────────────────────────────────
    renderOverviewAlerts();
};

// ─────────────────────────────────────────────────────────────────────────────
// Alert Cards in Overview – pulled from currentCar.customAlerts
// ─────────────────────────────────────────────────────────────────────────────
function renderOverviewAlerts() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;

    const customAlerts = (currentCar.customAlerts || []).filter(a => !a.done);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const freqLabels = { daily: 'יומי', weekly: 'שבועי', monthly: 'חודשי', yearly: 'שנתי', once: 'חד פעמי' };

    // Sort by date ascending
    const sorted = [...customAlerts].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length === 0) {
        alertsList.innerHTML = `
            <div style="text-align:center;padding:2.5rem 0;color:#94a3b8;">
                <i class="fas fa-bell-slash" style="font-size:2rem;display:block;margin-bottom:0.7rem;opacity:0.4;"></i>
                <span style="font-size:0.88rem;">אין התראות פעילות</span>
            </div>`;
        return;
    }

    alertsList.innerHTML = sorted.map(alert => {
        const ad = new Date(alert.date);
        const diffDays = Math.ceil((ad - today) / (1000 * 60 * 60 * 24));
        const urgency = alert.urgency || 'normal';

        // Color tokens by urgency
        let dotColor, bgColor, textColor, urgencyLabel;
        if (urgency === 'critical' || alert.priority === 'danger') {
            dotColor = '#e53935'; bgColor = '#fff5f5'; textColor = '#991b1b'; urgencyLabel = 'קריטי';
        } else if (urgency === 'important' || alert.priority === 'warning') {
            dotColor = '#f59e0b'; bgColor = '#fffbeb'; textColor = '#92400e'; urgencyLabel = 'חשוב';
        } else {
            dotColor = '#3b82f6'; bgColor = '#eff6ff'; textColor = '#1e40af'; urgencyLabel = 'רגיל';
        }

        // Time badge
        let timeBadge;
        if (diffDays < 0) {
            timeBadge = `<span style="background:#fee2e2;color:#991b1b;border-radius:20px;padding:2px 9px;font-size:0.72rem;font-weight:700;">פג לפני ${Math.abs(diffDays)} ימים</span>`;
        } else if (diffDays === 0) {
            timeBadge = `<span style="background:#fee2e2;color:#991b1b;border-radius:20px;padding:2px 9px;font-size:0.72rem;font-weight:700;">היום!</span>`;
        } else if (diffDays <= 7) {
            timeBadge = `<span style="background:#fef3c7;color:#92400e;border-radius:20px;padding:2px 9px;font-size:0.72rem;font-weight:700;">בעוד ${diffDays} ימים</span>`;
        } else {
            timeBadge = `<span style="background:#dbeafe;color:#1e40af;border-radius:20px;padding:2px 9px;font-size:0.72rem;font-weight:700;">${ad.toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit'})}</span>`;
        }

        const freqLabel = freqLabels[alert.frequency] || 'חד פעמי';

        return `
        <div onclick="goToSection('alerts')" style="
            background:${bgColor};
            border-radius:10px;
            padding:10px 12px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:8px;
            cursor:pointer;
            border-right:3px solid ${dotColor};
            transition:transform 0.15s,box-shadow 0.15s;
        " onmouseover="this.style.transform='translateX(-3px)';this.style.boxShadow='0 3px 12px rgba(0,0,0,0.1)'"
           onmouseout="this.style.transform='translateX(0)';this.style.boxShadow='none'">
            <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;"></div>
                <div style="min-width:0;">
                    <div style="font-weight:600;font-size:0.87rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${alert.title}</div>
                    <div style="display:flex;gap:7px;margin-top:3px;flex-wrap:wrap;">
                        <span style="font-size:0.7rem;background:rgba(0,0,0,0.06);border-radius:6px;padding:1px 7px;color:#64748b;">
                            <i class="fas fa-sync-alt" style="font-size:0.65rem;margin-left:2px;"></i>${freqLabel}
                        </span>
                        <span style="font-size:0.7rem;background:${dotColor}22;border-radius:6px;padding:1px 7px;color:${dotColor};font-weight:600;">
                            ${urgencyLabel}
                        </span>
                    </div>
                </div>
            </div>
            ${timeBadge}
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reliability / Health Score
// ─────────────────────────────────────────────────────────────────────────────
window.calculateReliability = function (car) {
    let score = 0;
    const criteria = [];

    // 1. Treatments with invoice (30%)
    const treatmentsWithInvoice = (car.treatments || []).filter(t => t.invoice).length;
    const treatmentDone = treatmentsWithInvoice >= 5;
    const treatmentPartial = Math.min(treatmentsWithInvoice / 5, 1);
    score += treatmentPartial * 30;
    criteria.push({
        label: 'טיפולים מתועדים',
        detail: treatmentDone ? '5+ טיפולים עם קבלות' : `${treatmentsWithInvoice}/5 טיפולים עם קבלות`,
        done: treatmentDone,
        weight: 30
    });

    // 2. Insurance (20%)
    const insObj = car.insurance || {};
    const hasMandatory = insObj.mandatory?.date && isDateFuture(insObj.mandatory.date) && insObj.mandatory.file;
    const hasCompOrThird = (insObj.comprehensive?.date && isDateFuture(insObj.comprehensive.date) && insObj.comprehensive.file)
        || (insObj.thirdparty?.date && isDateFuture(insObj.thirdparty.date) && insObj.thirdparty.file);
    const insuranceDone = hasMandatory && hasCompOrThird;
    if (hasMandatory) score += 10;
    if (hasCompOrThird) score += 10;
    criteria.push({
        label: 'ביטוח חובה',
        detail: hasMandatory ? 'בתוקף עם מסמך' : (!insObj.mandatory?.date ? 'לא הוזן' : !isDateFuture(insObj.mandatory.date) ? 'פג תוקף' : 'חסר מסמך/קובץ'),
        done: hasMandatory,
        weight: 10
    });
    criteria.push({
        label: 'ביטוח מקיף / צד ג\'',
        detail: hasCompOrThird ? 'בתוקף עם מסמך' : 'חסר ביטוח מקיף/צד ג\' עם מסמך',
        done: hasCompOrThird,
        weight: 10
    });

    // 3. Fuel Logs (20%)
    const fuelCount = (car.fuelLog || []).length;
    const fuelDone = fuelCount >= 5;
    score += Math.min(fuelCount / 5, 1) * 20;
    criteria.push({
        label: 'תיעוד תדלוקים',
        detail: fuelDone ? '5+ תדלוקים מתועדים' : `${fuelCount}/5 תדלוקים`,
        done: fuelDone,
        weight: 20
    });

    // 4. Valid Test (15%)
    const testDone = !!(car.testDate && isDateFuture(car.testDate));
    if (testDone) score += 15;
    criteria.push({
        label: 'טסט בתוקף',
        detail: testDone ? 'תאריך טסט עתידי' : (!car.testDate ? 'תאריך טסט לא הוזן' : 'טסט פג תוקף'),
        done: testDone,
        weight: 15
    });

    // 5. Mileage (15%)
    const kmDone = !!(car.km && car.km > 0);
    if (kmDone) score += 15;
    criteria.push({
        label: "קילומטראז' מעודכן",
        detail: kmDone ? ((car.km || 0).toLocaleString('he-IL') + ' ק"מ') : "לא הוזן קילומטראז'",
        done: kmDone,
        weight: 15
    });

    return { score: Math.round(score), criteria };
};

window.updateReliabilityUI = function (data) {
    const { score, criteria } = data;

    const scoreEl = document.getElementById('reliability-score');
    const textEl = document.getElementById('reliability-text');
    const barEl = document.getElementById('reliability-bar');
    const checklistEl = document.getElementById('reliability-checklist');

    // Score label & color
    let color, barGradient, label;
    if (score >= 80) {
        color = '#16a34a'; barGradient = 'linear-gradient(90deg,#16a34a,#4ade80)'; label = 'מצוינת';
    } else if (score >= 50) {
        color = '#d97706'; barGradient = 'linear-gradient(90deg,#f59e0b,#fcd34d)'; label = 'בינונית';
    } else {
        color = '#e53935'; barGradient = 'linear-gradient(90deg,#e53935,#f87171)'; label = 'נמוכה';
    }

    if (textEl) { textEl.textContent = label; textEl.style.color = color; }
    if (scoreEl) { scoreEl.textContent = score + '%'; scoreEl.style.color = '#64748b'; }
    if (barEl) { barEl.style.width = score + '%'; barEl.style.background = barGradient; }

    // Checklist
    if (checklistEl && criteria) {
        checklistEl.innerHTML = criteria.map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;background:${c.done ? '#f0fdf4' : '#fff9f0'};border:1px solid ${c.done ? '#d1fae5' : '#fde68a'};">
                <div style="width:24px;height:24px;border-radius:50%;background:${c.done ? '#16a34a' : '#f59e0b'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas ${c.done ? 'fa-check' : 'fa-exclamation'}" style="color:#fff;font-size:0.65rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.82rem;color:#1e293b;">${c.label}</div>
                    <div style="font-size:0.72rem;color:${c.done ? '#16a34a' : '#d97706'};">${c.detail}</div>
                </div>
                <div style="font-size:0.7rem;color:#94a3b8;flex-shrink:0;">${c.weight}%</div>
            </div>
        `).join('');
    }
};
