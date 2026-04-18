// --- CUSTOM ALERTS & PREMIUM HUB ---

let currentAlertFilter = 'all';

function loadAlerts() {
    const timelineContainer = document.getElementById('alertsTimelineContainer');
    const summaryText = document.getElementById('alertsSummaryText');
    const alertsCountTitle = document.getElementById('alertsCountTitle');
    const alertsDoneKPI = document.getElementById('alertsDoneKPI');
    const alertsUrgentKPI = document.getElementById('alertsUrgentKPI');

    if (!timelineContainer) return;

    // Standardize alerts structure & sorting
    if (!currentCar.customAlerts) currentCar.customAlerts = [];
    currentCar.customAlerts.sort((a, b) => new Date(a.date) - new Date(b.date));

    let upcomingCount = 0;
    let doneCount = 0;
    let urgentCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Calc KPIs globally first
    currentCar.customAlerts.forEach(alert => {
        if (alert.done) doneCount++;
        else {
            const ad = new Date(alert.date);
            if (ad < today) urgentCount++;
            else if (ad <= nextWeek) {
                urgentCount++;
                upcomingCount++;
            }
        }
    });

    if (alertsCountTitle) alertsCountTitle.textContent = currentCar.customAlerts.length;
    if (alertsDoneKPI) alertsDoneKPI.textContent = doneCount;
    if (alertsUrgentKPI) alertsUrgentKPI.textContent = urgentCount;

    timelineContainer.innerHTML = '';

    // Apply Filters
    let filteredAlerts = currentCar.customAlerts;
    if (currentAlertFilter === 'done') {
        filteredAlerts = currentCar.customAlerts.filter(a => a.done);
    } else if (currentAlertFilter === 'upcoming') {
        filteredAlerts = currentCar.customAlerts.filter(a => !a.done);
    }

    if (!filteredAlerts || filteredAlerts.length === 0) {
        timelineContainer.innerHTML = `
            <div class="text-center py-5 text-muted" style="background: rgba(255,255,255,0.5); border-radius: 16px; border: 1px dashed #cbd5e1; margin-top: 20px;">
                <i class="fas fa-check-circle fa-4x mb-3 text-success" style="opacity: 0.3;"></i>
                <h5 class="fw-bold text-dark">הכל נקי ומסודר!</h5>
                <p>אין לך תזכורות ${currentAlertFilter === 'done' ? 'שהסתיימו' : currentAlertFilter === 'upcoming' ? 'פתוחות' : 'במערכת'}. השתמש בהצעות החכמות למעלה כדי להוסיף רשומות בקליק.</p>
            </div>
        `;
        if (summaryText) {
            summaryText.innerHTML = currentCar.customAlerts.length === 0 ? `הארגונית האישית שלך כרגע ריקה לחלוטין.` : `אין משימות מתאימות לסינון הנבחר.`;
        }
        return;
    }

    // Render Timeline Items
    filteredAlerts.forEach(alert => {
        const ad = new Date(alert.date);

        let statusHtml = '';
        let isExpired = false;
        let nodeClass = 'node-gray'; // Default node colors

        if (alert.done) {
            statusHtml = `<span class="badge ms-2 rounded-pill px-3 py-2" style="background:#dcfce7; color:#16a34a; border: 1px solid #bbf7d0;"><i class="fas fa-check me-1"></i> בוצע</span>`;
            nodeClass = 'node-success';
        } else if (ad < today) {
            statusHtml = `<span class="badge ms-2 rounded-pill px-3 py-2 animate__animated animate__pulse animate__infinite" style="background:#fee2e2; color:#ef4444; border: 1px solid #fecaca;"><i class="fas fa-exclamation-triangle me-1"></i> באיחור!</span>`;
            isExpired = true;
            nodeClass = 'node-danger';
        } else if (ad <= nextWeek) {
            statusHtml = `<span class="badge ms-2 rounded-pill px-3 py-2" style="background:#fef9c3; color:#ca8a04; border: 1px solid #fef08a;"><i class="fas fa-clock me-1"></i> קרוב</span>`;
            nodeClass = 'node-warning';
        } else {
            statusHtml = `<span class="badge ms-2 rounded-pill px-3 py-2" style="background:#f1f5f9; color:#64748b; border: 1px solid #e2e8f0;">עתידי</span>`;
        }

        // Convert priority text to coloring
        if (!alert.done && !isExpired && ad > nextWeek) {
            if (alert.priority === 'danger') nodeClass = 'node-danger';
            if (alert.priority === 'warning') nodeClass = 'node-warning';
            if (alert.priority === 'gray') nodeClass = 'node-gray';
        }

        const frequencyTransMap = {
            'once': 'פעולה בודדת',
            'daily': 'תזכורת יומית',
            'weekly': 'תזכורת שבועית',
            'monthly': 'תזכורת חודשית',
            'yearly': 'תזכורת שנתית (ריטואל)'
        };
        const freqText = frequencyTransMap[alert.frequency || 'once'] || 'חד פעמית';

        timelineContainer.innerHTML += `
            <div class="timeline-item">
                <div class="timeline-node ${nodeClass}">
                    <i class="fas ${alert.done ? 'fa-check' : 'fa-thumbtack'}" style="color: white; font-size: 10px;"></i>
                </div>
                <div class="timeline-content-card ${alert.done ? 'done-item' : ''} ${isExpired && !alert.done ? 'border-danger' : ''}">
                    <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap">
                        <h5 class="fw-bold text-dark m-0 d-flex align-items-center" style="${alert.done ? 'text-decoration: line-through; opacity:0.8;' : ''}">
                            ${alert.title}
                        </h5>
                        <div class="mt-2 mt-sm-0">${statusHtml}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-end flex-wrap mt-3">
                        <div class="d-flex flex-column gap-1">
                            <span class="text-muted fw-bold" style="font-size: 0.95rem;">
                                <i class="fas fa-calendar bg-light p-2 rounded-circle me-1" style="width: 28px; text-align: center; color: #3b82f6;"></i>
                                ${ad.toLocaleDateString('he-IL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            <span class="text-muted" style="font-size: 0.8rem;">
                                <i class="fas fa-sync-alt bg-light p-2 rounded-circle me-1" style="width: 28px; text-align: center; color: #8b5cf6;"></i>
                                מחזוריות: ${freqText}
                            </span>
                        </div>
                        <div class="d-flex gap-2 mt-3 mt-md-0">
                            ${!alert.done ? `<button class="db-btn db-btn-sm" style="background:#dcfce7; color:#16a34a; border:none; border-radius:10px; font-weight:bold; padding: 6px 12px; transition: all 0.2s;" title="סמן כבוצע" onclick="markAlertAsDone('${alert.id}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"><i class="fas fa-check me-1"></i> השלם</button>` : ''}
                            <button class="db-btn db-btn-sm" style="background:#eff6ff; color:#3b82f6; border:none; border-radius:10px; padding: 6px 12px; transition: all 0.2s;" title="ערוך" onclick="openEditAlertModal('${alert.id}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"><i class="fas fa-pencil-alt"></i></button>
                            <button class="db-btn db-btn-sm" style="background:#fee2e2; color:#ef4444; border:none; border-radius:10px; padding: 6px 12px; transition: all 0.2s;" title="מחק" onclick="deleteAlert('${alert.id}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    // Update Premium Summary Text
    let summaryStr = `נמצאו <strong>${urgentCount} פריטים בדחיפות גבוהה</strong> עבור ${currentCar.brand || 'רכב זה'}.`;
    if (urgentCount === 0 && upcomingCount === 0 && doneCount > 0) summaryStr = `כל המשימות הפתוחות הושלמו, יופי של ניהול רכב! 🌟`;
    else if (urgentCount === 0 && upcomingCount > 0) summaryStr = `ישנן ${upcomingCount} התראות שמתקרבות לשבוע הקרוב.`;

    if (summaryText) summaryText.innerHTML = summaryStr;
}

// GUI Filter Logic
window.filterAlerts = function (type) {
    currentAlertFilter = type;

    // Update active UI classes for Segmented buttons
    try {
        const segContainer = document.getElementById('alertsSegmentFilter');
        if (segContainer) {
            const btns = segContainer.querySelectorAll('.segment-btn');
            btns.forEach(b => b.classList.remove('active'));
            // simple match hack based on onclick function body string match
            btns.forEach(b => {
                if (b.getAttribute('onclick').includes(type)) {
                    b.classList.add('active');
                }
            });
        }
    } catch (e) { }

    loadAlerts();
}

// AI Smart Suggestion Auto-Filler
window.smartAddAlert = function (title, priority, freq, inDays) {
    document.getElementById('add-alert-form').reset();

    document.getElementById('alertTitle').value = title;
    document.getElementById('alertPriority').value = priority;
    document.getElementById('alertFrequency').value = freq;

    let target = new Date();
    target.setDate(target.getDate() + inDays);
    document.getElementById('alertDate').value = target.toISOString().split('T')[0];

    new bootstrap.Modal(document.getElementById('addAlertModal')).show();
}

// Modal open overrides
window.openAddAlertModal = function () {
    document.getElementById('add-alert-form').reset();
    document.getElementById('alertDate').value = new Date().toISOString().split('T')[0]; // Default to today
    new bootstrap.Modal(document.getElementById('addAlertModal')).show();
}

window.saveAlert = function () {
    const title = document.getElementById('alertTitle').value;
    const date = document.getElementById('alertDate').value;
    const priority = document.getElementById('alertPriority').value;
    const frequency = document.getElementById('alertFrequency').value;

    if (!title || !date) {
        alert('יש למלא כותרת ותאריך יעד למשימה.');
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

    if (!currentCar.customAlerts) currentCar.customAlerts = [];
    currentCar.customAlerts.push(newAlert);
    saveToLocalStorage();

    bootstrap.Modal.getInstance(document.getElementById('addAlertModal')).hide();

    // Switch filter to 'upcoming' or 'all' automatically so user sees it right away
    if (currentAlertFilter === 'done') filterAlerts('upcoming');
    else loadAlerts();
}

window.deleteAlert = function (id) {
    if (confirm('מחיקת תזכורת: הפעולה תמחוק את האייטם לצמיתות. להמשיך?')) {
        currentCar.customAlerts = currentCar.customAlerts.filter(a => a.id !== id);
        saveToLocalStorage();
        loadAlerts();
    }
}

window.markAlertAsDone = function (id) {
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

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        alert.date = `${year}-${month}-${day}`;
        // For recurring, doing it pushes date forward, keeps done=false
        window.alert(`התזכורת הועברה למועדה הבא במחזוריות: ${day}/${month}/${year}`);
    } else {
        alert.done = true;
    }

    saveToLocalStorage();
    loadAlerts();
}

window.openEditAlertModal = function (id) {
    const alert = currentCar.customAlerts.find(a => a.id === id);
    if (!alert) return;

    document.getElementById('editAlertId').value = alert.id;
    document.getElementById('editAlertTitle').value = alert.title;
    document.getElementById('editAlertDate').value = alert.date;
    document.getElementById('editAlertPriority').value = alert.priority || 'gray';
    document.getElementById('editAlertFrequency').value = alert.frequency || 'once';

    new bootstrap.Modal(document.getElementById('editAlertModal')).show();
}

window.updateAlert = function () {
    const id = document.getElementById('editAlertId').value;
    const title = document.getElementById('editAlertTitle').value;
    const date = document.getElementById('editAlertDate').value;
    const priority = document.getElementById('editAlertPriority').value;
    const frequency = document.getElementById('editAlertFrequency').value;

    if (!title || !date) {
        alert('יש למלא כותרת ותאריך יעד.');
        return;
    }

    const alertInst = currentCar.customAlerts.find(a => a.id === id);
    if (alertInst) {
        alertInst.title = title;
        alertInst.date = date;
        alertInst.priority = priority;
        alertInst.frequency = frequency;

        // If it was past date but being modified to future, it might 'undone' naturally?
        // Actually editing date doesn't un-done it unless we force it.
        if (alertInst.done && new Date(date) > new Date()) {
            alertInst.done = false; // logic reset if date pushed forward explicitly
        }

        saveToLocalStorage();
        bootstrap.Modal.getInstance(document.getElementById('editAlertModal')).hide();
        loadAlerts();
    }
}
