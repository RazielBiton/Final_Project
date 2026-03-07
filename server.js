const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static directory where dashboard.html exists
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const carContext = req.body.carContext || 'אין נתונים זמינים לרכב זה כרגע.';

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const fullPrompt = `
        הוראות מערכת: אתה מוסכניק מומחה ועוזר וירטואלי של מערכת EasyCare.
        ${carContext}
        
        חוקי הברזל שלך לתשובה:
        1. קצר מאוד וקריא: מקסימום 3-4 נקודות קצרות. אל תכתוב פסקאות ארוכות.
        2. אל תעשה רווחים גדולים בין השורות. שמור על טקסט צפוף וקריא.
        3. השתמש באימוג'י אחד או שניים כדי להחיות את הטקסט.
        
        שאלת המשתמש: ${userMessage}
        `;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        res.json({ reply: responseText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "אופס! נתקלתי בבעיה. נסה שוב בעוד רגע." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Chatbot Server is running on http://localhost:${PORT}`);
});
