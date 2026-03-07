// --- CUSTOM ALERTS ---
function loadAlerts() {
    const alertsGrid = document.getElementById('alertsGrid');
    const summaryText = document.getElementById('alertsSummaryText');
    if (!alertsGrid) return;

    // Sort logic
    currentCar.customAlerts.sort((a, b) => new Date(a.date) - new Date(b.date));

    let upcomingCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    alertsGrid.innerHTML = '';

    if (!currentCar.customAlerts || currentCar.customAlerts.length === 0) {
        alertsGrid.innerHTML = `
            <div class="db-col-12 text-center py-5 text-muted">
                <i class="fas fa-bell-slash fa-4x mb-3 opacity-25"></i>
                <h5>אין התראות אישיות עדיין</h5>
                <p>הוסף תזכורות כדי להישאר מעודכן בכל מה שקשור לרכב שלך.</p>
            </div>
        `;
        summaryText.innerHTML = `אין התראות כרגע`;
        return;
    }

    currentCar.customAlerts.forEach(alert => {
        const ad = new Date(alert.date);

        let statusHtml = '';
        let isExpired = false;
        if (alert.done) {
            statusHtml = `<span class="db-badge bg-success ms-2">בוצע</span>`;
        } else if (ad < today) {
            statusHtml = `<span class="db-badge bg-danger ms-2">פג תוקף</span>`;
            isExpired = true;
        } else if (ad <= nextWeek) {
            statusHtml = `<span class="db-badge bg-warning text-dark ms-2">קרוב</span>`;
            upcomingCount++;
        } else {
            statusHtml = `<span class="db-badge bg-secondary ms-2">עתידי</span>`;
        }

        const borderColors = {
            'gray': '#6c757d',
            'warning': '#ffc107',
            'danger': '#dc3545'
        };

        const cardStyle = `border-right: 4px solid ${borderColors[alert.priority]}; opacity: ${alert.done ? '0.6' : '1'};`;

        alertsGrid.innerHTML += `
            <div class="db-col-md-6 db-col-lg-4 mb-3">
                <div class="db-card ${isExpired && !alert.done ? 'border-danger' : ''}" style="${cardStyle}">
                    <div class="db-card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="fw-bold m-0 ${alert.done ? 'text-decoration-line-through text-muted' : ''}">${alert.title}</h5>
                            ${statusHtml}
                        </div>
                        <p class="text-muted small mb-3">
                            <i class="far fa-calendar-alt me-1"></i>
                            ${ad.toLocaleDateString('he-IL')}
                            <span class="ms-2 badge bg-light text-dark border"><i class="fas fa-sync-alt me-1"></i> ${alert.frequency === 'daily' ? 'יומית' :
                alert.frequency === 'weekly' ? 'שבועית' :
                    alert.frequency === 'monthly' ? 'חודשית' :
                        alert.frequency === 'yearly' ? 'שנתית' : 'חד פעמית'
            }</span>
                        </p>
                        <div class="d-flex justify-content-end gap-2 mt-auto">
                            ${!alert.done ? `<button class="db-btn db-btn-outline-dark db-btn-sm" title="סמן כבוצע" onclick="markAlertAsDone('${alert.id}')"><i class="fas fa-check text-success"></i></button>` : ''}
                            <button class="db-btn db-btn-outline-dark db-btn-sm" title="ערוך" onclick="openEditAlertModal('${alert.id}')"><i class="fas fa-pencil-alt text-primary"></i></button>
                            <button class="db-btn db-btn-outline-dark db-btn-sm" title="מחק" onclick="deleteAlert('${alert.id}')"><i class="fas fa-trash text-danger"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    // Update summary text
    let summaryStr = `סה"כ ${currentCar.customAlerts.length} התראות.`;
    if (upcomingCount > 0) summaryStr += ` <b>(${upcomingCount} התראות ל-7 הימים הקרובים)</b>`;
    summaryText.innerHTML = summaryStr;
}

function openAddAlertModal() {
    document.getElementById('add-alert-form').reset();
    new bootstrap.Modal(document.getElementById('addAlertModal')).show();
}

function saveAlert() {
    const title = document.getElementById('alertTitle').value;
    const date = document.getElementById('alertDate').value;
    const priority = document.getElementById('alertPriority').value;
    const frequency = document.getElementById('alertFrequency').value;

    if (!title || !date) {
        alert('אנא מלא את כל השדות החובה.');
        return;
    }

    const newAlert = {
        id: Date.now().toString(),
        title: title,
        date: date,
        priority: priority || 'gray',
        frequency: frequency || 'once',
        done: false
    };

    currentCar.customAlerts.push(newAlert);
    saveToLocalStorage();

    bootstrap.Modal.getInstance(document.getElementById('addAlertModal')).hide();
    loadAlerts();
}

function deleteAlert(id) {
    if (confirm('האם אתה בטוח שברצונך למחוק התראה זו?')) {
        currentCar.customAlerts = currentCar.customAlerts.filter(a => a.id !== id);
        saveToLocalStorage();
        loadAlerts();
    }
}

function markAlertAsDone(id) {
    const alert = currentCar.customAlerts.find(a => a.id === id);
    if (!alert) return;

    if (alert.frequency && alert.frequency !== 'once') {
        const currentDate = new Date(alert.date);

        if (alert.frequency === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (alert.frequency === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else if (alert.frequency === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (alert.frequency === 'yearly') {
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }

        // Update to next date, keep done = false
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        alert.date = `${year}-${month}-${day}`;

    } else {
        // One time action mark as done
        alert.done = true;
    }

    saveToLocalStorage();
    loadAlerts();
}

function openEditAlertModal(id) {
    const alert = currentCar.customAlerts.find(a => a.id === id);
    if (!alert) return;

    document.getElementById('editAlertId').value = alert.id;
    document.getElementById('editAlertTitle').value = alert.title;
    document.getElementById('editAlertDate').value = alert.date;
    document.getElementById('editAlertPriority').value = alert.priority || 'gray';
    document.getElementById('editAlertFrequency').value = alert.frequency || 'once';

    new bootstrap.Modal(document.getElementById('editAlertModal')).show();
}

function updateAlert() {
    const id = document.getElementById('editAlertId').value;
    const title = document.getElementById('editAlertTitle').value;
    const date = document.getElementById('editAlertDate').value;
    const priority = document.getElementById('editAlertPriority').value;
    const frequency = document.getElementById('editAlertFrequency').value;

    if (!title || !date) {
        alert('אנא מלא את כל השדות החובה.');
        return;
    }

    const alert = currentCar.customAlerts.find(a => a.id === id);
    if (alert) {
        alert.title = title;
        alert.date = date;
        alert.priority = priority;
        alert.frequency = frequency;

        saveToLocalStorage();
        bootstrap.Modal.getInstance(document.getElementById('editAlertModal')).hide();
        loadAlerts();
    }
}
