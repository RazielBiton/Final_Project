/**
 * @fileoverview profile.js
 * @description מנהל את עמוד פרופיל המשתמש, כולל עדכון פרטים אישיים, החלפת תמונת פרופיל (Avatar), שינוי סיסמה וניהול תזכורות אישיות עם תמיכה בחזרתיות.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded).
 * מאתחל את כל רכיבי הדף: נתוני המשתמש בסרגל הצד, נתוני הפרופיל בטופס, ברכת השלום, ותזכורות מותאמות אישית.
 * בנוסף, מגדיר מאזיני אירועים לשינוי תמונת פרופיל, שמירת פרטים ושינוי סוג תזכורת.
 * 
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadProfileData();
    initHeroGreeting();
    loadCustomReminders();

    document.getElementById('avatarFile').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async e => {
            const rawBase64 = e.target.result;
            
            window.compressImage(rawBase64, 400, 0.6, async (base64) => {
                document.getElementById('profileAvatar').src = base64;
                const sb = document.getElementById('sidebarUserImg');
                if (sb) sb.src = base64;

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

    document.getElementById('detailsForm').addEventListener('submit', saveDetails);

    document.getElementById('reminderRecurrence').addEventListener('change', function () {
        document.getElementById('customIntervalRow').style.display =
            this.value === 'custom' ? 'flex' : 'none';
    });
});

/**
 * מאתחל ומציג ברכת שלום מותאמת אישית למשתמש בחלק העליון של הדף.
 * הברכה משתנה בהתאם לשעה ביום (בוקר, צהריים, ערב, לילה) וכוללת את השם הפרטי של המשתמש.
 * 
 * @returns {void}
 */
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

/**
 * טוען את פרטי המשתמש המחובר (שם ותמונת פרופיל) מהאחסון המקומי ומעדכן את תצוגת סרגל הצד (Sidebar).
 * אם אין תמונה זמינה, נוצרת תמונת ברירת מחדל עם האות הראשונה של השם.
 * 
 * @returns {void}
 */
