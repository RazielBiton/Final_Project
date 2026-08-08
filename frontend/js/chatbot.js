/**
 * @fileoverview frontend/js/chatbot.js
 * @description מודול עוזר בינה מלאכותית (AI Chatbot) המספק חוויית שיחה מתקדמת מבוססת RAG. הקובץ מנהל את האינטראקציות בממשק, גרירת חלון הצ'אט, חילוץ מדויק של נתוני הרכב (Context) לשליחה למודל, והצגת היסטוריית השיחה.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * מאזין לאירוע טעינת ה-DOM ומתחיל את האתחול של רכיב הצ'אט, חילוץ היסטוריית שיחות והגדרת אירועי גרירה.
 * @param {Event} event - אירוע הטעינה.
 */
document.addEventListener('DOMContentLoaded', () => {
    const chatWidgetBtn = document.getElementById('chatWidgetBtn');
    const chatWidgetWindow = document.getElementById('chatWidgetWindow');
    const minimizeChat = document.getElementById('minimizeChat');
    const closeChat = document.getElementById('closeChat');
    const chatHeader = document.querySelector('.chat-header');
    
    let userData = null;
    let chatHistory = JSON.parse(sessionStorage.getItem('chatHistory')) || [];

    // Fetch user details
    /**
     * פונקציה אסינכרונית לשליפת פרטי המשתמש המחובר מהשרת.
     * הנתונים משמשים להעשרת הקונטקסט שמועבר לבינה המלאכותית על מנת לספק יחס אישי.
     * @returns {Promise<void>}
     * @throws {Error} מדפיס שגיאה לקונסול במידה והשליפה מהשרת נכשלה.
     */
    async function fetchUserData() {
        const userId = sessionStorage.getItem('userId') || '1';
        try {
            const res = await fetch('/api/user/me', {
                headers: { 'userid': userId }
            });
            const data = await res.json();
            if (data.success) {
                userData = data.user;
            }
        } catch (e) {
            console.error('Failed to fetch user data', e);
        }
    }
    fetchUserData();

    // Draggability for the window
    let isDraggingWindow = false;
    let windowOffsetX, windowOffsetY;

    /**
     * מאזין לאירוע תחילת לחיצה (Mousedown) על כותרת הצ'אט לצורך הפעלת מנגנון גרירת החלון.
     * @param {MouseEvent} e - אירוע העכבר.
     */
    chatHeader.addEventListener('mousedown', (e) => {
        isDraggingWindow = true;

        const rect = chatWidgetWindow.getBoundingClientRect();
        windowOffsetX = e.clientX - rect.left;
        windowOffsetY = e.clientY - rect.top;

        chatWidgetWindow.style.transition = 'none';
        chatHeader.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingWindow) return;

        let newX = e.clientX - windowOffsetX;
        let newY = e.clientY - windowOffsetY;

        const maxX = window.innerWidth - chatWidgetWindow.offsetWidth;
        const maxY = window.innerHeight - chatWidgetWindow.offsetHeight;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        chatWidgetWindow.style.left = `${newX}px`;
        chatWidgetWindow.style.top = `${newY}px`;
        chatWidgetWindow.style.bottom = 'auto';
        chatWidgetWindow.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingWindow) {
            isDraggingWindow = false;
            chatHeader.style.cursor = 'grab';
        }
    });

    // Draggability for the Button
    let isDraggingBtn = false;
    let btnOffsetX, btnOffsetY;
    let clickTimeout;

    /**
     * מאזין לאירוע תחילת לחיצה (Mousedown) על כפתור הצ'אט המרחף לצורך הפעלת מנגנון גרירת הכפתור ברחבי המסך.
     * @param {MouseEvent} e - אירוע העכבר.
     */
    chatWidgetBtn.addEventListener('mousedown', (e) => {
        isDraggingBtn = true;
        clickTimeout = false;

        setTimeout(() => { if (isDraggingBtn) clickTimeout = true; }, 150);

        const rect = chatWidgetBtn.getBoundingClientRect();
        btnOffsetX = e.clientX - rect.left;
        btnOffsetY = e.clientY - rect.top;

        chatWidgetBtn.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingBtn) return;

        let newX = e.clientX - btnOffsetX;
        let newY = e.clientY - btnOffsetY;

        const maxX = window.innerWidth - chatWidgetBtn.offsetWidth;
        const maxY = window.innerHeight - chatWidgetBtn.offsetHeight;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        chatWidgetBtn.style.left = `${newX}px`;
        chatWidgetBtn.style.top = `${newY}px`;
        chatWidgetBtn.style.bottom = 'auto';
        chatWidgetBtn.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (isDraggingBtn) {
            isDraggingBtn = false;
            chatWidgetBtn.style.transition = 'transform 0.3s ease, background-color 0.2s';
        }
    });

    // --- Touch drag for mobile ---
    chatWidgetBtn.addEventListener('touchstart', (e) => {
        isDraggingBtn = true;
        clickTimeout = false;
        setTimeout(() => { if (isDraggingBtn) clickTimeout = true; }, 150);
        const touch = e.touches[0];
        const rect = chatWidgetBtn.getBoundingClientRect();
        btnOffsetX = touch.clientX - rect.left;
        btnOffsetY = touch.clientY - rect.top;
        chatWidgetBtn.style.transition = 'none';
        e.preventDefault(); // prevent page scroll during drag
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDraggingBtn) return;
        e.preventDefault();
        const touch = e.touches[0];
        let newX = touch.clientX - btnOffsetX;
        let newY = touch.clientY - btnOffsetY;
        const maxX = window.innerWidth - chatWidgetBtn.offsetWidth;
        const maxY = window.innerHeight - chatWidgetBtn.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        chatWidgetBtn.style.left = `${newX}px`;
        chatWidgetBtn.style.top = `${newY}px`;
        chatWidgetBtn.style.bottom = 'auto';
        chatWidgetBtn.style.right = 'auto';
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (isDraggingBtn) {
            const wasTap = !clickTimeout; // true = quick tap, false = was dragged
            isDraggingBtn = false;
            chatWidgetBtn.style.transition = 'transform 0.3s ease, background-color 0.2s';

            // touchstart.preventDefault() blocks the native click event.
            // If it was a quick tap (not a drag), manually fire click.
            if (wasTap) {
                chatWidgetBtn.click();
            }
        }
    });


    // Toggle Chat Window
    /**
     * מאזין לאירוע לחיצה (Click) על כפתור הצ'אט המרחף, שאחראי על פתיחת חלון השיחה במיקום הנכון על המסך.
     * @param {MouseEvent} e - אירוע הלחיצה.
     */
    chatWidgetBtn.addEventListener('click', (e) => {
        if (clickTimeout) return;

        if (chatWidgetBtn.style.top) {
            const btnRect = chatWidgetBtn.getBoundingClientRect();

            let displayTop = btnRect.top - 400;
            if (displayTop < 0) displayTop = btnRect.bottom + 10;

            let displayLeft = btnRect.left;
            if (displayLeft + 350 > window.innerWidth) displayLeft = window.innerWidth - 360;

            chatWidgetWindow.style.top = `${displayTop}px`;
            chatWidgetWindow.style.left = `${displayLeft}px`;
            chatWidgetWindow.style.bottom = 'auto';
        }

        chatWidgetWindow.style.display = 'flex';
        chatWidgetBtn.style.display = 'none';
        setTimeout(() => { document.getElementById('userInput').focus(); }, 100);
    });

    /**
     * פונקציה להסתרת חלון השיחה והצגה מחודשת של הכפתור המרחף.
     */
    function hideChat() {
        chatWidgetWindow.style.display = 'none';
        chatWidgetBtn.style.display = 'flex';
    }

    minimizeChat.addEventListener('click', hideChat);
    closeChat.addEventListener('click', hideChat);

    const clearChatBtn = document.getElementById('clearChat');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (confirm('האם אתה בטוח שברצונך לנקות את התצוגה? (הבינה המלאכותית תמשיך לזכור את ההקשר)')) {
                // Mark all existing history as visually hidden
                chatHistory.forEach(msg => msg.hiddenVisually = true);
                
                // Add a visual indicator that it was cleared
                chatHistory.push({ 
                    text: "היי! תצוגת השיחה נוקתה, אך אני עדיין זוכר את ההקשר הקודם שלנו. 🧠 איך אוכל להמשיך לעזור?", 
                    sender: "ai" 
                });
                
                localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
                renderHistory();
            }
        });
    }

    // Context Extractor for AI
    /**
     * פונקציה קריטית (RAG Extractor) השואבת את כלל הנתונים של הרכב הנוכחי (טיפולים, קנסות, ביטוח, הוצאות) ומעבדת אותם למחרוזת קונטקסט חכמה.
     * מוחקת קבצים כבדים (כמו תמונות ב-Base64) כדי לחסוך באסימונים (Tokens) בעת שליחה למודל.
     * @returns {string} - מחרוזת קונטקסט עשירה בעברית שתשלח למודל ה-AI.
     */
    function getCarContextForAI() {
        try {
            let ctx = '';
            if (userData) {
                ctx += `פרטי המשתמש השואל: השם המלא הוא ${userData.FullName}, והאימייל שלו הוא ${userData.Email}.\n\n`;
            } else {
                ctx += `פרטי המשתמש לא זמינים כרגע. עזור כרגיל.\n\n`;
            }

            if (!window.currentCar) {
                ctx += "אין כרגע רכב שנבחר.";
                return ctx;
            }

            const c = window.currentCar;

            // Sanitize huge Base64 images from the payload so we don't crash the LLM token limits
            const sanitizedCar = JSON.parse(JSON.stringify(c));
            delete sanitizedCar.logo;
            delete sanitizedCar.gallery;
            if (Array.isArray(sanitizedCar.treatments)) sanitizedCar.treatments.forEach(t => delete t.invoice);
            if (sanitizedCar.insurance && typeof sanitizedCar.insurance === 'object') {
                Object.keys(sanitizedCar.insurance).forEach(key => { if (sanitizedCar.insurance[key]) delete sanitizedCar.insurance[key].file; });
            }
            if (Array.isArray(sanitizedCar.accidents)) sanitizedCar.accidents.forEach(a => delete a.image);

            let carInfoCtx = `המשתמש שואל במיוחד אודות הרכב הרשום בפרופיל שלו. זה יצרן ודגם: ${c.brandHeb || c.brand} ${c.model || ''}. `;
            if (c.year) carInfoCtx += `שנת ייצור: ${c.year}. `;
            if (c.licensePlate) carInfoCtx += `מספר רישוי: ${c.licensePlate}. `;
            if (c.km) carInfoCtx += `קילומטראז' נוכחי: ${c.km}. `;
            if (c.testDate) carInfoCtx += `טסט בתוקף עד: ${c.testDate}. `;
            ctx += carInfoCtx;
            if (c.color) ctx += `צבע: ${c.color}. `;
            if (c.fuelType) ctx += `סוג דלק: ${c.fuelType}. `;
            if (c.engineVolume) ctx += `נפח מנוע / קוט״ש: ${c.engineVolume}. `;
            if (c.horsePower) ctx += `כ"ס: ${c.horsePower}. `;
            if (c.tireFront) ctx += `צמיגים קדמיים: ${c.tireFront}. `;
            if (c.tireRear) ctx += `צמיגים אחוריים: ${c.tireRear}. `;
            if (c.disabledBadge) ctx += `משויך לקטגוריית: ${c.disabledBadge}. `;

            if (typeof window.calculateReliability === 'function') {
                const relScore = window.calculateReliability(c);
                ctx += `\nציון אמינות מערכתי (EasyCare Score): ${relScore}%. `;
            }

            ctx += `\n\nטיפולים (היסטוריית מוסך): `;
            if (Array.isArray(c.treatments) && c.treatments.length) {
                c.treatments.forEach(t => ctx += `\n- תאריך ${t.date ? String(t.date).split('-').reverse().join('/') : ''} | סוג: ${t.type || t.name} ע"י מוסך ${t.garage}. ק"מ מתועד: ${t.km}, חויב: ₪${t.cost}. פירוט: ${t.description || ''}`);
            } else { ctx += 'אפס טיפולים מוזנים.'; }

            ctx += `\n\nביטוחים זמינים: `;
            if (c.insurance && typeof c.insurance === 'object') {
                if (c.insurance.comprehensive) ctx += `\n- פוליסת מקיף/צד ג': חברת ${c.insurance.comprehensive.company} מתוקף עד ${c.insurance.comprehensive.date}.`;
                if (c.insurance.mandatory) ctx += `\n- פוליסת חובה: חברת ${c.insurance.mandatory.company} מתוקף עד ${c.insurance.mandatory.date}.`;
            } else { ctx += 'אפס ביטוחים מוזנים.'; }

            ctx += `\n\nתאונות ודוחות שמאי: `;
            if (Array.isArray(c.accidents) && c.accidents.length) {
                c.accidents.forEach(a => ctx += `\n- תאריך ${a.date ? String(a.date).split('-').reverse().join('/') : ''} | כותרת: ${a.title || ''}. תיאור: ${a.description || ''}. פרטי נזק: ${a.damageDetails || ''}. עלות: ₪${a.repairCost}. טופל? ${a.isHandled ? 'כן' : 'לא'}`);
            } else { ctx += 'אפס תאונות מתועדות (זה דבר חיובי).'; }

            ctx += `\n\nהיסטוריית תדלוק (דלק/חשמל): `;
            if (Array.isArray(c.fuelLog) && c.fuelLog.length) {
                c.fuelLog.slice(0, 5).forEach(f => ctx += `\n- ב-${f.date ? String(f.date).split('-').reverse().join('/') : ''} בשעה ${f.time || ''} תודלק ${f.amount || f.liters} ${f.energyType === 'electricity' ? 'קוט"ש (חשמל)' : 'ליטר (דלק)'}. מחיר לליטר/קוט"ש: ₪${f.pricePerLiter || 0}. מחיר כולל: ₪${f.cost}. מס' שעות מנוע (ק"מ מדד): ${f.currentKm || ''}`);
            } else { ctx += 'לא תועדו תדלוקים.'; }

            ctx += `\n\nהוצאות כלליות על הרכב: `;
            if (Array.isArray(c.expenses) && c.expenses.length) {
                c.expenses.forEach(e => ctx += `\n- תאריך ${e.date ? String(e.date).split('-').reverse().join('/') : ''} | קטגוריה: ${e.type}. סכום: ₪${e.amount}. פירוט: ${e.notes || ''}`);
            } else { ctx += 'אין פעולות הוצאות מתועדות.'; }

            ctx += `\n\nקנסות ודוחות: `;
            if (Array.isArray(c.reports) && c.reports.length) {
                c.reports.forEach(r => ctx += `\n- תאריך ${r.date ? String(r.date).split('-').reverse().join('/') : ''} | עבירה: ${r.offenseType}. מקום: ${r.location || ''}. קנס: ${r.amount} ש"ח, נקודות גיליון: ${r.points || 0}. ${r.isHandled ? 'טופל.' : 'ממתין לטיפול!'}`);
            } else { ctx += 'ללא קנסות או דוחות.'; }

            ctx += `\n\nהתראות מערכת: `;
            if (Array.isArray(c.alerts) && c.alerts.length) {
                c.alerts.forEach(a => ctx += `\n- נושא: ${a.title} | פירוט: ${a.description || ''} | תאריך/יעד: ${a.date ? String(a.date).split('-').reverse().join('/') : ''} | דחיפות: ${a.urgency} | פעיל? ${a.isActive ? 'כן' : 'לא'}`);
            } else { ctx += 'אין התראות במערכת.'; }

            // Removed the raw JSON dump to save massive amounts of tokens (preventing 429 Quota Exceeded)
            
            return ctx;
        } catch (err) {
            console.error("Error generating car context:", err);
            return "אירעה שגיאה בטעינת נתוני הרכב.";
        }
    }

    // Chat API Handling
    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const typingIndicator = document.getElementById('typing');

    /**
     * מוסיפה בועת הודעה חזותית לחלון השיחה (למשתמש או לבינה המלאכותית), מעצבת טקסט עם תמיכה בהדגשות (Markdown בסיסי) ושומרת בהיסטוריית השיחה.
     * @param {string} text - תוכן ההודעה להצגה.
     * @param {string} sender - זהות השולח ('user' או 'ai').
     * @param {boolean} [saveToHistory=true] - האם לשמור את ההודעה באחסון המקומי.
     */
    function addMessage(text, sender, saveToHistory = true) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender === 'user' ? 'user-msg' : 'ai-msg'}`;

        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*/g, '•')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\n/g, '<br>');

        msgDiv.innerHTML = formattedText;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (saveToHistory) {
            chatHistory.push({ text: text, sender: sender });
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
    }

    // Render existing history
    /**
     * אחראית על רינדור (Render) מחדש של היסטוריית השיחות השמורות באחסון המקומי אל תוך הממשק בעת טעינת העמוד.
     */
    function renderHistory() {
        chatBox.innerHTML = '';
        chatHistory.forEach(msg => {
            if (!msg.hiddenVisually) {
                addMessage(msg.text, msg.sender, false);
            }
        });
    }

    if (chatHistory.length > 0) {
        renderHistory();
    }

    // Quick Actions
    /**
     * פונקציה הפועלת בעת לחיצה על "פעולה מהירה" (Quick Action) ומזינה אוטומטית את הטקסט לשורת החיפוש ושולחת אותו.
     * @param {string} text - טקסט הפעולה להפעלה מהירה.
     */
    window.sendQuickAction = function(text) {
        userInput.value = text;
        sendMessage();
    };

    /**
     * גוללת את תפריט הפעולות המהירות (קרוסלה) ימינה או שמאלה.
     * @param {number} dir - כיוון הגלילה (חיובי או שלילי).
     */
    window.scrollQuickActions = function(dir) {
        const container = document.getElementById('quickActions');
        if (container) {
            container.scrollBy({ left: dir * 150, behavior: 'smooth' });
        }
    };

    /**
     * הפונקציה המרכזית לשליחת הודעת המשתמש לשרת.
     * אוספת את טקסט המשתמש, מצרפת אליו את הקונטקסט (נתוני הרכב) ואת עשר ההודעות האחרונות ושולחת בקשת POST לשרת ה-API של המודל.
     * מציגה חיווי "מקליד" ומוסיפה את תשובת הבינה המלאכותית בסיום.
     * @returns {Promise<void>}
     * @throws {Error} מצליבה במקרה של ניתוק מהשרת ומציגה הודעת אי-זמינות.
     */
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user', true);
        userInput.value = '';
        typingIndicator.style.display = 'flex';
        
        // Scroll to the typing indicator
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;

        const carContext = getCarContextForAI();

        try {
            // Keep only the last 10 messages (including the one just added) to save tokens
            // .slice(0, -1) removes the very last 'user' message because it's sent separately as 'message' in the body
            const sentHistory = chatHistory.slice(-10).slice(0, -1);
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'userid': sessionStorage.getItem('userId') || '1' },
                body: JSON.stringify({ message: text, carContext: carContext, history: sentHistory })
            });

            const data = await response.json();
            
            // Safe removal of typing indicator
            if (typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
            typingIndicator.style.display = 'none';
            
            addMessage(data.reply, 'ai', true);

        } catch (error) {
            console.error(error);
            if (typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
            typingIndicator.style.display = 'none';
            addMessage('מצטער, השרת לא מחובר באוויר כרגע. אנא ודא ש-Server.js רץ ברקע (ע"י הרצה של \`npm start\`).', 'ai');
        }
    }

    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage();
        });
    } else if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});
