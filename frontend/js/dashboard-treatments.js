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

// --- Shared precise location helper using watchPosition ---
let _cachedUserLocation = null; // Cache last known precise location

function getPreciseLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
        onError && onError(new Error('no geolocation'));
        return;
    }
    let settled = false;
    let watchId = null;
    // Timeout fallback after 15s
    const fallbackTimer = setTimeout(() => {
        if (!settled) {
            settled = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            onError && onError(new Error('timeout'));
        }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const accuracy = pos.coords.accuracy; // meters
            _cachedUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            // Accept if accuracy ≤ 50m, or after 5s accept whatever we have
            if (!settled && accuracy <= 50) {
                settled = true;
                clearTimeout(fallbackTimer);
                navigator.geolocation.clearWatch(watchId);
                onSuccess(pos.coords);
            }
        },
        (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(fallbackTimer);
                onError && onError(err);
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Accept best reading after 5 seconds even if not ideal accuracy
    setTimeout(() => {
        if (!settled && _cachedUserLocation) {
            settled = true;
            clearTimeout(fallbackTimer);
            navigator.geolocation.clearWatch(watchId);
            onSuccess({ latitude: _cachedUserLocation.lat, longitude: _cachedUserLocation.lng, accuracy: 999 });
        }
    }, 5000);
}

// Extracts house number from address object, with fallback to display_name parsing
// Nominatim sometimes puts the house number as the first segment of display_name (e.g. "2, השוהם, מגדל העמק...")
function extractHouseNumber(addr, displayName) {
    if (addr && addr.house_number) return addr.house_number;
    if (displayName) {
        const firstPart = displayName.split(',')[0].trim();
        // Match pure numbers or number+Hebrew letter (e.g. "2", "14א")
        if (/^\d+[א-ת]?$/.test(firstPart)) return firstPart;
    }
    return '';
}

async function reverseGeocode(lat, lon) {
    const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
    );
    if (!res.ok) throw new Error('Nominatim failed');
    const data = await res.json();
    if (data && data.address) {
        const houseNumber = extractHouseNumber(data.address, data.display_name);
        const street = data.address.road || data.address.pedestrian || data.address.footway || '';
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
        let parts = [];
        if (street) parts.push(houseNumber ? `${street} ${houseNumber}` : street);
        if (city) parts.push(city);
        if (parts.length > 0) return parts.join(', ');
        if (data.display_name) return data.display_name.split(',').slice(0, 2).join(', ');
    }
    return null;
}

window.fetchCurrentLocation = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (!navigator.geolocation) {
        alert('הדפדפן שלך אינו תומך באיתור מיקום');
        return;
    }

    input.placeholder = 'מאתר מיקום מדויק...';
    input.value = '';
    
    getPreciseLocation(async (coords) => {
        const lat = coords.latitude;
        const lon = coords.longitude;
        try {
            const address = await reverseGeocode(lat, lon);
            input.value = address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        } catch(e) {
            console.error(e);
            input.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
        input.placeholder = "לדוג': מוסך העמק";
    }, (err) => {
        console.error(err);
        alert('שגיאה בקבלת המיקום. אנא ודא ששירותי המיקום פועלים.');
        input.placeholder = "לדוג': מוסך העמק";
    });
};

// ---- Garage Address Autocomplete (Nominatim) ----
let _autocompleteDebounce = null;

