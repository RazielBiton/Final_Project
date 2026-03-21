function toggleMenu(btn) {
    const card = btn.closest('.our-team');
    const dropdown = btn.nextElementSibling;

    // סוגר תפריטים אחרים
    document.querySelectorAll('.dropdown-content').forEach(menu => {
        if (menu !== dropdown) {
            menu.classList.remove('show');
            menu.closest('.our-team').classList.remove('menu-open');
        }
    });

    // פותח/סוגר את הנוכחי
    const isOpen = dropdown.classList.toggle('show');

    if (isOpen) {
        card.classList.add('menu-open');
    } else {
        card.classList.remove('menu-open');
    }
}

document.querySelectorAll('.our-team').forEach(card => {

    card.addEventListener('mouseleave', () => {
        // מחפש את הדרופ-דאון בתוך הכרטיס הספציפי הזה
        const dropdown = card.querySelector('.dropdown-content');

        // סוגר רק אם הוא באמת פתוח
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            card.classList.remove('menu-open');
        }
    });
});

// סגירה בלחיצה מחוץ לתפריט
window.onclick = function (event) {
    if (!event.target.matches('.menu-btn')) {
        document.querySelectorAll('.dropdown-content').forEach(menu => menu.classList.remove('show'));
        document.querySelectorAll('.our-team').forEach(card => card.classList.remove('menu-open'));
    }
}



document.addEventListener('DOMContentLoaded', async () => {
    const row = document.getElementById('vehicleRow');
    const addWrapper = document.getElementById('addCardWrapper');
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        // Not logged in -> redirect to login
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('/api/vehicles', {
            headers: { 'userid': userId }
        });
        
        if (!res.ok) throw new Error('Failed to fetch vehicles');
        
        const savedCars = await res.json();
        
        // Also save to localStorage as a fallback cache for now so other pages don't crash yet
        // Since API doesn't return nested arrays (treatments, etc) right now, we map it
        const memCars = savedCars.map(car => {
            return {
                id: car.Id,
                brandHeb: car.BrandHeb,
                model: car.Model,
                year: car.Year,
                logo: car.Logo || 'images/logos/default.png',
                licensePlate: car.LicensePlate,
                treatments: [], accidents: [], fuelLog: [], reports: []
            };
        });
        localStorage.setItem('userCars', JSON.stringify(memCars));

        memCars.forEach(car => {
            const col = document.createElement('div');
            col.className = 'col-12 col-sm-6 col-md-5 col-lg-3';
            // המבנה המקורי שלך מילה במילה
            col.innerHTML = `
                <div class="our-team">
                    <div class="card-menu">
                        <button class="menu-btn" onclick="toggleMenu(this)">⋮</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="previewCar(${car.id})">Preview</a>
                            <a href="#" onclick="editCar(${car.id})">Edit</a>
                            <a href="#" onclick="deleteCar(${car.id})" class="delete">Delete</a>
                        </div>
                    </div>
                    <div class="picture">
                        <img src="${car.logo}" onerror="this.src='images/logos/default.png'">
                    </div>
                    <div class="team-content">
                        <h3 class="name" title="${car.brandHeb} ${car.model}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; ${(car.brandHeb + ' ' + car.model).length > 18 ? 'font-size: 1rem;' : ((car.brandHeb + ' ' + car.model).length > 14 ? 'font-size: 1.15rem;' : '')}">${car.brandHeb} ${car.model}</h3>
                        <ul class="social"><li></li></ul>
                        <a class="btn_enter" href="dashboard.html?id=${car.id}">כניסה לרכב</a>
                        <br><br>
                        <h4 class="title">${car.year}</h4>
                    </div>
                </div>
            `;
            row.insertBefore(col, addWrapper);
        });

    } catch (err) {
        console.error('Error fetching cars:', err);
        alert('שגיאה בטעינת צי הרכבים שלך ממסד הנתונים.');
    }
});

function toggleMenu(btn) {
    btn.nextElementSibling.classList.toggle('show');
}

async function deleteCar(id) {
    const userId = localStorage.getItem('userId');
    if (confirm('האם אתה בטוח שברצונך למחוק את הרכב?')) {
        try {
            const res = await fetch(`/api/vehicles/${id}`, {
                method: 'DELETE',
                headers: { 'userid': userId }
            });
            if (res.ok) {
                // Remove from cache
                let cars = JSON.parse(localStorage.getItem('userCars')) || [];
                cars = cars.filter(c => c.id !== id);
                localStorage.setItem('userCars', JSON.stringify(cars));
                location.reload();
            } else {
                alert('שגיאה במחיקת הרכב מהשרת.');
            }
        } catch(err) {
            console.error(err);
        }
    }
}

// Redirects to dashboard for this car
function previewCar(id) {
    window.location.href = `dashboard.html?id=${id}`;
}

let currentEditingCarId = null;

// Opens edit modal for the car
function editCar(id) {
    const cars = JSON.parse(localStorage.getItem('userCars')) || [];
    const car = cars.find(c => c.id === id);
    if (!car) return;

    currentEditingCarId = id;

    // Fill the current data into the fields
    document.getElementById('editBrand').value = car.brandHeb;
    document.getElementById('editModel').value = car.model;
    document.getElementById('editLogoPreview').src = car.logo || 'images/logos/default.png';

    // Open via Bootstrap JS
    const editModal = new bootstrap.Modal(document.getElementById('editVehicleModal'));
    editModal.show();
}

// Image preview handler
document.getElementById('editLogoInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('editLogoPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

async function saveVehicleDetails() {
    if (!currentEditingCarId) return;

    const brand = document.getElementById('editBrand').value.trim();
    const model = document.getElementById('editModel').value.trim();
    const logoSrc = document.getElementById('editLogoPreview').src;

    if (!brand || !model) {
        alert('יש להזין שם יצרן ודגם.');
        return;
    }

    const userId = localStorage.getItem('userId');
    
    try {
        const payload = { brandHeb: brand, model: model, logo: logoSrc };
        const res = await fetch(`/api/vehicles/${currentEditingCarId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'userid': userId 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Update local cache
            let cars = JSON.parse(localStorage.getItem('userCars')) || [];
            const carIndex = cars.findIndex(c => c.id === currentEditingCarId);
            if (carIndex !== -1) {
                cars[carIndex].brandHeb = brand;
                cars[carIndex].model = model;
                if (logoSrc && !logoSrc.endsWith('default.png')) {
                    cars[carIndex].logo = logoSrc;
                }
                localStorage.setItem('userCars', JSON.stringify(cars));
            }
            location.reload(); // Reload to show shiny new edits
        } else {
            alert('שגיאה בעדכון הרכב בשרת.');
        }
    } catch (err) {
        console.error(err);
        alert('שגיאת תקשורת.');
    }
}