let allVehicles = [];     // All vehicles returned from API
let matchedVehicles = []; // Vehicles matching the initial search term
let filterState = {
    brands: new Set(),
    fuels: new Set(),
    colors: new Set()
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get search query from URL
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q') || '';
    
    const searchInput = document.getElementById('topSearchInput');
    if(q) searchInput.value = q;

    fetchAndFilterVehicles(q);
});

// Function called when the user submits a new search from the top bar in this page
window.searchVehicles = function() {
    const q = document.getElementById('topSearchInput').value;
    // Replace URL without reloading page, or just reload page
    window.location.href = `search_results.html?q=${encodeURIComponent(q)}`;
};

async function fetchAndFilterVehicles(query) {
    const loading = document.getElementById('loadingIndicator');
    const mainContent = document.getElementById('mainContent');

    try {
        const response = await fetch('/api/vehicles/all');
        if (!response.ok) throw new Error("Failed to fetch vehicles");
        allVehicles = await response.json();
        
        // Ensure arrays are robust
        allVehicles = allVehicles || [];

        // Build AutoComplete logic using custom list
        attachAutocomplete('topSearchInput', 'globalAutocompleteList', allVehicles);

        // 2. Perform initial Match logic (License or Brand)
        const lowerQ = query.trim().toLowerCase();
        
        matchedVehicles = allVehicles.filter(v => {
            if(!lowerQ) return true; // Empty search shows all

            const plate = (v.LicensePlate || '').toLowerCase();
            const brandHeb = (v.BrandHeb || '').toLowerCase();
            const brandEn = (v.Brand || '').toLowerCase();
            const model = (v.Model || '').toLowerCase();

            return plate.includes(lowerQ) || 
                   brandHeb.includes(lowerQ) || 
                   brandEn.includes(lowerQ) ||
                   model.includes(lowerQ);
        });

        // 3. Extract dynamic available filters exactly from the MATCHED set
        extractAvailableFilters();

        // 4. Render checkboxes (which will automatically be fully unchecked by default = everything shown)
        renderFilters();

        // 5. Render Grid
        applyFiltersAndRender();
        
        // Show UI
        loading.classList.add('d-none');
        mainContent.classList.remove('d-none');

    } catch(err) {
        console.error(err);
        loading.innerHTML = `<div class="alert alert-danger">אירעה שגיאה בטעינת הנתונים. ודא שהשרת פועל כראוי.</div>`;
    }
}

let availableBrands = [];
let availableFuels = [];
let availableColors = [];

function extractAvailableFilters() {
    const brandsSet = new Set();
    const fuelsSet = new Set();
    const colorsSet = new Set();

    matchedVehicles.forEach(v => {
        if(v.BrandHeb) brandsSet.add(v.BrandHeb);
        if(v.FuelType) fuelsSet.add(v.FuelType);
        if(v.Color) colorsSet.add(v.Color);
    });

    // Convert sets to sorted arrays
    availableBrands = Array.from(brandsSet).sort();
    availableFuels = Array.from(fuelsSet).sort();
    availableColors = Array.from(colorsSet).sort();
}

