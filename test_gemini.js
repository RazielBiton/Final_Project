const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const GEMINI_MODEL_CORRECT = "gemini-2.5-flash"; // Use the correct available model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_CORRECT });

async function test() {
    try {
        const userMessage = "מתי הטסט הבא שלי ומה צריך להכין?";
        const carContext = 'אין נתונים זמינים לרכב זה כרגע.';
        const historyContext = [{ text: "היי! אני סייע ה-AI של EasyCare. 🧠 יש לי גישה לאבחונים ולכלל ההיסטוריה של הרכב שלך. איך אפשר לעזור היום?", sender: "ai" }];

        let historyFormatted = [];
        historyFormatted.push({
            role: "user",
            parts: [{ text: `הוראות מערכת: אתה מוסכניק מומחה ועוזר וירטואלי של מערכת EasyCare ויש לך ידע נרחב ברכבים.\n\nלהלן כלל פרטי הרכב והמשתמש המלאים כולל הכל (אסור לך לשכוח כלום, זהו מידע קריטי):\n${carContext}\n\nחוקי הברזל שלך לתשובה:\n1. קצר מאוד וקריא: מקסימום 3-4 נקודות קצרות. אל תכתוב פסקאות ארוכות.\n2. אל תעשה רווחים גדולים בין השורות. שמור על טקסט צפוף וקריא.\n3. השתמש באימוג'י אחד או שניים כדי להחיות את הטקסט.\n\nהאם הבנת את ההוראות ואת נתוני המשתמש והרכב?` }]
        });
        historyFormatted.push({
            role: "model",
            parts: [{ text: "הבנתי, קראתי את כלל נתוני המשתמש והרכב השלמים ואני מוכן לעזור על פיהם. תשובותיי יהיו קצרות וקריאות עם אימוג'י כמבוקש." }]
        });

        if (historyContext.length > 0) {
            historyContext.forEach(msg => {
                let role = msg.sender === 'user' ? 'user' : 'model';
                let lastMsg = historyFormatted[historyFormatted.length - 1];
                if (lastMsg.role === role) {
                    lastMsg.parts[0].text += "\n" + msg.text;
                } else {
                    historyFormatted.push({
                        role: role,
                        parts: [{ text: msg.text }]
                    });
                }
            });
        }

        if (historyFormatted[historyFormatted.length - 1].role === 'user') {
            historyFormatted.push({
                role: "model",
                parts: [{ text: "ממתין להמשך..." }]
            });
        }

        console.log("historyFormatted:", JSON.stringify(historyFormatted, null, 2));

        const chat = model.startChat({
            history: historyFormatted
        });

        console.log("sending message...");
        const result = await Promise.race([
            chat.sendMessage(userMessage),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout after 10s")), 10000))
        ]);
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error caught:", e.message);
    }
}
test();
