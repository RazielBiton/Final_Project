document.addEventListener('DOMContentLoaded', () => {
    const chatWidgetBtn = document.getElementById('chatWidgetBtn');
    const chatWidgetWindow = document.getElementById('chatWidgetWindow');
    const minimizeChat = document.getElementById('minimizeChat');
    const closeChat = document.getElementById('closeChat');
    const chatHeader = document.querySelector('.chat-header');

    // Draggability for the window
    let isDraggingWindow = false;
    let windowOffsetX, windowOffsetY;

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

    // Toggle Chat Window
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

    function hideChat() {
        chatWidgetWindow.style.display = 'none';
        chatWidgetBtn.style.display = 'flex';
    }

    minimizeChat.addEventListener('click', hideChat);
    closeChat.addEventListener('click', hideChat);

    // Context Extractor for AI
    function getCarContextForAI() {
        if (!window.currentCar) return "אין כרגע רכב שנבחר. עליך לעזור כללית.";
        const c = window.currentCar;

        // Sanitize huge Base64 images from the payload so we don't crash the LLM token limits
        const sanitizedCar = JSON.parse(JSON.stringify(c));
        delete sanitizedCar.logo;
        delete sanitizedCar.gallery;
        if (sanitizedCar.treatments) sanitizedCar.treatments.forEach(t => delete t.invoice);
        if (sanitizedCar.insurance) {
            Object.keys(sanitizedCar.insurance).forEach(key => { if (sanitizedCar.insurance[key]) delete sanitizedCar.insurance[key].file; });
        }
        if (sanitizedCar.accidents) sanitizedCar.accidents.forEach(a => delete a.image);

        let ctx = `המשתמש שואל במיוחד אודות הרכב הרשום בפרופיל שלו. זה יצרן ודגם: ${c.brandHeb || c.brand} ${c.model || ''}. `;
        if (c.year) ctx += `שנת ייצור: ${c.year}. `;
        if (c.licensePlate) ctx += `מספר רישוי: ${c.licensePlate}. `;
        if (c.km) ctx += `קילומטראז' נוכחי: ${c.km}. `;
        if (c.testDate) ctx += `טסט בתוקף עד: ${c.testDate}. `;
        if (c.color) ctx += `צבע: ${c.color}. `;
        if (c.fuelType) ctx += `סוג דלק: ${c.fuelType}. `;
        if (c.engineVolume) ctx += `נפח מנוע: ${c.engineVolume} סמ"ק. `;
        if (c.horsePower) ctx += `כ"ס: ${c.horsePower}. `;
        if (c.tireFront) ctx += `צמיגים קדמיים: ${c.tireFront}. `;
        if (c.tireRear) ctx += `צמיגים אחוריים: ${c.tireRear}. `;
        if (c.disabledBadge) ctx += `משויך לקטגוריית: ${c.disabledBadge}. `;

        if (typeof window.calculateReliability === 'function') {
            ctx += `\nציון אמינות מערכתי (EasyCare Score): ${window.calculateReliability(c)}%. `;
        }

        ctx += `\n\nטיפולים (היסטוריית מוסך): `;
        if (c.treatments && c.treatments.length) {
            c.treatments.forEach(t => ctx += `\n- תאריך ${t.date ? t.date.split('-').reverse().join('/') : ''} | סוג: ${t.name} ע"י מוסך ${t.garage}. ק"מ מתועד: ${t.km}, חויב: ₪${t.cost}.`);
        } else { ctx += 'אפס טיפולים מוזנים.'; }

        ctx += `\n\nביטוחים זמינים: `;
        if (c.insurance) {
            if (c.insurance.comprehensive) ctx += `\n- פוליסת מקיף/צד ג': חברת ${c.insurance.comprehensive.company} מתוקף עד ${c.insurance.comprehensive.date}.`;
            if (c.insurance.mandatory) ctx += `\n- פוליסת חובה: חברת ${c.insurance.mandatory.company} מתוקף עד ${c.insurance.mandatory.date}.`;
        } else { ctx += 'אפס ביטוחים מוזנים.'; }

        ctx += `\n\nתאונות ודוחות שמאי: `;
        if (c.accidents && c.accidents.length) {
            c.accidents.forEach(a => ctx += `\n- תאריך ${a.date ? a.date.split('-').reverse().join('/') : ''} | מיקום ופירוט: ${a.description}. עלות משוערת: ₪${a.damageCost}.`);
        } else { ctx += 'אפס תאונות מתועדות (זה דבר חיובי).'; }

        ctx += `\n\nהיסטוריית תדלוק (דלק): `;
        if (c.fuelLog && c.fuelLog.length) {
            c.fuelLog.slice(0, 5).forEach(f => ctx += `\n- ב-${f.date ? f.date.split('-').reverse().join('/') : ''} תודלק ${f.liters} ליטר. מחיר כולל: ₪${f.cost}. מס' שעות מנוע (ק"מ מדד): ${f.currentKm}`);
        } else { ctx += 'לא תועדו תדלוקים.'; }

        ctx += `\n\nלהלן אובייקט הנתונים המלא והמוחלט של הרכב מתוך הדאטה-בייס (לשימושך החופשי במידה ומשהו חסר למעלה):\n${JSON.stringify(sanitizedCar)}`;

        return ctx;
    }

    // Chat API Handling
    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const typingIndicator = document.getElementById('typing');

    function addMessage(text, sender) {
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
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';
        typingIndicator.style.display = 'block';

        const carContext = getCarContextForAI();

        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, carContext: carContext })
            });

            const data = await response.json();
            typingIndicator.style.display = 'none';
            addMessage(data.reply, 'ai');

        } catch (error) {
            console.error(error);
            typingIndicator.style.display = 'none';
            addMessage('מצטער, השרת לא מחובר באוויר כרגע. אנא ודא ש-Server.js רץ ברקע (ע"י הרצה של \`npm start\`).', 'ai');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendMessage();
    });
});
