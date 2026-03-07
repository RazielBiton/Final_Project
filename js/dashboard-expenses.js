// --- CUSTOM EXPENSES & ANALYTICS ---
let expensesChartInst = null;

function loadExpenses() {
    // 1. Calculate sums
    let totalTreatments = currentCar.treatments.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);

    // Insurance Sum (Compulsory + Comprehensive/Third-party)
    let totalInsurance = 0;
    if (currentCar.insurance) {
        if (currentCar.insurance.compulsoryCost) totalInsurance += Number(currentCar.insurance.compulsoryCost);
        if (currentCar.insurance.comprehensiveCost) totalInsurance += Number(currentCar.insurance.comprehensiveCost);
        if (currentCar.insurance.thirdPartyCost) totalInsurance += Number(currentCar.insurance.thirdPartyCost);
    }

    // Fuel Sum
    let totalFuel = currentCar.fuelLog.reduce((sum, f) => sum + (Number(f.cost) || 0), 0);

    // Custom Expenses Sum
    let totalCustom = currentCar.expenses ? currentCar.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) : 0;

    // Accidents Sum (if exists)
    let totalAccidents = currentCar.accidents ? currentCar.accidents.reduce((sum, a) => sum + (Number(a.repairCost) || 0), 0) : 0;

    const grandTotal = totalTreatments + totalInsurance + totalFuel + totalCustom + totalAccidents;

    // Optional: Calculate monthly avg if we know a start period. Just a simple fallback: divide by 12.
    const avgMonthly = Math.round(grandTotal / 12);

    // Update KPIs
    document.getElementById('totalYearlyExpenses').textContent = new Intl.NumberFormat('he-IL').format(grandTotal) + ' ₪';
    document.getElementById('avgMonthlyExpense').textContent = new Intl.NumberFormat('he-IL').format(avgMonthly) + ' ₪';

    // 2. Render Chart
    const canvas = document.getElementById('expensesDistributionChart');
    if (canvas) {
        if (expensesChartInst) {
            expensesChartInst.destroy();
        }

        expensesChartInst = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['טיפולים', 'ביטוחים', 'דלק', 'תאונות', 'שונות/אחר'],
                datasets: [{
                    data: [totalTreatments, totalInsurance, totalFuel, totalAccidents, totalCustom],
                    backgroundColor: [
                        '#4e73df', // Primary blue
                        '#1cc88a', // Success green
                        '#f6c23e', // Warning yellow
                        '#e74a3b', // Danger red
                        '#858796'  // Secondary gray
                    ],
                    borderWidth: 0,
                    borderRadius: 5,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Thinner elegant ring
                layout: {
                    padding: 10
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: "'Segoe UI', system-ui, sans-serif", size: 13 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        titleColor: '#333',
                        bodyColor: '#555',
                        borderColor: '#e3e6f0',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 5,
                        usePointStyle: true,
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('he-IL').format(context.parsed) + ' ₪';
                                }
                                return label;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'textCenter',
                beforeDraw: function (chart) {
                    var width = chart.width, height = chart.height, ctx = chart.ctx;
                    ctx.restore();
                    var text = "₪" + new Intl.NumberFormat('he-IL').format(grandTotal);

                    // Responsive text based on width and text length
                    var maxFontSize = 1.3;
                    var dynamicFontSize = (width / 200).toFixed(2);
                    var fontSize = Math.min(maxFontSize, dynamicFontSize);

                    ctx.font = "bold " + fontSize + "em sans-serif";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#333";

                    var textX = Math.round((width - ctx.measureText(text).width) / 2);
                    // Use chartArea to find the exact geometric center of the doughnut, ignoring the legend space
                    var textY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;

                    if (grandTotal > 0) ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    }

    // 3. Render Custom Expenses List
    const listContainer = document.getElementById('custom-expenses-list');
    if (!listContainer) return;

    if (!currentCar.expenses || currentCar.expenses.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-receipt fa-3x mb-3 opacity-25"></i>
                <p>אין הוצאות שונות להצגה.</p>
            </div>
        `;
        return;
    }

    // Sort descending by date
    const sortedExpenses = [...currentCar.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '<div class="db-list-group db-list-group-flush">';
    sortedExpenses.forEach(exp => {
        let typeLabel = exp.type;
        let icon = 'fa-receipt';
        let bg = 'bg-secondary';

        if (exp.type === 'test') { typeLabel = 'טסט'; icon = 'fa-stamp'; bg = 'bg-primary'; }
        else if (exp.type === 'cosmetics') { typeLabel = 'קוסמטיקה'; icon = 'fa-spray-can'; bg = 'bg-info'; }
        else if (exp.type === 'wash') { typeLabel = 'שטיפה'; icon = 'fa-tint'; bg = 'bg-success'; }
        else if (exp.type === 'other') { typeLabel = exp.typeOther || 'אחר'; icon = 'fa-ellipsis-h'; bg = 'bg-warning'; }

        html += `
            <div class="db-list-item d-flex justify-content-between align-items-center flex-wrap" style="border-left:none; border-right:none; border-top:none;">
                <div class="d-flex align-items-center mb-2 mb-sm-0">
                    <div class="icon-lg-wrapper ${bg} text-white ms-3 rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <h6 class="m-0 fw-bold primary-text">${typeLabel}</h6>
                        <small class="text-muted">${new Date(exp.date).toLocaleDateString('he-IL')} ${exp.notes ? ' | ' + exp.notes : ''}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <h5 class="m-0 fw-bold me-3 text-dark">₪${new Intl.NumberFormat('he-IL').format(exp.amount)}</h5>
                    <button class="db-btn db-btn-sm text-danger p-1" onclick="deleteCustomExpense('${exp.id}')" title="מחק"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    listContainer.innerHTML = html;
}

function openAddExpenseModal() {
    document.getElementById('add-expense-form').reset();
    toggleOtherExpenseInput();
    new bootstrap.Modal(document.getElementById('addExpenseModal')).show();
}

function toggleOtherExpenseInput() {
    const type = document.getElementById('expenseType').value;
    const otherDiv = document.getElementById('otherExpenseDiv');
    if (type === 'other') {
        otherDiv.classList.remove('d-none');
    } else {
        otherDiv.classList.add('d-none');
    }
}

function saveCustomExpense() {
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

    // Automation: If Test, update next test date (assume +1 year)
    if (type === 'test') {
        const testDate = new Date(date);
        testDate.setFullYear(testDate.getFullYear() + 1);
        currentCar.testDate = testDate.toLocaleDateString('en-GB'); // DD/MM/YYYY approx
    }

    saveToLocalStorage();
    bootstrap.Modal.getInstance(document.getElementById('addExpenseModal')).hide();

    // Refresh completely
    loadExpenses();
    loadOverview(); // In case we updated test date and need to refresh header etc.
}

function deleteCustomExpense(id) {
    if (confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
        currentCar.expenses = currentCar.expenses.filter(e => e.id !== id);
        saveToLocalStorage();
        loadExpenses();
    }
}
