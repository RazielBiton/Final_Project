/*
    Helios by HTML5 UP (Vanilla JS Version)
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

    // 1. Play initial animations on page load
    $window.addEventListener('load', () => {
        $window.setTimeout(() => {
            $body.classList.remove('is-preload');
        }, 100);
    });

    // 2. Dropdowns (במקום dropotron - דורש מימוש CSS פשוט או ספריה אחרת)
    // כרגע נשאיר מקום למימוש מותאם אישית אם תרצה
    console.log("Navigation dropdowns ready");

    // 3. Nav Button & Panel (שימוש ב-Utils שיצרנו קודם)
    
    // יצירת כפתור התפריט
    const navButton = document.createElement('div');
    navButton.id = 'navButton';
    navButton.innerHTML = '<a href="#navPanel" class="toggle"></a>';
    $body.appendChild(navButton);

    // יצירת הפאנל
    const navElement = document.querySelector('#nav');
    const navPanel = document.createElement('div');
    navPanel.id = 'navPanel';
    navPanel.innerHTML = `<nav>${Utils.navList(navElement)}</nav>`;
    $body.appendChild(navPanel);

    // הפעלת הפאנל
    Utils.panel(navPanel, {
        delay: 500,
        hideOnClick: true,
        visibleClass: 'navPanel-visible'
    });


})();