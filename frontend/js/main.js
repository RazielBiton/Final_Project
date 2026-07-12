/**
 * @fileoverview main.js
 * @description קובץ האתחול הראשי של ממשק המשתמש (מבוסס תבנית Helios). אחראי על ניהול אנימציות טעינה ראשוניות, הגדרת תפריט הניווט למובייל (Nav Panel) ויצירת כפתורי הניווט.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * פונקציית מעטפת (IIFE) המריצה באופן אוטומטי את קוד האתחול של האתר.
 * פונקציה זו מגדירה את משתני הסביבה של החלון וה-DOM, ומאתחלת את רכיבי הניווט ותצוגת הדף.
 * השימוש בפונקציה בעילום שם מבטיח שמירה על סביבת משתנים מבודדת (Scope) שאינה מתנגשת עם סקריפטים אחרים.
 * 
 * @returns {void}
 */
(function() {
    "use strict";

    const $window = window;
    const $body = document.body;
    const settings = {
        carousels: {
            speed: 4,
            fadeIn: true,
            fadeDelay: 250
        },
    };

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

    console.log("Navigation dropdowns ready");
    
    const navButton = document.createElement('div');
    navButton.id = 'navButton';
    navButton.innerHTML = '<a href="#navPanel" class="toggle"></a>';
    $body.appendChild(navButton);

    const navElement = document.querySelector('#nav');
    const navPanel = document.createElement('div');
    navPanel.id = 'navPanel';
    navPanel.innerHTML = `<nav>${Utils.navList(navElement)}</nav>`;
    $body.appendChild(navPanel);

    Utils.panel(navPanel, {
        delay: 500,
        hideOnClick: true,
        visibleClass: 'navPanel-visible'
    });

})();