function renderFilters() {
    const renderCheckboxes = (containerId, array, stateSet, filterCatName) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if(array.length === 0) {
            container.innerHTML = '<span class="text-muted small">אין אפשרויות זמינות</span>';
            return;
        }

        array.forEach(item => {
            const id = `chk_${filterCatName}_${item.replace(/\s+/g,'_')}`;
            const isChecked = stateSet.has(item) ? 'checked' : '';
            
            const html = `
                <div class="form-check">
                    <input class="form-check-input filter-checkbox" type="checkbox" value="${item}" id="${id}" data-category="${filterCatName}" ${isChecked}>
                    <label class="form-check-label" for="${id}">
                        ${item}
                    </label>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    };

    renderCheckboxes('filter-brands-list', availableBrands, filterState.brands, 'brands');
    renderCheckboxes('filter-fuel-list', availableFuels, filterState.fuels, 'fuels');
    renderCheckboxes('filter-colors-list', availableColors, filterState.colors, 'colors');

    // Attach listeners
    document.querySelectorAll('.filter-checkbox').forEach(chk => {
        chk.addEventListener('change', handleFilterChange);
    });
}

function handleFilterChange(e) {
    const cat = e.target.dataset.category;
    const val = e.target.value;
    
    if(e.target.checked) {
        filterState[cat].add(val);
    } else {
        filterState[cat].delete(val);
    }

    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    // Start with all matched vehicles
    let results = matchedVehicles.filter(v => {
        // If a filter set is empty, it means "don't filter by this category" (aka Show All)
        const brandMatch = filterState.brands.size === 0 || filterState.brands.has(v.BrandHeb);
        const fuelMatch = filterState.fuels.size === 0 || filterState.fuels.has(v.FuelType);
        const colorMatch = filterState.colors.size === 0 || filterState.colors.has(v.Color);

        return brandMatch && fuelMatch && colorMatch;
    });

    renderGrid(results);
}

function renderGrid(vehiclesToRender) {
    const grid = document.getElementById('resultsGrid');
    const noResults = document.getElementById('noResultsMsg');
    const countBadge = document.getElementById('resultsCountBadge');

    grid.innerHTML = '';
    countBadge.textContent = vehiclesToRender.length;

    if(vehiclesToRender.length === 0) {
        noResults.classList.remove('d-none');
        return;
    } else {
        noResults.classList.add('d-none');
    }

    vehiclesToRender.forEach(v => {
        const logoSrc = v.Logo || (typeof brandLogos !== 'undefined' ? (brandLogos[v.BrandHeb] || brandLogos[v.Brand] || 'images/brands/default.png') : 'images/brands/default.png');
        
        let plate = v.LicensePlate || '------';
        if(plate.length === 7) plate = plate.slice(0,2)+'-'+plate.slice(2,5)+'-'+plate.slice(5);
        if(plate.length === 8) plate = plate.slice(0,3)+'-'+plate.slice(3,5)+'-'+plate.slice(5);

        const card = `
        <div class="col">
            <div class="card vehicle-card shadow-sm h-100" onclick="window.location.href='public_report.html?id=${v.Id}&from=search'">
                <div class="card-body p-4 text-center">
                    
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="card-logo-box shadow-sm">
                            <img src="${logoSrc}" alt="${v.BrandHeb}">
                        </div>
                        <div class="text-start">
                            <span class="badge ${v.Status === 'פעיל' ? 'bg-success' : 'bg-secondary'} rounded-pill mb-2">${v.Status || 'פעיל'}</span>
                        </div>
                    </div>

                    <h5 class="fw-bold mb-1 text-dark">${v.BrandHeb} ${v.Model || ''}</h5>
                    <p class="text-muted small mb-3">שנת ייצור: ${v.Year || 'לא ידוע'}</p>
                    
                    <div class="mb-4">
                        <span class="license-plate-badge shadow-sm">${plate}</span>
                    </div>

                    <div class="d-flex flex-wrap justify-content-center gap-2">
                        <span class="stat-pill"><i class="fas fa-gas-pump text-muted"></i> ${v.FuelType || '-'}</span>
                        <span class="stat-pill"><i class="fas fa-palette text-muted"></i> ${v.Color || '-'}</span>
                    </div>

                </div>
            </div>
        </div>
        `;

        grid.insertAdjacentHTML('beforeend', card);
    });
}

function attachAutocomplete(inputId, listId, allVehiclesArr) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if(!input || !list) return;

    input.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!val) {
            list.classList.add('d-none');
            return;
        }

        const matches = allVehiclesArr.filter(v => {
            const plate = (v.LicensePlate || '');
            const brandHeb = (v.BrandHeb || '').toLowerCase();
            const brandEn = (v.Brand || '').toLowerCase();
            return plate.startsWith(val) || brandHeb.startsWith(val) || brandEn.startsWith(val);
        });

        if (matches.length > 0) {
            matches.slice(0, 8).forEach(v => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action fw-bold';
                li.style.cursor = 'pointer';
                li.innerHTML = `<span class="text-primary">${v.LicensePlate}</span> - <span class="text-muted fw-normal">${v.BrandHeb || ''} ${v.Model || ''}</span>`;
                li.onmousedown = () => {
                    input.value = v.LicensePlate;
                    list.classList.add('d-none');
                    window.searchVehicles();
                };
                list.appendChild(li);
            });
            list.classList.remove('d-none');
        } else {
            list.classList.add('d-none');
        }
    });

    input.addEventListener('blur', () => { setTimeout(() => list.classList.add('d-none'), 150); });
    input.addEventListener('focus', function() { if(this.value && list.innerHTML !== '') list.classList.remove('d-none'); });
}
