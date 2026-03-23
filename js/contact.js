document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const contactSubmitBtn = document.getElementById('contactSubmitBtn');
    const contactFeedback = document.getElementById('contactFeedback');

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
            contactSubmitBtn.textContent = 'שולח...';
            showFeedback('', 'transparent');

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, message })
                });

                const data = await res.json();

                if (data.success) {
                    showFeedback('הפנייה נשלחה בהצלחה! תודה.', 'green');
                    contactForm.reset();
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