function buildAutocompleteDropdown(inputEl) {
    // Create dropdown container once
    let dropdown = inputEl._acDropdown;
    if (!dropdown) {
        // Wrap just the input in a relative-positioned div so top:100% works correctly
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative; display:block;';
        inputEl.parentElement.insertBefore(wrapper, inputEl);
        wrapper.appendChild(inputEl);

        dropdown = document.createElement('div');
        dropdown.style.cssText = [
            'position:absolute',
            'top:100%',
            'left:0',
            'right:0',
            'z-index:9999',
            'background:#fff',
            'border:1px solid #d1d5db',
            'border-radius:10px',
            'box-shadow:0 8px 24px rgba(0,0,0,0.15)',
            'max-height:220px',
            'overflow-y:auto',
            'margin-top:3px',
            'display:none'
        ].join(';');
        wrapper.appendChild(dropdown);
        inputEl._acDropdown = dropdown;

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
    return dropdown;
}

// ---- Shared dropdown item renderer ----
function showDropdownItems(labels, dropdown, inputEl) {
    dropdown.innerHTML = '';
    if (!labels || labels.length === 0) { dropdown.style.display = 'none'; return; }
    labels.slice(0, 7).forEach(label => {
        const item = document.createElement('div');
        item.textContent = label;
        item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:0.92rem;border-bottom:1px solid #f1f5f9;direction:rtl;text-align:right;background:#fff;';
        item.addEventListener('mouseenter', () => item.style.background = '#f0f9ff');
        item.addEventListener('mouseleave', () => item.style.background = '#fff');
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputEl.value = label;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
}

// ---- Nominatim suggestions with house-number support ----
async function fetchNominatimSuggestions(query, dropdown, inputEl) {
    // Detect Israeli "street number" format: "השוהם 2" → try Nominatim with "2 השוהם" (western format)
    const numberMatch = query.match(/^(.+?)\s+(\d+[\u05d0-\u05ea]?)\s*$/);
    const urls = [];
    let userStreet = '';
    let userNum = '';
    if (numberMatch) {
        userStreet = numberMatch[1].trim();
        userNum = numberMatch[2].trim();
        // Structured search: number before street (how Nominatim expects it)
        urls.push(`https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(userNum + ' ' + userStreet)}&countrycodes=il&addressdetails=1&limit=5&accept-language=he`);
    }
    // Also do a regular free-text search
    urls.push(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=il&addressdetails=1&limit=5&accept-language=he`);

    const allLabels = [];
    const seen = new Set();
    for (const url of urls) {
        try {
            const res = await fetch(url);
            const results = await res.json();
            if (!results || !results.length) continue;
            results.forEach(r => {
                const addr = r.address || {};
                let houseNumber = extractHouseNumber(addr, r.display_name);
                const street = addr.road || addr.pedestrian || addr.footway || '';
                const city = addr.city || addr.town || addr.village || addr.suburb || '';

                // SMART FALLBACK: If user typed a house number, but Nominatim didn't return one,
                // and the returned street matches the user's input -> Inject the number!
                if (!houseNumber && userNum && street && street.includes(userStreet)) {
                    houseNumber = userNum;
                }

                let label;
                if (street) {
                    label = houseNumber ? `${street} ${houseNumber}` : street;
                } else {
                    label = r.display_name.split(',')[0].trim();
                }
                if (city && city !== label) label += `, ${city}`;
                if (!seen.has(label)) { seen.add(label); allLabels.push(label); }
            });
        } catch(e) { console.error('Nominatim error', e); }
    }
    showDropdownItems(allLabels, dropdown, inputEl);
}

function attachGarageAutocomplete(inputEl) {
    if (!inputEl || inputEl._acAttached) return;
    inputEl._acAttached = true;
    const dropdown = buildAutocompleteDropdown(inputEl);

    inputEl.addEventListener('input', () => {
        const query = inputEl.value.trim();
        if (query.length < 2) { dropdown.style.display = 'none'; return; }
        clearTimeout(_autocompleteDebounce);
        _autocompleteDebounce = setTimeout(async () => {
            try {
                // Prefer Google Places AutocompleteService — returns full addresses WITH house numbers
                if (typeof google !== 'undefined' && google.maps && google.maps.places && google.maps.places.AutocompleteService) {
                    const service = new google.maps.places.AutocompleteService();
                    service.getPlacePredictions(
                        {
                            input: query,
                            componentRestrictions: { country: 'il' },
                            types: ['address'],  // address type → includes house numbers
                            language: 'he'
                        },
                        (predictions, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
                                const labels = predictions.map(p =>
                                    p.description
                                        .replace(/, ישראל$/i, '')
                                        .replace(/, Israel$/i, '')
                                        .trim()
                                );
                                showDropdownItems(labels, dropdown, inputEl);
                            } else {
                                // Google returned nothing → Nominatim fallback
                                fetchNominatimSuggestions(query, dropdown, inputEl);
                            }
                        }
                    );
                } else {
                    // Google not loaded yet → Nominatim
                    await fetchNominatimSuggestions(query, dropdown, inputEl);
                }
            } catch(e) {
                console.error('Autocomplete error', e);
                await fetchNominatimSuggestions(query, dropdown, inputEl);
            }
        }, 300);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdown.style.display = 'none';
    });
    inputEl.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}

// Attach autocomplete to both garage inputs
(function initGarageAutocomplete() {
    // Attach on DOM ready (inputs might be inside modals)
    const tryAttach = () => {
        attachGarageAutocomplete(document.getElementById('tGarage'));
        attachGarageAutocomplete(document.getElementById('editTGarage'));
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryAttach);
    } else {
        tryAttach();
    }
    // Also try on modal open (inputs may be lazy)
    document.addEventListener('show.bs.modal', () => setTimeout(tryAttach, 100));

    // Load Google Maps for the map picker (geocoding only)
    fetch('/api/config/maps')
        .then(res => res.json())
        .then(data => {
            if (data && data.key) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=places,geocoder&language=he`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        })
        .catch(err => console.error('Could not load Maps Config', err));
})();

// --- Map Picker Logic ---
let mapPickerInstance = null;
let mapPickerMarker = null;
let mapGeocoder = null;
let currentTargetInputId = '';
let currentSelectedAddress = '';

window.openMapPicker = function(inputId) {
    currentTargetInputId = inputId;
    
    const modalEl = document.getElementById('mapPickerModal');
    if (!modalEl) return;

    // Default to Tel Aviv until we get precise location
    const defaultLat = 32.0853, defaultLng = 34.7818;

    function initMapAtPos(lat, lng) {
        // Check Google Maps loaded
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            alert('שירות המפות עדיין בטעינה, אנא נסה שנית בעוד מספר שניות.');
            return;
        }
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        modalEl.addEventListener('shown.bs.modal', function onModalShown() {
            modalEl.removeEventListener('shown.bs.modal', onModalShown);

            if (!mapPickerInstance) {
                mapPickerInstance = new google.maps.Map(document.getElementById('mapPickerCanvas'), {
                    center: { lat, lng },
                    zoom: 16,
                    mapTypeControl: false,
                    streetViewControl: false
                });

                mapPickerMarker = new google.maps.Marker({
                    position: { lat, lng },
                    map: mapPickerInstance,
                    draggable: true,
                    animation: google.maps.Animation.DROP
                });

                mapGeocoder = new google.maps.Geocoder();

                mapPickerMarker.addListener('dragend', () => {
                    updateAddressFromLatLng(mapPickerMarker.getPosition());
                });

                mapPickerInstance.addListener('click', (e) => {
                    mapPickerMarker.setPosition(e.latLng);
                    updateAddressFromLatLng(e.latLng);
                });

                updateAddressFromLatLng({ lat, lng });
            } else {
                // Move existing map to current location
                const pos = { lat, lng };
                mapPickerInstance.setCenter(pos);
                mapPickerMarker.setPosition(pos);
                google.maps.event.trigger(mapPickerInstance, 'resize');
                updateAddressFromLatLng(pos);
            }
        });
    }

    // Try to get precise user location before opening map
    const addressEl = document.getElementById('mapSelectedAddress');
    if (addressEl) addressEl.textContent = 'מאתר מיקום נוכחי...';

    // Use cached location if recent, otherwise fetch
    if (_cachedUserLocation) {
        initMapAtPos(_cachedUserLocation.lat, _cachedUserLocation.lng);
    } else if (navigator.geolocation) {
        // Try quick location (up to 4 seconds), fallback to Tel Aviv
        let done = false;
        const timer = setTimeout(() => {
            if (!done) { done = true; initMapAtPos(defaultLat, defaultLng); }
        }, 4000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    _cachedUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    initMapAtPos(_cachedUserLocation.lat, _cachedUserLocation.lng);
                }
            },
            () => { if (!done) { done = true; clearTimeout(timer); initMapAtPos(defaultLat, defaultLng); } },
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
        );
    } else {
        initMapAtPos(defaultLat, defaultLng);
    }
};

