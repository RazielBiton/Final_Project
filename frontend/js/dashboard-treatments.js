// --- MODULE: TREATMENTS & INVOICES ---
window.loadTreatments = function () {
    if (!window.currentCar) {
        const stored = localStorage.getItem('currentCar');
        if (stored) window.currentCar = JSON.parse(stored);
    }
    if (!window.currentCar) return;

    const tbody = document.getElementById('treatmentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Apply max date restrictions to the Date Pickers
    const today = new Date().toISOString().split('T')[0];
    const tDateElem = document.getElementById('tDate');
    const editTDateElem = document.getElementById('editTDate');
    if (tDateElem) tDateElem.setAttribute('max', today);
    if (editTDateElem) editTDateElem.setAttribute('max', today);

    // Ensure array exists
    if (!currentCar.treatments) currentCar.treatments = [];

    // Stats
    const statTreatments = document.getElementById('stat-total-treatments');
    if (statTreatments) statTreatments.textContent = currentCar.treatments.length;

    const totalCost = currentCar.treatments.reduce((acc, t) => acc + (parseInt(t.cost) || 0), 0);
    const statCosts = document.getElementById('stat-total-cost');
    if (statCosts) statCosts.textContent = totalCost.toLocaleString() + ' ₪';

    currentCar.treatments.forEach(t => {
        const tr = document.createElement('tr');

        // Highlight row if invoice is missing
        if (!t.invoice) {
            tr.style.backgroundColor = '#fdeaea'; // light red background
        }

        let invoiceHtml = '<span class="text-muted">-</span>';
        if (t.invoice) {
            invoiceHtml = `<button class="btn btn-sm btn-link" onclick="window.viewInvoice('${t.id}')"><i class="fas fa-file-image"></i> צפה</button>`;
        }

        const kmVal = parseInt(t.km) || 0;
        const costVal = parseInt(t.cost) || 0;

        tr.innerHTML = `
            <td data-label="תאריך">${window.formatDate(t.date)}</td>
            <td data-label="סוג טיפול">${t.type || '-'}</td>
            <td data-label="מוסך">${t.garage || '-'}</td>
            <td data-label="ק&quot;מ">${kmVal.toLocaleString()}</td>
            <td data-label="חשבונית">${invoiceHtml}</td>
            <td data-label="מחיר">${costVal.toLocaleString()} ₪</td>
            <td data-label="פעולות">
                <button class="btn btn-sm btn-outline-primary" style="margin-left: 5px;" onclick="window.openEditTreatmentModal(${t.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTreatment(${t.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

}

window.saveTreatment = function () {
    const tName = document.getElementById('tName').value;
    const tDate = document.getElementById('tDate').value;
    const tGarage = document.getElementById('tGarage').value;
    const tKm = document.getElementById('tKm').value;
    const tCost = document.getElementById('tCost').value;
    const tFile = document.getElementById('tInvoice').files[0];

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    // Function to finish saving after (optional) file read
    const finishSave = (base64Invoice) => {
        const newTreatment = {
            id: Date.now(),
            type: tName,
            date: tDate,
            garage: tGarage,
            km: parseInt(tKm),
            cost: parseInt(tCost),
            invoice: base64Invoice || null
        };

        if (!currentCar.treatments) {
            currentCar.treatments = [];
        }

        // Auto-update global mileage if the treatment km is higher
        const parsedKm = parseInt(tKm);
        const currentKm = parseInt(currentCar.km) || 0;
        if (parsedKm > currentKm) {
            currentCar.km = parsedKm;
            // Instantly update the Header visual if it exists
            const headerKmElem = document.getElementById('vehicleKm');
            if (headerKmElem) headerKmElem.textContent = parsedKm.toLocaleString();
        }

        currentCar.treatments.push(newTreatment);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview(); // Update expenses

        // Modal & Reset
        const addModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addTreatmentModal'));
        if (addModal) addModal.hide();
        document.getElementById('addTreatmentForm').reset();
    };

    if (tFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (typeof compressImage === 'function') {
                window.compressImage(e.target.result, 800, 0.7, finishSave);
            } else {
                finishSave(e.target.result); // Fallback if no compression method found
            }
        };
        reader.readAsDataURL(tFile);
    } else {
        finishSave(null);
    }
}

window.deleteTreatment = function (id) {
    if (confirm('האם למחוק טיפול זה?')) {
        currentCar.treatments = currentCar.treatments.filter(t => t.id !== id);
        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();
    }
}

window.viewInvoice = function (tId) {
    const t = currentCar.treatments.find(x => x.id == tId);
    if (t && t.invoice) {
        document.getElementById('invoicePreviewImg').src = t.invoice;
        const modalElem = document.getElementById('invoiceModal');
        const modalInstance = new bootstrap.Modal(modalElem);
        
        // Overlay Click: Close if clicking anywhere outside the image
        modalElem.onclick = function(event) {
            if (event.target.id !== 'invoicePreviewImg') {
                modalInstance.hide();
            }
        };

        modalInstance.show();
    }
}

window.openEditTreatmentModal = function (tId) {
    const t = currentCar.treatments.find(x => x.id === tId);
    if (!t) return;

    document.getElementById('editTId').value = t.id;
    document.getElementById('editTName').value = t.type;
    document.getElementById('editTDate').value = window.toInputDate(t.date);
    document.getElementById('editTGarage').value = t.garage;
    document.getElementById('editTKm').value = t.km;
    document.getElementById('editTCost').value = t.cost;

    // Clear invoice input so previous file label reflects 'unchanged' if no new file is added
    document.getElementById('editTInvoice').value = "";

    new bootstrap.Modal(document.getElementById('editTreatmentModal')).show();
}

window.updateTreatment = function () {
    const tId = parseInt(document.getElementById('editTId').value);
    const tName = document.getElementById('editTName').value;
    const tDate = document.getElementById('editTDate').value;
    const tGarage = document.getElementById('editTGarage').value;
    const tKm = document.getElementById('editTKm').value;
    const tCost = document.getElementById('editTCost').value;
    const tFile = document.getElementById('editTInvoice').files[0];

    if (!tName || !tDate || !tGarage || !tKm || !tCost) {
        alert('נא למלא את כל השדות החובה');
        return;
    }

    const tIndex = currentCar.treatments.findIndex(x => x.id === tId);
    if (tIndex === -1) return;

    const finishUpdate = (base64Invoice) => {
        currentCar.treatments[tIndex].type = tName;
        currentCar.treatments[tIndex].date = tDate;
        currentCar.treatments[tIndex].garage = tGarage;
        currentCar.treatments[tIndex].km = parseInt(tKm);
        currentCar.treatments[tIndex].cost = parseInt(tCost);

        if (base64Invoice) {
            currentCar.treatments[tIndex].invoice = base64Invoice;
        }

        saveToLocalStorage();
        loadTreatments();
        if (typeof loadOverview === 'function') loadOverview();

        const editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editTreatmentModal'));
        if (editModal) editModal.hide();
        document.getElementById('editTreatmentForm').reset();
    };

    if (tFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (typeof compressImage === 'function') {
                window.compressImage(e.target.result, 800, 0.7, finishUpdate);
            } else {
                finishUpdate(e.target.result); // Fallback
            }
        };
        reader.readAsDataURL(tFile);
    } else {
        finishUpdate(null);
    }
}

window.fetchCurrentLocation = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (!navigator.geolocation) {
        alert("הדפדפן שלך אינו תומך באיתור מיקום");
        return;
    }

    input.placeholder = "מאתר מיקום נוכחי...";
    
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        try {
            // Using free Nominatim reverse geocoding
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=he`);
            if (!res.ok) throw new Error("Failed to fetch location");
            const data = await res.json();
            
            if (data && data.address) {
                const street = data.address.road || data.address.pedestrian || "";
                const city = data.address.city || data.address.town || data.address.village || "";
                let fullAddress = street;
                if (city) {
                    fullAddress += fullAddress ? `, ${city}` : city;
                }
                
                if (fullAddress) {
                    input.value = `מיקום נוכחי: ${fullAddress}`;
                } else {
                    input.value = `מיקום נוכחי: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                }
            } else {
                input.value = `מיקום נוכחי: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        } catch(e) {
            console.error(e);
            input.value = `מיקום נוכחי: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
    }, (error) => {
        console.error(error);
        alert("שגיאה בקבלת המיקום. אנא ודא ששירותי המיקום פועלים.");
        input.placeholder = "לדוג': מוסך העמק";
    });
};

// Initialize Google Maps Places Autocomplete for garage location
(function initGarageAutocomplete() {
    fetch('/api/config/maps')
        .then(res => res.json())
        .then(data => {
            if (data && data.key) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=places&language=he`;
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    const tGarageInput = document.getElementById('tGarage');
                    const editTGarageInput = document.getElementById('editTGarage');
                    
                    if (tGarageInput) {
                        new google.maps.places.Autocomplete(tGarageInput, { types: ['establishment'] });
                    }
                    if (editTGarageInput) {
                        new google.maps.places.Autocomplete(editTGarageInput, { types: ['establishment'] });
                    }
                };
                document.head.appendChild(script);
            }
        })
        .catch(err => console.error("Could not load Maps Config", err));
})();

