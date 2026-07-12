/**
 * @fileoverview frontend/js/contact.js
 * @description מודול ניהול טופס "צור קשר" במערכת. אחראי על אימות נתוני הטופס, ספירת תווים בזמן אמת ושליחת הנתונים לשרת באמצעות בקשת API אסינכרונית תוך מתן חיווי למשתמש.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת ה-DOM ומתחיל את האתחול של טופס יצירת הקשר. מחבר את המאזינים הרלוונטיים (הזנת טקסט ושליחת הטופס).
 * @param {Event} event - אירוע הטעינה.
 */
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const contactSubmitBtn = document.getElementById('contactSubmitBtn');
    const contactFeedback = document.getElementById('contactFeedback');
    const contactMessage = document.getElementById('contactMessage');
    const charCount = document.getElementById('mobileCharCount');

    if (contactMessage && charCount) {
        /**
         * מאזין לאירוע הקלדה בשדה ההודעה על מנת לספק למשתמש חיווי בזמן אמת על כמות התווים שהוקלדו (מתוך 300 המותרים).
         * @param {Event} event - אירוע ההקלדה.
         */
        contactMessage.addEventListener('input', () => {
            charCount.textContent = `${contactMessage.value.length}/300`;
        });
    }

    if (contactForm) {
        /**
         * מאזין לאירוע השליחה של הטופס (Submit).
         * מבצע ולידציית שדות בסיסית, נועל את כפתור השליחה למניעת כפילויות, שולח את הנתונים לשרת ומעביר את המשתמש לדף הבית במקרה של הצלחה (או מציג שגיאה).
         * @param {Event} e - אירוע שליחת הטופס.
         * @returns {Promise<void>}
         * @throws {Error} - מדפיס שגיאה במקרה של כשל תקשורת מול שרת ה-API.
         */
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('contactName').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            const phone = document.getElementById('contactPhone').value.trim();
            const message = document.getElementById('contactMessage').value.trim();

            if (!name || !email || !phone || !message) {
                showFeedback('אנא מלא את כל השדות', 'red');
                return;
            }

            contactSubmitBtn.disabled = true;
            contactSubmitBtn.textContent = 'שולח...\u200F';
            showFeedback('', 'transparent');

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, message })
                });

                const data = await res.json();

                if (data.success) {
                    alert('הפנייה נשלחה בהצלחה! אנחנו נחזור אליך בהקדם.');
                    contactForm.reset();
                    window.location.href = 'index.html';
                } else {
                    showFeedback(data.error || 'אירעה שגיאה בשליחת הפנייה. נסה שוב מאוחר יותר.', 'red');
                }
            } catch (err) {
                console.error('Contact Form Error:', err);
                showFeedback('שגיאת תקשורת עם השרת.', 'red');
            } finally {
                contactSubmitBtn.disabled = false;
                contactSubmitBtn.textContent = 'שלח';
            }
        });
    }

    /**
     * פונקציית עזר להצגת הודעות משוב למשתמש (הצלחה או שגיאה) מתחת לטופס.
     * @param {string} text - תוכן ההודעה להצגה.
     * @param {string} color - הצבע בו תוצג ההודעה (למשל 'red' או 'transparent').
     */
    function showFeedback(text, color) {
        contactFeedback.textContent = text;
        contactFeedback.style.color = color;
        contactFeedback.style.display = text ? 'block' : 'none';
    }
});
