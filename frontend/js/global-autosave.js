/**
 * @fileoverview global-autosave.js
 * @description רכיב גלובלי האחראי לשמירה אוטומטית של נתונים (טיוטה) בשדות קלט בטפסים ברחבי האפליקציה (EasyCare). המנגנון מונע אובדן נתונים במקרה של רענון או עזיבת הדף, ומנקה את הטיוטות לאחר שמירה או שליחת טופס מוצלחת.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded).
 * מפעיל השהיה (setTimeout) של 1.5 שניות כדי לאפשר לתוכן הדינמי (SPA) להיטען במלואו.
 * לאחר מכן מאתחל את כל מנגנוני הטיוטה: שחזור נתונים קיימים, האזנה להקלדות לשמירת טיוטה, 
 * והאזנה לשליחת טפסים ולחיצות כפתור לשם ניקוי הטיוטות.
 * 
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const ignoreTypes = ['password', 'file', 'submit', 'button', 'hidden'];
        
        document.querySelectorAll('input, select, textarea').forEach(field => {
            if (!field.id || ignoreTypes.includes(field.type)) return;
            const context = window.location.search + window.location.hash;
            const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
            const draftedValue = localStorage.getItem(draftKey);
            if (draftedValue !== null) {
                if (field.type === 'checkbox' || field.type === 'radio') field.checked = (draftedValue === 'true');
                else field.value = draftedValue;
                
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        /**
         * מאזין באופן דינמי לאירועי קלט (input) בכל שדות הטופס ברחבי הדף.
         * בעת הזנת תוכן על ידי המשתמש, שומר את הערך הנוכחי באחסון המקומי (localStorage) 
         * תחת מפתח ייחודי המבוסס על נתיב הדף ומזהה השדה.
         * 
         * @param {Event} e - אובייקט אירוע הקלט (input event)
         * @returns {void}
         */
        document.body.addEventListener('input', (e) => {
            const field = e.target;
            if (!field.id || ignoreTypes.includes(field.type)) return;
            const context = window.location.search + window.location.hash;
            const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
            const val = (field.type === 'checkbox' || field.type === 'radio') ? field.checked : field.value;
            localStorage.setItem(draftKey, val);
        });

        /**
         * מאזין לאירוע שליחת טופס (submit).
         * בעת שליחה מוצלחת, עובר על כל שדות הטופס ומנקה את טיוטות האחסון המקומי שלהם,
         * על מנת שהמשתמש לא יקבל מידע ישן בכניסה הבאה לטופס.
         * 
         * @param {Event} e - אובייקט אירוע שליחת הטופס (submit event)
         * @returns {void}
         */
        document.body.addEventListener('submit', (e) => {
            const formInputs = e.target.querySelectorAll('input, select, textarea');
            formInputs.forEach(field => {
                if (!field.id) return;
                const context = window.location.search + window.location.hash;
                const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
                localStorage.removeItem(draftKey);
            });
        });

        /**
         * מאזין לאירועי לחיצה (click) על כפתורי שמירה דינמיים ברחבי האתר (למשל במודלים).
         * במידה ונלחץ כפתור המיועד לשמירה, מאתר את הטופס או המודל הרלוונטי
         * ומנקה את הטיוטות באחסון המקומי של כלל שדותיו.
         * 
         * @param {Event} e - אובייקט אירוע הלחיצה (click event)
         * @returns {void}
         */
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.db-btn-primary') || e.target.closest('[onclick*="save"]')) {
                const modalOrForm = e.target.closest('.modal') || e.target.closest('form');
                if (!modalOrForm) return;
                modalOrForm.querySelectorAll('input, select, textarea').forEach(field => {
                    if (field.id) {
                        const context = window.location.search + window.location.hash;
                        localStorage.removeItem(`Draft_${window.location.pathname}_${context}_${field.id}`);
                    }
                });
            }
        });
        
    }, 1500); 
});
