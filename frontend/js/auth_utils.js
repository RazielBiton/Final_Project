/**
 * @fileoverview frontend/js/auth_utils.js
 * @description קובץ שירות גלובלי המכיל פונקציות עזר (Utilities) החוצות את המערכת. הוא מנהל בעיקר את תהליך ההתנתקות המלא של המשתמש (Logout) כולל ניקוי זיכרון וניתוק מ-Supabase, וכן מכיל פונקציה חכמה לדחיסת תמונות (Image Compression) לפני שליחתן לשרת כדי לחסוך ברוחב פס ומקום אחסון.
 * @author Michael Geyshes & Raziel Biton
 * @version 1.0.0
 */

/**
 * פונקציית שירות גלובלית לדחיסת תמונות המועלות על ידי המשתמש לפני השמירה בבסיס הנתונים.
 * הפונקציה ממוזערת ומשנה את פרופורציות התמונה (Resize) כך שלא תעבור ממד מרבי מוגדר, ושומרת עליה בפורמט JPEG באיכות רצויה למניעת עומס על האחסון (Storage).
 * @param {string} base64 - מחרוזת התמונה המקורית בקידוד Base64 כפי שהתקבלה מהטופס.
 * @param {number} [maxDimension=1200] - הממד המקסימלי המותר (אורך או רוחב, הגדול מביניהם) בפיקסלים.
 * @param {number} [quality=0.7] - איכות הדחיסה מ-0.0 (הכי נמוך) עד 1.0 (הכי גבוה).
 * @param {Function} callback - פונקציית קריאה חוזרת (Callback) המקבלת את מחרוזת ה-Base64 של התמונה לאחר הדחיסה (או התמונה המקורית במקרה של שגיאה).
 */
window.compressImage = function (base64, maxDimension = 1200, quality = 0.7, callback) {
    const img = new Image();
    img.src = base64;
    img.onload = function () {
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
            }
        } else {
            if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Output compressed base64
        const compressed = canvas.toDataURL('image/jpeg', quality);
        callback(compressed);
    };
    img.onerror = function() {
        console.warn("Compression failed, using original.");
        callback(base64);
    };
};

/**
 * מנהל את תהליך ההתנתקות המלא של המשתמש מהמערכת (Logout).
 * מבצע סדרת פעולות אבטחה וניקוי: ניתוק מול שירותי Supabase (אם קיים), מחיקת כלל המפתחות הרגישים מ-LocalStorage ו-SessionStorage, ולבסוף הפניה חזרה למסך ההתחברות הראשי (login.html).
 * @param {Event} [e] - אירוע הלחיצה על כפתור ההתנתקות. משמש למניעת התנהגות ברירת המחדל של אלמנט ה-A.
 * @returns {Promise<void>} - מבצע את הניתוק האסינכרוני מול השרת ומעביר דף.
 */
async function handleLogout(e) {
    if (e) e.preventDefault();
    
    console.log('Logging out...');

    // 1. Clear Supabase Session (if available)
    try {
        const configRes = await fetch('/api/config/supabase');
        if (configRes.ok) {
            const config = await configRes.json();
            if (window.supabase) {
                const supabaseClient = window.supabase.createClient(config.url, config.key, {
                    auth: {
                        storage: window.sessionStorage,
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                await supabaseClient.auth.signOut();
                console.log('Supabase session cleared');
            }
        }
    } catch (err) {
        console.error('Error signing out from Supabase:', err);
    }

    // 2. Clear all LocalStorage items (for absolute safety/cleanup)
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.includes('sb-') || key.includes('user') || key.includes('logged') || key.includes('current')) {
            localStorage.removeItem(key);
        }
    });
    
    // Explicitly remove known items
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('userCars');
    localStorage.removeItem('currentVehicle');
    
    // 3. Clear SessionStorage (main storage now)
    sessionStorage.clear();
    
    console.log('LocalStorage and SessionStorage cleared');

    // 4. Redirect to login page
    window.location.href = 'login.html';
}

// Global initialization if needed
/**
 * מאזין לאירוע טעינת ה-DOM. 
 * סורק את ה-HTML עבור כל אלמנט המכיל את התכונה `data-logout` ומוסיף לו באופן אוטומטי מאזין לחיצה המפעיל את פונקציית ההתנתקות (handleLogout).
 * @param {Event} event - אירוע טעינת הדף.
 */
document.addEventListener('DOMContentLoaded', () => {
    // We can also auto-attach to any element with data-logout
    document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
});
