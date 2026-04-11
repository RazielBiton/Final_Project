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
        
        // Don't save the default ui-avatars URL to DB if they didn't upload, keep it null or keep existing
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
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('הסיסמה החדשה ואימות הסיסמה אינם תואמים!');
            return;
        }

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
    // Optimistic Load from LocalStorage
    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        document.getElementById('fullName').value = user.fullName || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('phone').value = user.phone || '';
        if (user.avatar) {
            document.getElementById('profileAvatarPreview').src = user.avatar;
        } else if (user.fullName) {
            document.getElementById('profileAvatarPreview').src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName) + '&background=2d74d7&color=fff&rounded=true';
        }
    }

    // Fetch from API to ensure sync
    const userId = getUserId();
    if (userId) {
        try {
            const res = await fetch('/api/user/me', { headers: { 'userid': userId } });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const u = data.user;
                    document.getElementById('fullName').value = u.FullName || '';
                    document.getElementById('email').value = u.Email || '';
                    document.getElementById('phone').value = u.Phone || '';
                    if (u.Avatar) {
                        document.getElementById('profileAvatarPreview').src = u.Avatar;
                    }
                    
                    // Sync local storage
                    if (userStr) {
                        let localUser = JSON.parse(userStr);
                        localUser.fullName = u.FullName;
                        localUser.email = u.Email;
                        localUser.phone = u.Phone;
                        localUser.avatar = u.Avatar;
                        localStorage.setItem('loggedInUser', JSON.stringify(localUser));
                    }
                }
            }
        } catch(e) {
            console.warn("Could not sync profile with server", e);
        }
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
