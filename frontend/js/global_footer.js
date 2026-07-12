/**
 * @fileoverview global_footer.js
 * @description רכיב גלובלי האחראי על הזרקת תוכן התחתית (Footer) לכלל דפי האפליקציה, ניהול התצוגה שלו בהתאם לפתיחת חלונות קופצים (Modals), ומערכת תצוגה מקדימה לקבצים (PDF/תמונות).
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת הדף (DOMContentLoaded).
 * הפונקציה מאתרת את אלמנט התחתית הגלובלי, מזריקה לתוכו את קוד ה-HTML של התחתית, 
 * ומגדירה לוגיקה חכמה להסתרת התחתית בזמן שחלונות קופצים (Bootstrap Modals) פעילים במסך (על מנת למנוע כפילויות גלילה או הסתרת מידע).
 * 
 * @returns {void}
 */
document.addEventListener("DOMContentLoaded", function () {
    const footerHtml = `
    <p class = "footer-text">Final Project - EasyCare Team<br>Raziel Biton & Michael Geyshes</p>
    <button class="footer-contact" onclick="window.location.href='contact.html'">contact us</button>`;

    const footerContainer = document.querySelector(".global-footer");
    if (footerContainer) {
        footerContainer.innerHTML = footerHtml;
        
        /**
         * מאזין לאירוע פתיחת חלון קופץ (Modal) של Bootstrap.
         * מסתיר את תחתית האתר הגלובלית.
         * 
         * @returns {void}
         */
        document.addEventListener('show.bs.modal', () => {
            footerContainer.style.display = 'none';
        });

        /**
         * מאזין לאירוע סגירת חלון קופץ (Modal) של Bootstrap.
         * מוודא שאין חלונות נוספים פתוחים. במידה והמסך התנקה לחלוטין מחלונות קופצים, 
         * הוא מחזיר את תחתית האתר לתצוגה ומשחרר את נעילת הגלילה של הדף.
         * 
         * @returns {void}
         */
        document.addEventListener('hidden.bs.modal', () => {
            setTimeout(() => {
                const openModals = document.querySelectorAll('.modal.show');
                if (openModals.length === 0) {
                    footerContainer.style.display = 'flex'; 
                    document.body.classList.remove('modal-open');
                } else {
                    document.body.classList.add('modal-open'); 
                }
            }, 50); 
        });
    }
});

/**
 * פונקציה גלובלית המציגה תצוגה מקדימה לקבצים (תמונות או מסמכי PDF) בתוך חלון קופץ מותאם.
 * המערכת בוררת בין הצגת תמונה (img) לבין מסגרת פנימית (iframe) על בסיס סוג הקובץ שהתקבל.
 * 
 * @param {string} src - קישור (URL) ישיר לנתיב הקובץ אותו נרצה להציג
 * @param {string} [type='image'] - סוג הקובץ לתצוגה ('image' עבור תמונות, 'pdf' עבור מסמכים)
 * @returns {void}
 * @throws {Error} - אינה זורקת שגיאה בצורה מפורשת, אך נדרש שאלמנט המודל ימצא ב-DOM
 */
window.showFilePreview = function (src, type = 'image') {
    const modalEl = document.getElementById('filePreviewModal');
    if (!modalEl) return;
    
    const imgPreview = document.getElementById('filePreviewImg');
    const iframePreview = document.getElementById('filePreviewIframe');

    if (type === 'pdf') {
        imgPreview.classList.add('d-none');
        iframePreview.classList.remove('d-none');
        iframePreview.src = src;
    } else {
        iframePreview.classList.add('d-none');
        imgPreview.classList.remove('d-none');
        imgPreview.src = src;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}