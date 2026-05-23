/**
 * ── PROFILE PAGE CONTROLLER ──
 * Avatar, personal details, password (Supabase OTP), reminders with recurrence.
 */

/* ── INIT ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadProfileData();
    initHeroGreeting();
    loadCustomReminders();

    // Avatar upload
    document.getElementById('avatarFile').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async e => {
            const rawBase64 = e.target.result;
            
            // Compress avatar before saving
            window.compressImage(rawBase64, 400, 0.6, async (base64) => {
                document.getElementById('profileAvatar').src = base64;
                const sb = document.getElementById('sidebarUserImg');
                if (sb) sb.src = base64;

                // Auto-save to DB immediately
                try {
                    const fullName = val('fullName');
                    const email = val('email');
                    const phone = val('phone');
                    
                    const res = await fetch('/api/user/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', userid: getUserId() },
                        body: JSON.stringify({ fullName, email, phone, avatar: base64 })
                    });
                    const data = await res.json();
                    if (data.success) {
                        toast('תמונת הפרופיל עודכנה ונשמרה!');
                        // Update local cache
                        let u = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
                        u.avatar = base64;
                        sessionStorage.setItem('loggedInUser', JSON.stringify(u));
                    }
                } catch (err) {
                    console.error('Auto-save avatar failed:', err);
                }
            });
        };
        reader.readAsDataURL(file);
    });

    // Details form
    document.getElementById('detailsForm').addEventListener('submit', saveDetails);

    // Custom recurrence toggle
    document.getElementById('reminderRecurrence').addEventListener('change', function () {
        document.getElementById('customIntervalRow').style.display =
            this.value === 'custom' ? 'flex' : 'none';
    });
});

/* ── HERO GREETING ────────────────────────────────────────────────── */
function initHeroGreeting() {
    const el = document.getElementById('heroGreeting');
    if (!el) return;
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    const name = (user.fullName || 'משתמש').split(' ')[0];

    const h = new Date().getHours();
    let g = 'יום טוב';
    if (h >= 5 && h < 12) g = 'בוקר טוב';
    else if (h >= 12 && h < 17) g = 'צהריים טובים';
    else if (h >= 17 && h < 21) g = 'ערב טוב';
    else g = 'לילה טוב';

    el.textContent = `${g}, ${name}!`;
}

/* ── SIDEBAR SYNC ─────────────────────────────────────────────────── */
function loadUserProfile() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    const nameEl = document.getElementById('sidebarUserName');
    const imgEl = document.getElementById('sidebarUserImg');
    if (nameEl) nameEl.textContent = user.fullName || 'משתמש';
    if (imgEl) {
        imgEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=2d74d7&color=fff&rounded=true`;
    }
}

/* ── LOAD DATA ────────────────────────────────────────────────────── */
async function loadProfileData() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    setField('fullName', user.fullName);
    setField('email', user.email);
    setField('phone', user.phone);
    setField('pwEmail', user.email);  // pre-fill password email field
    setDisplay('profileDisplayName', user.fullName || 'משתמש');

    if (user.avatar) {
        document.getElementById('profileAvatar').src = user.avatar;
    } else if (user.fullName) {
        document.getElementById('profileAvatar').src =
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0071e3&color=fff&rounded=true`;
    }

    const userId = getUserId();
    if (!userId) return;

    try {
        const res = await fetch('/api/user/me', { headers: { userid: userId } });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
                const u = data.user;
                setField('fullName', u.FullName);
                setField('email', u.Email);
                setField('phone', u.Phone);
                setField('pwEmail', u.Email);
                setDisplay('profileDisplayName', u.FullName || 'משתמש');
                if (u.Avatar) document.getElementById('profileAvatar').src = u.Avatar;
                loadUserProfile();
            }
        }
    } catch (e) { console.warn('Sync error', e); }
}

/* ── SAVE PERSONAL DETAILS ────────────────────────────────────────── */
async function saveDetails(e) {
    e.preventDefault();
    const fullName = val('fullName');
    const email = val('email');
    const phone = val('phone');
    const avatarSrc = document.getElementById('profileAvatar').src;
    const avatarToSave = avatarSrc.includes('ui-avatars.com') ? null : avatarSrc;

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', userid: getUserId() },
            body: JSON.stringify({ fullName, email, phone, avatar: avatarToSave })
        });
        const data = await res.json();
        if (data.success) {
            toast('הפרטים נשמרו בהצלחה!');
            // Update local cache
            let u = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
            u.fullName = fullName;
            u.email = email;
            u.phone = phone;
            u.avatar = avatarToSave; // Keep it lowercase 'avatar' for legacy frontend compatibility
            sessionStorage.setItem('loggedInUser', JSON.stringify(u));
            
            setDisplay('profileDisplayName', fullName);
            setField('pwEmail', email);
            loadUserProfile(); // Refresh sidebar
            loadProfileData(); // Refresh form and avatar
        } else {
            toast('שגיאה: ' + (data.error || ''), true);
        }
    } catch (err) {
        console.error(err);
        toast('שגיאה בתקשורת מול השרת.', true);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   PASSWORD CHANGE 
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Direct Password Update
 */
async function updatePasswordDirectly() {
    const currentPwd = val('currentPassword');
    const newPwd = val('newPassword');
    const confirmPwd = val('confirmPassword');

    if (!currentPwd || !newPwd || !confirmPwd) { toast('יש למלא את כל שדות הסיסמה.', true); return; }
    if (newPwd !== confirmPwd) { toast('הסיסמאות החדשות אינן תואמות.', true); return; }
    if (newPwd.length < 6) { toast('סיסמה חדשה חייבת להכיל לפחות 6 תווים.', true); return; }

    const btn = document.getElementById('btnUpdatePassword');
    const spinner = document.getElementById('pwSpinner');

    btn.disabled = true;
    spinner.style.display = 'block';

    try {
        const res = await fetch('/api/auth/reset-password-direct', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'userid': getUserId()
            },
            body: JSON.stringify({ 
                currentPassword: currentPwd,
                newPassword: newPwd 
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'שגיאת שרת' }));
            toast(data.error || 'הסיסמה הנוכחית שגויה או שאירעה שגיאה.', true);
            btn.disabled = false;
            spinner.style.display = 'none';
            return;
        }

        const data = await res.json();

        if (data.success) {
            toast('הסיסמה עודכנה בהצלחה! ✓');
            
            // Transition to success step
            document.getElementById('pwDirectArea').style.display = 'none';
            document.getElementById('pwStep3').style.display = 'block';
        } else {
            toast(data.error || 'שגיאה בעדכון הסיסמה.', true);
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        toast('שגיאת שרת בעדכון הסיסמה.', true);
        btn.disabled = false;
    } finally {
        spinner.style.display = 'none';
    }
}

