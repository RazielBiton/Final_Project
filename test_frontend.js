const fs = require('fs');

async function test() {
    console.log("Starting test fetch...");
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: "למה הוא רושם לי עכשיו ככה", 
                carContext: "אין נתונים זמינים לרכב זה כרגע.", 
                history: [
                    { text: "היי! אני סייע ה-AI של EasyCare. 🧠 יש לי גישה לאבחונים ולכלל ההיסטוריה של הרכב שלך. איך אפשר לעזור היום?", sender: "ai" },
                    { text: "מתי הטסט הבא שלי ומה צריך להכין?", sender: "user" },
                    { text: "מצטער, נתוני הרכב לא נטענו, כך שאין לי את תאריך הטסט המדויק עבורך. 🛠️\\nתוכל למצוא את התאריך ברישיון הרכב או באפליקציית משרד התחבורה.\\nלהכנה: ודא שהרכב נקי, כל האורות תקינים, צמיגים תקינים ואין נורות אזהרה דולקות בלוח השעונים.\\nאל תשכח להביא תעודת ביטוח חובה ורישיון רכב בתוקף. ✅", sender: "ai" }
                ] 
            })
        });

        console.log("Response status:", response.status);
        const data = await response.text();
        console.log("Response data:", data);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
test();
