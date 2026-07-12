/**
 * @fileoverview login.js
 * @description מנהל את עמוד ההתחברות וההרשמה למערכת. מטפל במעבר בין תצוגות (אנימציות), אימות משתמשים (Login/Register) מול שרת ה-API, וכן אימות באמצעות התחברות חברתית (OAuth) מול Supabase.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

/**
 * מאזין לאירוע לחיצה על כפתור "הרשמה" (Sign Up).
 * מפעיל אנימציית CSS המעבירה את הפאנל לתצוגת טופס ההרשמה.
 * 
 * @returns {void}
 */
signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

/**
 * מאזין לאירוע לחיצה על כפתור "התחברות" (Sign In).
 * מפעיל אנימציית CSS המעבירה את הפאנל לתצוגת טופס ההתחברות.
 * 
 * @returns {void}
 */
signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

/**
 * פונקציית מעטפת (IIFE) אסינכרונית לניהול זרימת ההתחברות וההרשמה.
 * הפונקציה מנהלת טעינה ראשונית, הפניית משתמשים מחוברים, הגדרת מנגנון האימות החברתי (Supabase), והצמדת מאזיני אירועים לטפסים.
 * 
 * @returns {Promise<void>}
 */
(async function () {
    "use strict";

    /**
     * מסירה את מחלקת הטעינה (is-loading) מתגית ה-body כדי לאפשר לתצוגת הדף להופיע (Fade In) בצורה חלקה.
     * 
     * @returns {void}
     */
    function removeLoading() {
        document.body.classList.remove('is-loading');
    }
    
    if (document.readyState === 'complete') {
        removeLoading();
    } else {
        window.addEventListener('load', removeLoading);
    }

    const hasAuthHash = window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'));
    if (sessionStorage.getItem('loggedInUser') && !hasAuthHash) {
        window.location.href = 'after_login.html';
        return;
    }

    let supabase;
    try {
        const configRes = await fetch('/api/config/supabase');
        if (configRes.ok) {
            const config = await configRes.json();
            supabase = window.supabase.createClient(config.url, config.key, {
                auth: {
                    storage: window.sessionStorage,
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
            
            if (hasAuthHash) {
                checkSocialLoginCallback(supabase);
            }
        }
    } catch (err) {
        console.error('Failed to init Supabase:', err);
    }

    /**
     * בודקת האם המשתמש הופנה חזרה מדף אימות חברתי (OAuth Callback).
     * במידה וכן, מאמתת את פרטי המשתמש מול Supabase ושולחת לשרת הפנימי לסנכרון המסד ופתיחת סשן (Session) מקומי.
     * 
     * @param {Object} supabaseClient - אובייקט הלקוח של Supabase
     * @returns {Promise<void>}
     */
    async function checkSocialLoginCallback(supabaseClient) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (session && session.user) {
            try {
                document.body.classList.add('is-loading');
                const user = session.user;
                const provider = user.app_metadata.provider || 'unknown';
                
                const res = await fetch('/api/auth/social-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        fullName: user.user_metadata.full_name || '',
                        provider: provider,
                        providerId: user.id
                    })
                });
                
                const data = await res.json();
                if (data.success) {
                    sessionStorage.setItem('userId', data.userId);
                    sessionStorage.setItem('userName', data.fullName);
                    sessionStorage.setItem('userEmail', user.email);

                    sessionStorage.setItem('loggedInUser', JSON.stringify({
                        id: data.userId,
                        fullName: data.fullName,
                        email: user.email
                    }));

                    window.location.href = 'after_login.html';
                } else {
                    alert('שגיאה בהתחברות דרך ' + provider);
                    document.body.classList.remove('is-loading');
                }
            } catch (err) {
                console.error('Social auth backend error:', err);
                document.body.classList.remove('is-loading');
            }
        }
    }

    /**
     * מתחילה את תהליך ההתחברות החברתית (OAuth) מול ספק חיצוני (למשל Google) דרך Supabase.
     * מפנה את המשתמש לדף האימות של הספק.
     * 
     * @param {string} provider - שם ספק האימות (לדוגמה 'google')
     * @returns {Promise<void>}
     */
    async function handleOAuthLogin(provider) {
        if (!supabase) {
            alert('שגיאת תקשורת עם שרת האימות. נסה שוב מאוחר יותר.');
            return;
        }
        
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: window.location.origin + '/login.html',
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('OAuth error:', error);
            alert('שגיאה במהלך התחברות עם ' + provider);
        }
    }

    document.querySelectorAll('.google-btn').forEach(btn => {
        /**
         * מאזין ללחיצה על כפתור ההתחברות עם חשבון גוגל ומפעיל את זרימת האימות החברתי.
         * 
         * @param {Event} e - אובייקט הלחיצה
         * @returns {void}
         */
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            handleOAuthLogin('google');
        });
    });

    const signUpForm = document.querySelector('.sign-up-container form');
    const registerBtn = signUpForm.querySelector('button');

    /**
     * מאזין לאירוע שליחת טופס ההרשמה במערכת.
     * אוסף את נתוני המשתמש מהטופס, בודק תקינות, ומעביר לשרת לצורך יצירת חשבון חדש (Registration).
     * בסיום מוצלח מרוקן את הטופס ומעביר חזרה למסך ההתחברות.
     * 
     * @param {Event} e - אובייקט הלחיצה על כפתור ההרשמה
     * @returns {Promise<void>}
     */
    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
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
                signUpForm.reset();
                container.classList.remove("right-panel-active");
            } else {
                alert(data.error || 'שגיאה בהרשמה.');
            }
        } catch (err) {
            console.error('Register err:', err);
            alert('שגיאת תקשורת מול השרת.');
        }
    });

    const signInForm = document.querySelector('.sign-in-container form');
    const loginBtn = signInForm.querySelector('.login_btn');

    /**
     * מאזין לאירוע שליחת טופס ההתחברות הסטנדרטי (אימייל וסיסמה).
     * שולח את פרטי הגישה לשרת לשם אימות (Authentication), שומר את פרטי המשתמש באחסון המקומי,
     * ומבצע הפניה לאזור האישי במקרה של הצלחה תוך שימוש באנימציית מעבר.
     * 
     * @param {Event} e - אובייקט הלחיצה על כפתור ההתחברות
     * @returns {Promise<void>}
     */
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 

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
                sessionStorage.setItem('userId', data.userId);
                sessionStorage.setItem('userName', data.fullName);
                sessionStorage.setItem('userEmail', email);

                sessionStorage.setItem('loggedInUser', JSON.stringify({
                    id: data.userId,
                    fullName: data.fullName,
                    email: email
                }));

                document.body.classList.add('is-loading');

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