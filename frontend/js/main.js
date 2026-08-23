/**
 * @fileoverview main.js
 * @description קובץ האתחול הראשי של ממשק המשתמש (מבוסס תבנית Helios). אחראי על ניהול אנימציות הטעינה הראשוניות של דף הבית.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * פונקציית מעטפת (IIFE) המריצה באופן אוטומטי את קוד האתחול של האתר.
 * פונקציה זו מגדירה את משתני הסביבה של החלון וה-DOM, ומאתחלת את תצוגת הדף.
 * השימוש בפונקציה בעילום שם מבטיח שמירה על סביבת משתנים מבודדת (Scope) שאינה מתנגשת עם סקריפטים אחרים.
 * 
 * @returns {void}
 */
(function() {
    "use strict";

    const $window = window;
    const $body = document.body;

    /**
     * מאזין לאירוע טעינת הדף (load).
     * מסיר את מחלקת ה-preload מתגית ה-body לאחר השהיה קלה, 
     * פעולה המאפשרת לאנימציות ה-CSS ההתחלתיות (מעברים) לפעול בצורה חלקה רק לאחר סיום טעינת התוכן.
     * 
     * @returns {void}
     */
    $window.addEventListener('load', () => {
        $window.setTimeout(() => {
            $body.classList.remove('is-preload');
        }, 100);
    });

})();
