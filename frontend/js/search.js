/**
 * @fileoverview search.js
 * @description מנהל את הלוגיקה של טופס חיפוש הרכבים, כולל אימות קלט של מספר הרכב (ולידציה) והפניה לדף התוצאות עם מספר הרישוי שהוזן.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע שליחת טופס החיפוש (submit).
 * הפונקציה מונעת את טעינת הדף מחדש (ברירת המחדל), שולפת את מספר הרכב שהוזן, 
 * ומוודאת שהקלט מכיל אך ורק מספרים ואורכו נע בין 1 ל-8 ספרות.
 * אם הקלט תקין, המשתמש מופנה לדף התוצאות בתוספת פרמטר הרישוי לכתובת ה-URL. אחרת, מוצגת הודעת שגיאה מתאימה.
 * 
 * @param {Event} e - אובייקט אירוע השליחה של הטופס (submit event)
 * @returns {void}
 */
document.getElementById('searchForm').addEventListener('submit', function(e) {
    // 1. מניעת שליחת ברירת מחדל כדי שנוכל לבדוק את הקלט
    e.preventDefault();
    
    // 2. ניקוי הקלט ושליפתו
    const plateValue = document.getElementById('plateInput').value.trim();
    
    // 3. בדיקת תקינות סופית: רק מספרים, בין 1 ל-8 ספרות
    const isNumeric = /^\d+$/.test(plateValue); // בודק שזה רק מספרים
    const isValidLength = plateValue.length >= 1 && plateValue.length <= 8;

    if (isNumeric && isValidLength) {
        // אם הכל תקין - עוברים דף
        window.location.href = `results.html?plate=${plateValue}`;
    } else {
        // אם משהו השתבש (למשל המשתמש ניסה לעקוף את המערכת)
        alert("שגיאה: נא להזין מספר רכב תקין (1 עד 8 ספרות בלבד)");
    }
});