/* ═══════════════════════════════════════════════════════════════════
   CUSTOM REMINDERS — with recurrence support
   ═══════════════════════════════════════════════════════════════════ */

function getReminders() {
    return JSON.parse(localStorage.getItem('customReminders') || '[]');
}

function saveReminders(arr) {
    localStorage.setItem('customReminders', JSON.stringify(arr));
}

const recurrenceLabels = {
    once: 'חד פעמי',
    daily: 'יומי',
    weekly: 'שבועי',
    monthly: 'חודשי',
    yearly: 'שנתי',
    custom: 'מותאם אישית'
};

function formatRecurrence(r) {
    if (!r || r.type === 'once') return 'חד פעמי';
    if (r.type === 'custom') {
        const unitLabels = { days: 'ימים', weeks: 'שבועות', months: 'חודשים' };
        return `כל ${r.interval} ${unitLabels[r.unit] || r.unit}`;
    }
    return recurrenceLabels[r.type] || r.type;
}

function loadCustomReminders() {
    const list = document.getElementById('reminderList');
    const reminders = getReminders();
    list.innerHTML = '';

    if (reminders.length === 0) {
        list.innerHTML = '<p style="color:#86868b;font-size:0.88rem;text-align:center;margin-top:1rem;">אין תזכורות ידניות עדיין.</p>';
        return;
    }

    reminders.forEach((r, i) => {
        const div = document.createElement('div');
        div.className = 'reminder-item';
        div.innerHTML = `
            <div>
                <div class="ri-text">${escapeHtml(r.text)}</div>
                <div class="ri-date">
                    <i class="fas fa-calendar-alt" style="margin-left:4px;"></i> ${r.date || 'ללא תאריך'}
                    <span style="margin-right:10px;background:rgba(0,113,227,0.08);color:#0071e3;padding:2px 10px;border-radius:8px;font-size:0.75rem;font-weight:600;">
                        <i class="fas fa-sync-alt" style="margin-left:3px;font-size:0.65rem;"></i> ${formatRecurrence(r.recurrence)}
                    </span>
                </div>
            </div>
            <button class="ri-del" onclick="deleteReminder(${i})" title="מחק"><i class="fas fa-trash-alt"></i></button>
        `;
        list.appendChild(div);
    });
}

function addCustomReminder() {
    const text = val('reminderText');
    const date = val('reminderDate');
    const recType = val('reminderRecurrence');

    if (!text) { toast('יש להזין תיאור לתזכורת.', true); return; }

    let recurrence = { type: recType };
    if (recType === 'custom') {
        const num = parseInt(val('customIntervalNum')) || 1;
        const unit = val('customIntervalUnit') || 'days';
        recurrence.interval = num;
        recurrence.unit = unit;
    }

    const reminders = getReminders();
    reminders.push({
        text,
        date: date || null,
        recurrence,
        created: new Date().toISOString()
    });
    saveReminders(reminders);
    loadCustomReminders();
    toast('התזכורת נוספה!');

    document.getElementById('reminderText').value = '';
    document.getElementById('reminderDate').value = '';
    document.getElementById('reminderRecurrence').value = 'once';
    document.getElementById('customIntervalRow').style.display = 'none';
}

function deleteReminder(index) {
    const reminders = getReminders();
    reminders.splice(index, 1);
    saveReminders(reminders);
    loadCustomReminders();
    toast('התזכורת נמחקה.');
}

/* ── PASSWORD VISIBILITY ──────────────────────────────────────────── */
function togglePwd(id, btn) {
    const inp = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        inp.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

/* ── TOAST ─────────────────────────────────────────────────────────── */
function toast(msg, isErr = false) {
    document.querySelectorAll('.pf-toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'pf-toast';
    el.innerHTML = `<i class="fas ${isErr ? 'fa-exclamation-circle' : 'fa-check-circle'}" style="color:${isErr ? '#ff3b30' : '#34c759'}"></i> ${msg}`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 500);
    }, 3500);
}

/* ── HELPERS ───────────────────────────────────────────────────────── */
function getUserId() {
    const u = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    return u.id || null;
}
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function setField(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }
function setDisplay(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