function extractCleanAddress(results) {
    if (!results || results.length === 0) return null;
    // Google Geocoder always sorts results from most specific to least specific.
    // results[0] is exactly what's on the map pin (including business name + house number if it exists).
    // We just remove the country name.
    return results[0].formatted_address.replace(/, ישראל$/i, '').replace(/, Israel$/i, '').trim();
}

async function updateAddressFromLatLng(latLng) {
    const addressEl = document.getElementById('mapSelectedAddress');
    if (!addressEl) return;
    
    addressEl.textContent = 'מחפש כתובת...';
    
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;

    // Try Google Geocoder first
    if (mapGeocoder || (typeof google !== 'undefined' && google.maps)) {
        if (!mapGeocoder) mapGeocoder = new google.maps.Geocoder();
        
        try {
            await new Promise((resolve) => {
                mapGeocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        currentSelectedAddress = extractCleanAddress(results);
                        addressEl.textContent = currentSelectedAddress;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }).then(async (success) => {
                if (!success) {
                    // Fallback to Nominatim
                    await fetchAddressFromNominatim(lat, lng, addressEl);
                }
            });
            return;
        } catch(e) {
            console.error('Google Geocoder error:', e);
        }
    }
    
    // Fallback: use Nominatim if Google not available
    await fetchAddressFromNominatim(lat, lng, addressEl);
}

async function fetchAddressFromNominatim(lat, lng, addressEl) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=he`
        );
        if (!res.ok) throw new Error('Nominatim failed');
        const data = await res.json();
        
        if (data && data.address) {
            const houseNumber = extractHouseNumber(data.address, data.display_name);
            const street = data.address.road || data.address.pedestrian || data.address.footway || '';
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
            let parts = [];
            if (street) parts.push(houseNumber ? `${street} ${houseNumber}` : street);
            if (city) parts.push(city);
            currentSelectedAddress = parts.length > 0 ? parts.join(', ') :
                (data.display_name ? data.display_name.split(',').slice(0, 2).join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } else {
            currentSelectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    } catch(e) {
        console.error('Nominatim error:', e);
        currentSelectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    if (addressEl) addressEl.textContent = currentSelectedAddress;
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
