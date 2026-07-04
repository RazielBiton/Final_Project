document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const contactSubmitBtn = document.getElementById('contactSubmitBtn');
    const contactFeedback = document.getElementById('contactFeedback');
    const contactMessage = document.getElementById('contactMessage');
    const charCount = document.getElementById('mobileCharCount');

    if (contactMessage && charCount) {
        contactMessage.addEventListener('input', () => {
            charCount.textContent = `${contactMessage.value.length}/300`;
        });
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('contactName').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            const phone = document.getElementById('contactPhone').value.trim();
            const message = document.getElementById('contactMessage').value.trim();

            if (!name || !email || !phone || !message) {
                showFeedback('אנא מלא את כל השדות', 'red');
                return;
            }

            contactSubmitBtn.disabled = true;
            contactSubmitBtn.textContent = 'שולח...\u200F';
            showFeedback('', 'transparent');

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, message })
                });

                const data = await res.json();

                if (data.success) {
                    alert('הפנייה נשלחה בהצלחה! אנחנו נחזור אליך בהקדם.');
                    contactForm.reset();
                    window.location.href = 'index.html';
                } else {
                    showFeedback(data.error || 'אירעה שגיאה בשליחת הפנייה. נסה שוב מאוחר יותר.', 'red');
                }
            } catch (err) {
                console.error('Contact Form Error:', err);
                showFeedback('שגיאת תקשורת עם השרת.', 'red');
            } finally {
                contactSubmitBtn.disabled = false;
                contactSubmitBtn.textContent = 'שלח';
            }
        });
    }

    function showFeedback(text, color) {
        contactFeedback.textContent = text;
        contactFeedback.style.color = color;
        contactFeedback.style.display = text ? 'block' : 'none';
    }
});
