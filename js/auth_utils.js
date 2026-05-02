/**
 * Auth Utilities for EasyCare
 * Handles global logout and session management
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
                const supabaseClient = window.supabase.createClient(config.url, config.key);
                await supabaseClient.auth.signOut();
                console.log('Supabase session cleared');
            }
        }
    } catch (err) {
        console.error('Error signing out from Supabase:', err);
    }

    // 2. Clear all LocalStorage items
    // This is more aggressive and ensures nothing is left behind
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
    
    console.log('LocalStorage cleared');

    // 3. Redirect to login page
    window.location.href = 'login.html';
}

// Global initialization if needed
document.addEventListener('DOMContentLoaded', () => {
    // We can also auto-attach to any element with data-logout
    document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
});