function loadUserProfile() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    const nameEl = document.getElementById('sidebarUserName');
    const imgEl = document.getElementById('sidebarUserImg');
    if (nameEl) nameEl.textContent = user.fullName || 'משתמש';
    if (imgEl) {
        imgEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=2d74d7&color=fff&rounded=true`;
    }
}

/**
 * שולף את נתוני הפרופיל המלאים של המשתמש מהאחסון המקומי ומהשרת (API) ומאכלס אותם בטופס הפרטים האישיים.
 * מעדכן את שדות הטקסט ואת תמונת הפרופיל המרכזית.
 * 
 * @returns {Promise<void>}
 */
async function loadProfileData() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    setField('fullName', user.fullName);
    setField('email', user.email);
    setField('phone', user.phone);
    setField('pwEmail', user.email);  
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

/**
 * שומר את פרטי המשתמש המעודכנים שהוזנו בטופס (שם, אימייל, טלפון ותמונה).
 * שולח את הנתונים לשרת (API), ולאחר מכן מעדכן את האחסון המקומי (sessionStorage) ומרענן את התצוגה בהתאם.
 * 
 * @param {Event} e - אובייקט האירוע של הגשת הטופס (submit)
 * @returns {Promise<void>}
 * @throws {Error} - נזרקת במקרה של שגיאת רשת מול השרת
 */
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
            let u = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
            u.fullName = fullName;
            u.email = email;
            u.phone = phone;
            u.avatar = avatarToSave; 
            sessionStorage.setItem('loggedInUser', JSON.stringify(u));
            
            setDisplay('profileDisplayName', fullName);
            setField('pwEmail', email);
            loadUserProfile(); 
            loadProfileData(); 
        } else {
            toast('שגיאה: ' + (data.error || ''), true);
        }
    } catch (err) {
        console.error(err);
        toast('שגיאה בתקשורת מול השרת.', true);
    }
}

/**
 * מאמת את הסיסמה הנוכחית מול השרת ומעדכן לסיסמה חדשה במידה וכל הבדיקות המקומיות (תקינות קלט ותאימות סיסמאות) תקינות.
 * מנהל את תצוגת ההמתנה (Spinner) ומציג הודעות חיווי בהתאם לתוצאות הפעולה מה-API.
 * 
 * @returns {Promise<void>}
 * @throws {Error} - נזרקת במקרה של תקלת תקשורת מול השרת
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

/**
 * שולף את רשימת התזכורות המותאמות אישית מתוך האחסון המקומי (localStorage).
 * 
 * @returns {Array<Object>} - מערך של אובייקטי התזכורות, או מערך ריק במידה ואין כאלו
 */
function getReminders() {
    return JSON.parse(localStorage.getItem('customReminders') || '[]');
}

/**
 * שומר את רשימת התזכורות המותאמות אישית חזרה לאחסון המקומי (localStorage).
 * 
 * @param {Array<Object>} arr - מערך אובייקטי התזכורות שיש לשמור
 * @returns {void}
 */
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

/**
 * מפרמט אובייקט חזרתיות (Recurrence) של תזכורת למחרוזת קריאה בעברית.
 * מתרגם מרווחי זמן מותאמים אישית או הגדרות מובנות מראש לטקסט מובן למשתמש.
 * 
 * @param {Object} r - אובייקט הגדרות החזרתיות של התזכורת
 * @returns {string} - מחרוזת טקסט המייצגת את תדירות התזכורת
 */
function formatRecurrence(r) {
    if (!r || r.type === 'once') return 'חד פעמי';
    if (r.type === 'custom') {
        const unitLabels = { days: 'ימים', weeks: 'שבועות', months: 'חודשים' };
        return `כל ${r.interval} ${unitLabels[r.unit] || r.unit}`;
    }
    return recurrenceLabels[r.type] || r.type;
}

/**
 * טוען את כל התזכורות השמורות מהאחסון המקומי ומרנדר (בונה) אותן בממשק ה-HTML.
 * במקרה שאין תזכורות, מציג הודעת מצב ריק.
 * 
 * @returns {void}
 */
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

/**
 * אוספת את המידע מטופס הוספת תזכורת חדשה (תיאור, תאריך ותדירות חזרתיות), 
 * מאמתת את הקלט, יוצרת אובייקט תזכורת חדש ושומרת אותו באחסון המקומי.
 * מנקה את הטופס ומעדכנת את תצוגת התזכורות בסיום בהצלחה.
 * 
 * @returns {void}
 */
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

/**
 * מוחקת תזכורת ספציפית ממערך התזכורות שבאחסון המקומי לפי האינדקס שלה.
 * שומרת את הרשימה המעודכנת, ומרעננת את התצוגה המקומית.
 * 
 * @param {number} index - המיקום (אינדקס) של התזכורת במערך
 * @returns {void}
 */
function deleteReminder(index) {
    const reminders = getReminders();
    reminders.splice(index, 1);
    saveReminders(reminders);
    loadCustomReminders();
    toast('התזכורת נמחקה.');
}

/**
 * מחליפה בין תצוגת טקסט גלוי לבין תצוגת סיסמה מוסתרת בשדה קלט,
 * ומעדכנת בהתאמה את סמל (אייקון) כפתור התצוגה (עין פקוחה/סגורה).
 * 
 * @param {string} id - מזהה (ID) של שדה הקלט של הסיסמה
 * @param {HTMLElement} btn - כפתור הלחיצה שבאמצעותו הופעלה הפונקציה
 * @returns {void}
 */
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

/**
 * מציגה הודעה קופצת (Toast Notification) במסך לתקופה קצרה למטרות חיווי למשתמש.
 * ההודעה מעוצבת באופן אוטומטי כהצלחה או כשגיאה בהתאם לפרמטר המועבר.
 * 
 * @param {string} msg - הטקסט שיוצג בהודעה הקופצת
 * @param {boolean} [isErr=false] - האם ההודעה מסמלת שגיאה (אדום) או הצלחה (ירוק)
 * @returns {void}
 */
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

/**
 * שולפת את מזהה המשתמש (ID) השמור באחסון המקומי (sessionStorage) של הפעלת המשתמש הנוכחית.
 * 
 * @returns {string|null} - מזהה המשתמש, או null אם אינו קיים
 */
function getUserId() {
    const u = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
    return u.id || null;
}

/**
 * שולפת במעטפת בטוחה את הערך מתוך שדה קלט לפי מזהה (ID), כולל הסרת רווחים לבנים (trim).
 * 
 * @param {string} id - מזהה (ID) של שדה הקלט (Input)
 * @returns {string} - ערך המחרוזת הנקי או מחרוזת ריקה אם לא נמצא
 */
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }

/**
 * מגדירה את הערך (value) של שדה קלט בממשק אם הוא קיים בדף.
 * 
 * @param {string} id - מזהה (ID) של שדה הקלט
 * @param {string} v - הערך שיש להזין לתוך השדה
 * @returns {void}
 */
function setField(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }

/**
 * מגדירה את תוכן הטקסט הפנימי (textContent) של אלמנט תצוגה HTML אם הוא קיים בדף.
 * 
 * @param {string} id - מזהה (ID) של אלמנט ה-HTML
 * @param {string} v - הטקסט שיוכנס לאלמנט
 * @returns {void}
 */
function setDisplay(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

/**
 * בורחת (Escapes) מחרוזת נתונים כדי למנוע הזרקת קוד זדוני (XSS) לפני שהיא מוצגת בממשק.
 * 
 * @param {string} str - המחרוזת המקורית שיש לנקות
 * @returns {string} - המחרוזת הנקייה ובטוחה להצגה
 */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
