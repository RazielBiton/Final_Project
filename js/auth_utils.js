/**
 * Auth Utilities for EasyCare
 * Handles global logout and session management
 */

/**
 * Universal Image Compression Utility
 * Resizes image to maxDimension and compresses with quality factor
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
document.addEventListener('DOMContentLoaded', () => {
    // We can also auto-attach to any element with data-logout
    document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
});
