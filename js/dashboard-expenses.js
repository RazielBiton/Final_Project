// --- CUSTOM EXPENSES & FINANCIAL ANALYTICS (Apple Premium Style) ---
let expensesChartInst = null;

function calculateFinancialAIInsights(totalsMap, grandTotal) {
    const titleEl = document.getElementById('ai-insight-title');
    const textEl = document.getElementById('ai-insight-text');
    if(!titleEl || !textEl) return;

    if (grandTotal === 0) {
        titleEl.textContent = "דף נקי, התחלה חדשה!";
        textEl.textContent = "עדיין אין הוצאות מתועדות במערכת עבור רכב זה. הוסף דיווחים כדי שאוכל להתחיל בניתוח מגמות המאקרו שלך.";
        return;
    }

    // Identify the biggest expense
    let maxKey = '';
    let maxVal = -1;
    for (const [key, val] of Object.entries(totalsMap)) {
        if (val > maxVal) {
            maxVal = val;
            maxKey = key;
        }
    }

    const percentage = Math.round((maxVal / grandTotal) * 100);
    
    // Generate insight text
    let title = "";
    let text = "";

    if (maxKey === 'fuel') {
        title = "תדלוקים מובילים את ההוצאות";
        text = `דלק שואב כ-${percentage}% מהתקציב שלך (${new Intl.NumberFormat('he-IL').format(maxVal)} ₪). אם זו סטייה מתמשכת, מומלץ לבדוק תקינות לחץ אוויר או לסגל נהיגה חסכונית יותר במטרה לקצץ בעלויות.`;
    } else if (maxKey === 'accidents') {
        title = "חריגה בעקבות תיקוני פחחות";
        text = `רוב הוצאותיך כרגע קשורות לתיקוני תאונות וטיפולי פח אקסטרים (${percentage}% נתח). מומלץ להפעיל ביטוח בצורה שקולה ולא לספוג הכל כפחת.`;
    } else if (maxKey === 'treatments') {
        title = "משקיע בתקינות המכנית";
        text = `טיפולים שוטפים גוזלים את רוב התקציב (${percentage}%). זהו סימן חיובי לתחזוקת הרכב, אך כדאי להשוות מחירי מוסך לטיפולים גדולים כדי לוודא שאינך משלם "קנס" מוסכים.`;
    } else if (maxKey === 'insurance') {
        title = "פרמיות ביטוח גבוהות";
        text = `ביטוחים תופסים השנה חלק משמעותי (${percentage}%). לקראת מועד סיום הפוליסה, כדאי לשבת עם סוכן לעשות סקר שוק תחרותי.`;
    } else if (maxKey === 'reports') {
        title = "תשלום דוחות וקנסות";
        text = `חלק ניכר מהתקציב הולך על דוחות תנועה וחניה (${percentage}%). מומלץ לשים לב לתמרור ולחניה חוקית כדי לחסוך אלפי שקלים בשנה.`;
    } else {
        title = "הוצאות כלליות גבוהות";
        text = `ההוצאות החופשיות בשיא (${percentage}%). שווה לשים לב מה החריגות המוזרות בדף כדי לא לאבד שליטה פיננסית.`;
    }

    titleEl.textContent = title;
    textEl.textContent = text;
}