// --- Map Picker Logic ---
let mapPickerInstance = null;
let mapPickerMarker = null;
let mapGeocoder = null;
let currentTargetInputId = '';
let currentSelectedAddress = '';

window.openMapPicker = function(inputId) {
    currentTargetInputId = inputId;
    
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        alert('שירות המפות עדיין בטעינה, אנא נסה שנית בעוד מספר שניות.');
        return;
    }

    const modalEl = document.getElementById('mapPickerModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Default to Tel Aviv
    let lat = 32.0853;
    let lng = 34.7818;

    // Use current location if possible, otherwise Tel Aviv
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            if (mapPickerInstance) {
                const posObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                mapPickerInstance.setCenter(posObj);
                mapPickerMarker.setPosition(posObj);
                updateAddressFromLatLng(posObj);
            }
        });
    }

    // Initialize map on modal shown (so the canvas has correct dimensions)
    modalEl.addEventListener('shown.bs.modal', function onModalShown() {
        modalEl.removeEventListener('shown.bs.modal', onModalShown);
        
        if (!mapPickerInstance) {
            mapPickerInstance = new google.maps.Map(document.getElementById('mapPickerCanvas'), {
                center: { lat: lat, lng: lng },
                zoom: 14,
                mapTypeControl: false,
                streetViewControl: false
            });

            mapPickerMarker = new google.maps.Marker({
                position: { lat: lat, lng: lng },
                map: mapPickerInstance,
                draggable: true,
                animation: google.maps.Animation.DROP
            });

            mapGeocoder = new google.maps.Geocoder();

            // Handle drag end
            mapPickerMarker.addListener('dragend', () => {
                updateAddressFromLatLng(mapPickerMarker.getPosition());
            });

            // Handle map click
            mapPickerInstance.addListener('click', (e) => {
                mapPickerMarker.setPosition(e.latLng);
                updateAddressFromLatLng(e.latLng);
            });
            
            // Initial address fetch
            updateAddressFromLatLng(mapPickerMarker.getPosition());
        } else {
            // Resize map to fix rendering issues inside modals
            google.maps.event.trigger(mapPickerInstance, 'resize');
            mapPickerInstance.setCenter(mapPickerMarker.getPosition());
        }
    });
};

function updateAddressFromLatLng(latLng) {
    const addressEl = document.getElementById('mapSelectedAddress');
    if (!addressEl) return;
    
    addressEl.textContent = 'מחפש כתובת...';
    
    if (!mapGeocoder) mapGeocoder = new google.maps.Geocoder();
    
    mapGeocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
            currentSelectedAddress = results[0].formatted_address;
            addressEl.textContent = currentSelectedAddress;
        } else {
            currentSelectedAddress = latLng.lat().toFixed(5) + ', ' + latLng.lng().toFixed(5);
            addressEl.textContent = currentSelectedAddress;
        }
    });
}

window.confirmMapSelection = function() {
    if (currentTargetInputId && currentSelectedAddress) {
        const input = document.getElementById(currentTargetInputId);
        if (input) {
            input.value = currentSelectedAddress;
        }
    }
    const modalEl = document.getElementById('mapPickerModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
};
