// your code goes here
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

(function () {
    "use strict";

    // 1. ברגע שהדף נטען - Fade In
    window.addEventListener('load', () => {
        document.body.classList.remove('is-loading');
    });

    // === REGISTRATION FLOW ===
    const signUpForm = document.querySelector('.sign-up-container form');
    const registerBtn = signUpForm.querySelector('button');

    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent page reload
        const firstName = signUpForm.querySelector('.first_name').value.trim();
        const lastName = signUpForm.querySelector('.last_name').value.trim();
        const email = signUpForm.querySelector('.email').value.trim();
        const password = signUpForm.querySelector('.password').value;

        if (!firstName || !lastName || !email || !password) {
            alert('אנא מלא את כל השדות להרשמה!');
            return;
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, email, password })
            });
            const data = await res.json();

            if (data.success) {
                alert('הרשמה בוצעה בהצלחה! אנא התחבר.');
                // Clear fields
                signUpForm.reset();
                // Switch to login view
                container.classList.remove("right-panel-active");
            } else {
                alert(data.error || 'שגיאה בהרשמה.');
            }
        } catch (err) {
            console.error('Register err:', err);
            alert('שגיאת תקשורת מול השרת.');
        }
    });

    // === LOGIN FLOW ===
    const signInForm = document.querySelector('.sign-in-container form');
    const loginBtn = signInForm.querySelector('.login_btn');

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent default link/button action

        const email = signInForm.querySelector('.email').value.trim();
        const password = signInForm.querySelector('.password').value;

        if (!email || !password) {
            alert('אנא הזן אימייל וסיסמה!');
            return;
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                // שמירת המזהה של המשתמש לסשן
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userName', data.fullName);
                localStorage.setItem('userEmail', email);

                // Initialize Profile Object for Sidebar and Settings
                localStorage.setItem('loggedInUser', JSON.stringify({
                    id: data.userId,
                    fullName: data.fullName,
                    email: email
                }));

                // הפעלת ה-Fade Out
                document.body.classList.add('is-loading');

                // מעבר דף לאחר חצי שנייה
                setTimeout(() => {
                    window.location.href = loginBtn.getAttribute('data-href') || 'after_login.html';
                }, 500);
            } else {
                alert(data.error || 'אימייל או סיסמה שגויים!');
            }
        } catch (err) {
            console.error('Login err:', err);
            alert('שגיאת תקשורת מול השרת.');
        }
    });

})();