function loadExpenses() {
    // Top Plate rendering logic UI sync
    const plateEl = document.getElementById('walletVehiclePlate');
    if (plateEl) {
        plateEl.textContent = currentCar.licensePlate || currentCar.brand || 'No Plate';
    }

    // 1. Calculate sums
    let totalTreatments = currentCar.treatments ? currentCar.treatments.reduce((sum, t) => sum + (Number(t.cost) || 0), 0) : 0;

    let totalInsurance = 0;
    if (currentCar.insurance) {
        if (Array.isArray(currentCar.insurance)) {
            currentCar.insurance.forEach(ins => {
                if (ins) {
                    const costVal = ins.cost ?? ins.Cost ?? 0;
                    totalInsurance += parseFloat(String(costVal).replace(/[^0-9.]/g, '')) || 0;
                }
            });
        } else if (typeof currentCar.insurance === 'object') {
            Object.values(currentCar.insurance).forEach(ins => {
                if (ins) {
                    const costVal = ins.cost ?? ins.Cost ?? 0;
                    totalInsurance += parseFloat(String(costVal).replace(/[^0-9.]/g, '')) || 0;
                }
            });
        }
    }

    let totalFuel = currentCar.fuelLog ? currentCar.fuelLog.reduce((sum, f) => sum + (Number(f.cost) || 0), 0) : 0;
    let totalCustom = currentCar.expenses ? currentCar.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) : 0;
    
    // Only count accidents that are handled (status is resolved or isHandled is true)
    let totalAccidents = currentCar.accidents ? currentCar.accidents
        .filter(a => a.isHandled || a.status === 'resolved')
        .reduce((sum, a) => sum + (Number(a.cost) || Number(a.repairCost) || 0), 0) : 0;

    let totalReports = currentCar.reports ? currentCar.reports.filter(r => r.status === 'paid').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) : 0;

    const grandTotal = totalTreatments + totalInsurance + totalFuel + totalCustom + totalAccidents + totalReports;
    const avgMonthly = Math.round(grandTotal / 12);

    // Update KPIs with counter animation effect
    const totalEl = document.getElementById('totalYearlyExpenses');
    if(totalEl) totalEl.textContent = new Intl.NumberFormat('he-IL').format(grandTotal) + ' ₪';
    
    // Update chart central text HTML (replaces the canvas plugin drawing)
    const centerChartTotalEl = document.getElementById('chartCenterTotal');
    if(centerChartTotalEl) centerChartTotalEl.textContent = new Intl.NumberFormat('he-IL').format(grandTotal) + ' ₪';

    const avgEl = document.getElementById('avgMonthlyExpense');
    if(avgEl) avgEl.textContent = new Intl.NumberFormat('he-IL').format(avgMonthly) + ' ₪';

    // Calculate AI Insight
    calculateFinancialAIInsights({
        treatments: totalTreatments,
        insurance: totalInsurance,
        fuel: totalFuel,
        accidents: totalAccidents,
        reports: totalReports,
        custom: totalCustom
    }, grandTotal);

    // 2. Render Elegant Chart
    const canvas = document.getElementById('expensesDistributionChart');
    const colors = [
        '#3b82f6', // Apple Blue (טיפולים)
        '#10b981', // Emerald Green (ביטוחים)
        '#f59e0b', // Amber (דלק)
        '#ef4444', // Red Pulse (תאונות)
        '#f43f5e', // Rose (דוחות)
        '#8b5cf6'  // Violet (שונות)
    ];

    if (canvas) {
        if (expensesChartInst) {
            expensesChartInst.destroy();
        }

        // Render custom HTML legend
        const legendContainer = document.getElementById('custom-chart-legend');
        if (legendContainer) {
            let legendHTML = '';
            const categories = [
                { name: 'טיפולים', val: totalTreatments, color: colors[0] },
                { name: 'ביטוחים', val: totalInsurance, color: colors[1] },
                { name: 'דלק', val: totalFuel, color: colors[2] },
                { name: 'תאונות', val: totalAccidents, color: colors[3] },
                { name: 'דוחות', val: totalReports, color: colors[4] },
                { name: 'שונות', val: totalCustom, color: colors[5] }
            ];

            categories.forEach(cat => {
                if (cat.val > 0) {
                    const pctVal = (cat.val / grandTotal) * 100;
                    const pctStr = (pctVal > 0 && pctVal < 0.99) ? pctVal.toFixed(1) : Math.round(pctVal);
                    legendHTML += `
                        <div class="legend-chip">
                            <span class="legend-color-dot" style="background-color: ${cat.color}"></span>
                            <span style="flex:1;">${cat.name}</span>
                            <span style="color:#64748b; font-size:0.75rem;">${pctStr}%</span>
                        </div>
                    `;
                }
            });
            legendContainer.innerHTML = legendHTML;
        }

        expensesChartInst = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['טיפולים', 'ביטוחים', 'דלק', 'תאונות', 'דוחות', 'שונות/אחר'],
                datasets: [{
                    data: [totalTreatments, totalInsurance, totalFuel, totalAccidents, totalReports, totalCustom],
                    backgroundColor: colors,
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    borderRadius: 8,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%', // Thinner elegant ring Apple style
                layout: { padding: 10 },
                plugins: {
                    datalabels: {
                        display: false // OVERRIDE GLOBAL PLUGIN SO WE DON'T GET UGLY NUMBERS ON SLICES
                    },
                    legend: {
                        display: false // We use our HTML custom legend that never overlaps!
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        titleColor: '#000',
                        bodyColor: '#333',
                        borderColor: 'rgba(0,0,0,0.05)',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 8,
                        titleFont: { size: 14, family: "-apple-system, sans-serif" },
                        bodyFont: { size: 13, family: "-apple-system, sans-serif" },
                        usePointStyle: true,
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('he-IL').format(context.parsed) + ' ₪';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Render Custom Expenses List Apple-Pay style
    const listContainer = document.getElementById('custom-expenses-list');
    if (!listContainer) return;

    if (!currentCar.expenses || currentCar.expenses.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-muted" style="opacity: 0.6;">
                <i class="fas fa-wallet fa-3x mb-3"></i>
                <p>הארנק ריק! אין טרנזאקציות להצגה.</p>
            </div>
        `;
        return;
    }

    const sortedExpenses = [...currentCar.expenses].sort((a, b) => (window.parseDate(b.date) || 0) - (window.parseDate(a.date) || 0));

    let html = '<div class="px-2 pb-2">';
    sortedExpenses.forEach(exp => {
        let typeLabel = exp.type;
        let icon = 'fa-receipt';
        let bgStr = 'background: #f1f5f9; color: #64748b;';

        if (exp.type === 'test') { typeLabel = 'טסט תקופתי'; icon = 'fa-stamp'; bgStr = 'background: #e0f2fe; color: #0284c7;'; }
        else if (exp.type === 'cosmetics') { typeLabel = 'מוצרי קוסמטיקה'; icon = 'fa-spray-can'; bgStr = 'background: #fce7f3; color: #db2777;'; }
        else if (exp.type === 'wash') { typeLabel = 'שטיפת רכב'; icon = 'fa-tint'; bgStr = 'background: #dcfce7; color: #16a34a;'; }
        else if (exp.type === 'other') { typeLabel = exp.typeOther || 'אחר'; icon = 'fa-shopping-bag'; bgStr = 'background: #fef9c3; color: #ca8a04;'; }

        html += `
            <div class="transaction-item">
                <div class="d-flex align-items-center">
                    <div class="tx-icon-bg" style="${bgStr}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="tx-details">
                        <h6>${typeLabel}</h6>
                        <small>${window.formatDate(exp.date)} ${exp.notes ? ' • ' + exp.notes : ''}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="tx-amount me-3">₪${new Intl.NumberFormat('he-IL').format(exp.amount)}</div>
                    <button class="btn btn-link text-danger p-0 border-0" onclick="deleteCustomExpense('${exp.id}')" title="מחק">
                        <i class="fas fa-minus-circle"></i>
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    listContainer.innerHTML = html;
}

// Global modal triggers map over
window.openAddExpenseModal = function() {
    document.getElementById('add-expense-form').reset();
    toggleOtherExpenseInput();
    new bootstrap.Modal(document.getElementById('addExpenseModal')).show();
}

window.toggleOtherExpenseInput = function() {
    const type = document.getElementById('expenseType').value;
    const otherDiv = document.getElementById('otherExpenseDiv');
    if (type === 'other') {
        otherDiv.classList.remove('d-none');
    } else {
        otherDiv.classList.add('d-none');
    }
}

window.saveCustomExpense = function() {
    const type = document.getElementById('expenseType').value;
    const amount = document.getElementById('expenseAmount').value;
    const date = document.getElementById('expenseDate').value;
    const notes = document.getElementById('expenseNotes').value;
    const typeOther = document.getElementById('expenseTypeOther').value;

    if (!type || !amount || !date) {
        alert('יש למלא סוג, סכום ותאריך.');
        return;
    }

    if (type === 'other' && !typeOther) {
        alert('אנא ציין את סוג ההוצאה.');
        return;
    }

    const newExpense = {
        id: Date.now().toString(),
        type: type,
        typeOther: type === 'other' ? typeOther : '',
        amount: Number(amount),
        date: date,
        notes: notes
    };

    if (!currentCar.expenses) currentCar.expenses = [];
    currentCar.expenses.push(newExpense);

    if (type === 'test') {
        const testDate = new Date(date);
        testDate.setFullYear(testDate.getFullYear() + 1);
        currentCar.testDate = testDate.toLocaleDateString('en-GB'); 
    }

    saveToLocalStorage();
    bootstrap.Modal.getInstance(document.getElementById('addExpenseModal')).hide();

    loadExpenses();
    if(typeof loadOverview === 'function') loadOverview(); 
}

window.deleteCustomExpense = function(id) {
    if (confirm('האם אתה בטוח שברצונך למחוק הוצאה זו? היא תוסר סופית מהארנק שלך.')) {
        currentCar.expenses = currentCar.expenses.filter(e => String(e.id) !== String(id));
        saveToLocalStorage();
        loadExpenses();
        if(typeof loadOverview === 'function') loadOverview();
    }
}
