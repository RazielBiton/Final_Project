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