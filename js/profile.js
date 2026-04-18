document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();

    // Setup Avatar Upload
    const avatarUpload = document.getElementById('avatarUpload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('profileAvatarPreview').src = e.target.result;
                    // Update sidebar too for immediate feedback
                    const sidebarImg = document.getElementById('sidebarUserImg');
                    if (sidebarImg) sidebarImg.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Setup Details Form
    document.getElementById('profileDetailsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const avatar = document.getElementById('profileAvatarPreview').src;
        
        let avatarToSave = avatar.includes('ui-avatars.com') ? null : avatar;

        try {
            const res = await fetch('/api/user/update', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'userid': getUserId() 
                },
                body: JSON.stringify({ fullName, email, phone, avatar: avatarToSave })
            });
            const data = await res.json();
            if (data.success) {
                alert('הפרטים נשמרו בהצלחה!');
                // Update local storage
                let userStr = localStorage.getItem('loggedInUser');
                if (userStr) {
                    let user = JSON.parse(userStr);
                    user.fullName = fullName;
                    user.email = email;
                    user.phone = phone;
                    if (avatarToSave) user.avatar = avatarToSave;
                    localStorage.setItem('loggedInUser', JSON.stringify(user));
                }
                // Update hero and sidebar
                if (document.getElementById('heroNameText')) document.getElementById('heroNameText').textContent = fullName;
                loadUserProfile();
            } else {
                alert('שגיאה בשמירת הפרטים: ' + (data.error || ''));
            }
        } catch(err) {
            console.error(err);
            alert('שגיאה בתקשורת מול השרת.');
        }
    });

    // Setup Security Form
    document.getElementById('securityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'userid': getUserId()
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                alert('הסיסמה עודכנה בהצלחה!');
                document.getElementById('securityForm').reset();
            } else {
                alert('שגיאה: ' + (data.error || ''));
            }
        } catch(err) {
            console.error(err);
            alert('שגיאה בתקשורת מול השרת.');
        }
    });
});

async function loadProfileData() {
    loadUserProfile();

    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        document.getElementById('fullName').value = user.fullName || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('phone').value = user.phone || '';
        if (document.getElementById('heroNameText')) {
            document.getElementById('heroNameText').textContent = user.fullName || 'משתמש';
        }
        if (user.avatar) {
            document.getElementById('profileAvatarPreview').src = user.avatar;
        } else if (user.fullName) {
            document.getElementById('profileAvatarPreview').src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName) + '&background=0071e3&color=fff&rounded=true';
        }
    }

    const userId = getUserId();
    if (userId) {
        try {
            // OPTIMIZED: Fetch comprehensive data in ONE call
            const vRes = await fetch('/api/vehicles', { headers: { 'userid': userId }});
            if (vRes.ok) {
                const cars = await vRes.json();
                document.getElementById('statCarCount').textContent = cars.length;
                
                // Calculate alerts from the comprehensive object returned by server
                let activeAlertsCount = 0;
                cars.forEach(car => {
                    if (car.alerts) {
                        activeAlertsCount += car.alerts.filter(a => a.isActive !== false).length;
                    }
                });
                document.getElementById('statActiveAlerts').textContent = activeAlertsCount;
            }

            // Sync User Details
            const res = await fetch('/api/user/me', { headers: { 'userid': userId } });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const u = data.user;
                    document.getElementById('fullName').value = u.FullName || '';
                    document.getElementById('email').value = u.Email || '';
                    document.getElementById('phone').value = u.Phone || '';
                    if (document.getElementById('heroNameText')) document.getElementById('heroNameText').textContent = u.FullName || 'משתמש';
                    if (u.Avatar) document.getElementById('profileAvatarPreview').src = u.Avatar;
                    loadUserProfile();
                }
            }
        } catch(e) { console.warn("Sync error", e); }
    }
}

function loadUserProfile() {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    const nameEl = document.getElementById('sidebarUserName');
    const imgEl = document.getElementById('sidebarUserImg');

    if (nameEl) nameEl.textContent = user.fullName || "משתמש";
    if (imgEl) {
        imgEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=2d74d7&color=fff&rounded=true`;
    }
}

function getUserId() {
    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        return user.id;
    }
    return null;
}
