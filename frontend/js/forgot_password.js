/**
 * @fileoverview forgot_password.js
 * @description מנהל את תהליך איפוס הסיסמה של המשתמש. מטפל בשלבי התצוגה השונים, שליחת קוד אימות חד-פעמי (OTP) למייל ואימותו מול השרת לצורך עדכון סיסמה חדשה.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded).
 * מפעיל את רכיבי ממשק המשתמש ואת מאזיני האירועים הנדרשים לתהליך איפוס הסיסמה, הכוללים מעבר בין שלבים ותקשורת מול ה-API.
 * 
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    
    const fpEmail = document.getElementById('fpEmail');
    const fpOtp = document.getElementById('fpOtp');
    const fpNewPassword = document.getElementById('fpNewPassword');
    const fpNewPasswordConfirm = document.getElementById('fpNewPasswordConfirm');

    const spinner1 = document.getElementById('spinner1');
    const spinner2 = document.getElementById('spinner2');

    /**
     * מאזין לאירוע לחיצה על כפתור "שלח קוד".
     * אוסף את כתובת האימייל שהוזנה, מתקף אותה, ושולח בקשה לשרת להפקת ושליחת קוד אימות (OTP).
     * מנהל את מצב תצוגת ההמתנה (Spinner) ומעביר לשלב הבא במקרה של הצלחה.
     * 
     * @param {Event} [e] - אובייקט אירוע הלחיצה (מועבר אוטומטית למרות שלא נעשה בו שימוש ישיר)
     * @returns {Promise<void>}
     * @throws {Error} - נזרקת במקרה של שגיאת תקשורת מול השרת או החזרת סטטוס שגיאה מפורש
     */
    sendOtpBtn.addEventListener('click', async () => {
        const email = fpEmail.value.trim();
        if (!email) {
            alert('אנא הזן כתובת אימייל תקינה.');
            return;
        }

        sendOtpBtn.disabled = true;
        spinner1.style.display = 'inline-block';

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server returned status ${res.status}: ${text}`);
            }

            const data = await res.json();

            if (data.success) {
                step1.classList.remove('active');
                step2.classList.add('active');
            } else {
                alert(data.error || 'אירעה שגיאה בשליחת המייל.');
            }
        } catch (error) {
            console.error(error);
            alert('שגיאת שרת במערכת.');
        } finally {
            sendOtpBtn.disabled = false;
            spinner1.style.display = 'none';
        }
    });

    /**
     * מאזין לאירוע לחיצה על כפתור "אמת קוד ועדכן סיסמה".
     * מבצע אימות מקומי של הנתונים (קיום הערכים, תאימות סיסמאות ואורך מינימלי).
     * לאחר מכן שולח את קוד ה-OTP והסיסמה החדשה לשרת לשם אימות ועדכון, מנהל את תצוגת הטעינה ומעביר למסך ההצלחה בסיום מוצלח.
     * 
     * @param {Event} [e] - אובייקט אירוע הלחיצה (מועבר אוטומטית למרות שלא נעשה בו שימוש ישיר)
     * @returns {Promise<void>}
     * @throws {Error} - נזרקת במקרה של כשל תקשורת מול השרת או החזרת סטטוס חריג
     */
    verifyOtpBtn.addEventListener('click', async () => {
        const email = fpEmail.value.trim();
        const otp = fpOtp.value.trim();
        const password = fpNewPassword.value;
        const confirmPassword = fpNewPasswordConfirm.value;

        if (!otp || !password || !confirmPassword) {
            alert('אנא מלא את כל השדות.');
            return;
        }

        if (password !== confirmPassword) {
            alert('הסיסמאות לא תואמות.');
            return;
        }

        if (password.length < 6) {
            alert('סיסמא חייבת להיות באורך של לפחות 6 תווים.');
            return;
        }

        verifyOtpBtn.disabled = true;
        spinner2.style.display = 'inline-block';

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email, 
                    token: otp, 
                    newPassword: password 
                })
            });

            if (!res.ok) {
                let errorData;
                try {
                    errorData = await res.json();
                } catch(e) {
                    throw new Error(`Server returned status ${res.status}`);
                }
                alert(errorData.error || 'הקוד שגוי או פג תוקף.');
                verifyOtpBtn.disabled = false;
                spinner2.style.display = 'none';
                return;
            }

            const data = await res.json();

            if (data.success) {
                step2.classList.remove('active');
                step3.classList.add('active');
            } else {
                alert(data.error || 'הקוד שגוי או פג תוקף.');
            }
        } catch (error) {
            console.error(error);
            alert('שגיאת שרת במערכת.');
        } finally {
            verifyOtpBtn.disabled = false;
            spinner2.style.display = 'none';
        }
    });
});
