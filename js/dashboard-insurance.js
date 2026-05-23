// --- MODULE: INSURANCE & OTHERS ---
const insTypeNames = {
    'mandatory': 'ביטוח חובה',
    'comprehensive': 'ביטוח מקיף',
    'thirdparty': 'ביטוח צד ג\''
};

window.loadInsurance = function () {
    const types = ['mandatory', 'comprehensive', 'thirdparty'];
    let totalCost = 0;

    types.forEach(type => {
        const insData = currentCar.insurance[type];

        const cardEl = document.getElementById(`card-ins-${type}`);
        const statusBadge = document.getElementById(`status-${type}`);
        const companyEl = document.getElementById(`company-${type}`);
        const policyEl = document.getElementById(`policy-${type}`);
        const costEl = document.getElementById(`cost-${type}`);
        const headerCostEl = document.getElementById(`hdr-cost-${type}`);
        const dateEl = document.getElementById(`date-${type}`);
        const viewBtn = document.getElementById(`view-${type}`);

        if (insData && insData.date) {
            const currentCost = insData.cost ? parseInt(insData.cost) : 0;
            totalCost += currentCost;
            
            companyEl.textContent = insData.company || '--';
            policyEl.textContent = insData.policyNum || '--';
            costEl.textContent = currentCost.toLocaleString() + ' ₪';
            if (headerCostEl) headerCostEl.textContent = currentCost.toLocaleString() + ' ₪';
            dateEl.textContent = window.formatDate(insData.date);

            let isFuture = typeof isDateFuture === 'function' && isDateFuture(insData.date);
            let hasFile = !!insData.file;
            
            if (isFuture) {
                if (hasFile) {
                    statusBadge.textContent = 'פעיל ומעודכן';
                    statusBadge.style.cssText = 'position:absolute; top:1.2rem; left:1.2rem; padding:6px 10px; border-radius:8px; font-weight:700; background:#d1fae5; color:#065f46;';
                    cardEl.style.backgroundColor = '#f0fdf4';
                    cardEl.style.borderColor = '#bbf7d0';
                } else {
                    statusBadge.textContent = 'חסר מסמך';
                    statusBadge.style.cssText = 'position:absolute; top:1.2rem; left:1.2rem; padding:6px 10px; border-radius:8px; font-weight:700; background:#fee2e2; color:#991b1b;';
                    cardEl.style.backgroundColor = '#fff1f2';
                    cardEl.style.borderColor = '#fecaca';
                }
            } else {
                statusBadge.textContent = 'פג תוקף';
                statusBadge.style.cssText = 'position:absolute; top:1.2rem; left:1.2rem; padding:6px 10px; border-radius:8px; font-weight:700; background:#fef3c7; color:#92400e;';
                cardEl.style.backgroundColor = '#f8fafc';
                cardEl.style.borderColor = '#e2e8f0';
            }

            if (insData.file) {
                viewBtn.classList.remove('d-none');
            } else {
                viewBtn.classList.add('d-none');
            }

            // Build Extra Information HTML dynamically
            let extraHtml = '';
            
            // 1. Roadside
            if (insData.towing || insData.replacement || insData.glass) {
                extraHtml += `<div style="margin-bottom:10px;"><strong style="color:#1e293b; font-size:0.85rem;"><i class="fas fa-truck-pickup text-primary me-1"></i> שירותי דרך וסיוע:</strong></div>`;
                if (insData.towing) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:4px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">גרירה:</strong> ${insData.towing}</div>`;
                if (insData.replacement) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:4px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">חלופי:</strong> ${insData.replacement}</div>`;
                if (insData.glass) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:10px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">שמשות:</strong> ${insData.glass}</div>`;
            }
            
            // 2. Agent
            if (insData.agentName || insData.agentPhone) {
                extraHtml += `<div style="margin-bottom:10px;"><strong style="color:#1e293b; font-size:0.85rem;"><i class="fas fa-user-tie text-success me-1"></i> איש קשר:</strong></div>`;
                if (insData.agentName) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:4px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">סוכן/מוקד:</strong> ${insData.agentName}</div>`;
                if (insData.agentPhone) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:10px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">טלפון:</strong> <a href="tel:${insData.agentPhone}" style="color:#3b82f6; text-decoration:none;">${insData.agentPhone}</a></div>`;
            }

            // 3. Limitations
            if (insData.driverLimit || insData.deductible || insData.protection) {
                extraHtml += `<div style="margin-bottom:10px;"><strong style="color:#1e293b; font-size:0.85rem;"><i class="fas fa-exclamation-triangle text-warning me-1"></i> תנאים והגבלות:</strong></div>`;
                if (insData.driverLimit) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:4px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">נהגים:</strong> ${insData.driverLimit}</div>`;
                if (insData.deductible) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:4px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">השתתפות עצמית:</strong> ${insData.deductible}</div>`;
                if (insData.protection) extraHtml += `<div style="font-size:0.85rem; color:#475569; margin-bottom:10px; padding-right:15px; border-right:2px solid #e2e8f0;"><strong style="color:#334155;">מיגון:</strong> ${insData.protection}</div>`;
            }

            const extraBtn = document.getElementById(`extra-btn-${type}`);
            const extraInfo = document.getElementById(`extra-info-${type}`);
            if (extraHtml) {
                extraBtn.classList.remove('d-none');
                extraInfo.innerHTML = extraHtml;
                extraInfo.classList.add('d-none'); // start collapsed
            } else {
                extraBtn.classList.add('d-none');
                extraInfo.classList.add('d-none');
            }

        } else {
            companyEl.textContent = '--';
            policyEl.textContent = '--';
            costEl.textContent = '--';
            if (headerCostEl) headerCostEl.textContent = '0 ₪';
            dateEl.textContent = '--';
            
            statusBadge.textContent = 'לא קיים';
            statusBadge.style.cssText = 'position:absolute; top:1.2rem; left:1.2rem; padding:6px 10px; border-radius:8px; font-weight:700; background:#f1f5f9; color:#475569;';
            cardEl.style.backgroundColor = '#f8fafc';
            cardEl.style.borderColor = '#e2e8f0';
            
            viewBtn.classList.add('d-none');
        }
    });

    const totalCostEl = document.getElementById('hdr-cost-total');
    if (totalCostEl) totalCostEl.textContent = totalCost.toLocaleString() + ' ₪';
}

window.openEditInsurance = function (type) {
    document.getElementById('insType').value = type;
    document.getElementById('editInsuranceModalTitle').textContent = 'עריכת ' + insTypeNames[type];

    const insData = currentCar.insurance[type] || {};
    document.getElementById('insCompany').value = insData.company || '';
    document.getElementById('insPolicyNum').value = insData.policyNum || '';
    document.getElementById('insCost').value = insData.cost || '';
    document.getElementById('insDate').value = window.toInputDate(insData.date);

    document.getElementById('insDoc').value = '';

    const docInfo = document.getElementById('currentDocInfo');
    if (insData.file) {
        docInfo.classList.remove('d-none');
    } else {
        docInfo.classList.add('d-none');
    }

    // Advanced fields Optional Block 1 (Roadside)
    document.getElementById('insTowing').value = insData.towing || '';
    document.getElementById('insReplacement').value = insData.replacement || '';
    document.getElementById('insGlass').value = insData.glass || '';
    const hasRoad = (insData.towing || insData.replacement || insData.glass);
    document.getElementById('toggleRoadside').checked = !!hasRoad;
    document.getElementById('roadside-fields').classList.toggle('d-none', !hasRoad);

    // Advanced fields Optional Block 2 (Agent)
    document.getElementById('insAgentName').value = insData.agentName || '';
    document.getElementById('insAgentPhone').value = insData.agentPhone || '';
    const hasAgent = (insData.agentName || insData.agentPhone);
    document.getElementById('toggleAgent').checked = !!hasAgent;
    document.getElementById('agent-fields').classList.toggle('d-none', !hasAgent);

    // Advanced fields Optional Block 3 (Limitations)
    document.getElementById('insDriverLimit').value = insData.driverLimit || '';
    document.getElementById('insDeductible').value = insData.deductible || '';
    document.getElementById('insProtection').value = insData.protection || '';
    const hasLimit = (insData.driverLimit || insData.deductible || insData.protection);
    document.getElementById('toggleLimitations').checked = !!hasLimit;
    document.getElementById('limitation-fields').classList.toggle('d-none', !hasLimit);

    // UI Logic: Show/Hide relevant extensions based on Israel insurance rules
    const roadsideCard = document.getElementById('ext-card-roadside');
    const agentCard = document.getElementById('ext-card-agent');
    const limitCard = document.getElementById('ext-card-limit');
    const wrapReplacement = document.getElementById('wrap-replacement');
    const wrapProtection = document.getElementById('wrap-protection');

    // Reset default visible
    roadsideCard.classList.remove('d-none');
    agentCard.classList.remove('d-none');
    limitCard.classList.remove('d-none');
    wrapReplacement.classList.remove('d-none');
    wrapProtection.classList.remove('d-none');

    if (type === 'mandatory') {
        // ביטוח חובה: רק מוקד ואנשי קשר רלוונטי
        roadsideCard.classList.add('d-none');
        limitCard.classList.add('d-none');
    } else if (type === 'thirdparty') {
        // ביטוח צד ג': ללא רכב חלופי, ללא מיגון חובה (רלוונטי למקיף)
        wrapReplacement.classList.add('d-none');
        wrapProtection.classList.add('d-none');
    } else if (type === 'comprehensive') {
        // ביטוח מקיף: הכל מופיע. אין צורך להסתיר דבר.
    }

    new bootstrap.Modal(document.getElementById('editInsuranceModal')).show();
}

window.saveInsurance = function () {
    const type = document.getElementById('insType').value;
    const company = document.getElementById('insCompany').value;
    const policyNum = document.getElementById('insPolicyNum').value;
    const cost = document.getElementById('insCost').value;
    const dateInput = document.getElementById('insDate').value;
    const file = document.getElementById('insDoc').files[0];

    if (!dateInput) {
        alert('יש להזין תוקף ביטוח');
        return;
    }

    const finishSave = (base64Doc) => {
        if (!currentCar.insurance[type]) {
            currentCar.insurance[type] = {};
        }

        currentCar.insurance[type].company = company;
        currentCar.insurance[type].policyNum = policyNum;
        currentCar.insurance[type].cost = cost ? parseInt(cost) : 0;

        const dateParts = dateInput.split('-');
        if (dateParts.length === 3) {
            currentCar.insurance[type].date = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        } else {
            currentCar.insurance[type].date = dateInput;
        }
        
        // Save Optionals 1
        if (document.getElementById('toggleRoadside').checked) {
            currentCar.insurance[type].towing = document.getElementById('insTowing').value;
            currentCar.insurance[type].replacement = document.getElementById('insReplacement').value;
            currentCar.insurance[type].glass = document.getElementById('insGlass').value;
        } else {
            currentCar.insurance[type].towing = '';
            currentCar.insurance[type].replacement = '';
            currentCar.insurance[type].glass = '';
        }
        
        // Save Optionals 2
        if (document.getElementById('toggleAgent').checked) {
            currentCar.insurance[type].agentName = document.getElementById('insAgentName').value;
            currentCar.insurance[type].agentPhone = document.getElementById('insAgentPhone').value;
        } else {
            currentCar.insurance[type].agentName = '';
            currentCar.insurance[type].agentPhone = '';
        }
        
        // Save Optionals 3
        if (document.getElementById('toggleLimitations').checked) {
            currentCar.insurance[type].driverLimit = document.getElementById('insDriverLimit').value;
            currentCar.insurance[type].deductible = document.getElementById('insDeductible').value;
            currentCar.insurance[type].protection = document.getElementById('insProtection').value;
        } else {
            currentCar.insurance[type].driverLimit = '';
            currentCar.insurance[type].deductible = '';
            currentCar.insurance[type].protection = '';
        }

        if (base64Doc) {
            currentCar.insurance[type].file = base64Doc;
        }

        try {
            window.saveToLocalStorage();
        } catch (err) {
            console.error("Storage Error on Insurance File:", err);
            // Revert just the file so the other data can save
            delete currentCar.insurance[type].file;
            alert('המסמך שצירפת שוקל יותר מדי וחורג מגבלות הזיכרון (2MB). הביטוח נשמר ללא תמונה.');
            window.saveToLocalStorage(); // Try saving again without the large file
        }

        window.loadInsurance();
        if (typeof window.loadOverview === 'function') window.loadOverview();
        if (typeof window.loadExpenses === 'function') window.loadExpenses();

        bootstrap.Modal.getInstance(document.getElementById('editInsuranceModal')).hide();
        document.getElementById('editInsuranceForm').reset();
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            finishSave(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        finishSave(null);
    }
}

window.deleteInsuranceType = function (type) {
    if (confirm('האם אתה בטוח שברצונך למחוק ביטוח זה לחלוטין ולסלק את הנתונים שלו?')) {
        if (currentCar.insurance[type]) {
            delete currentCar.insurance[type];
            window.saveToLocalStorage();
            window.loadInsurance();
            if (typeof window.loadOverview === 'function') window.loadOverview();
            if (typeof window.loadExpenses === 'function') window.loadExpenses();
        }
    }
}

window.processAiDoc = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    document.getElementById('aiLoading').classList.remove('d-none');
    
    const reader = new FileReader();
    reader.onload = async function (e) {
        let base64String = e.target.result;
        // Strip data:url prefix
        base64String = base64String.split(',')[1];
        
        try {
            const res = await fetch('/api/ai/parse-insurance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mimeType: file.type, 
                    base64Data: base64String,
                    insuranceType: document.getElementById('insType').value || 'general'
                })
            });
            const result = await res.json();
            
            if (result.success && result.data) {
                const d = result.data;
                if (d.company) document.getElementById('insCompany').value = d.company;
                if (d.policyNum) document.getElementById('insPolicyNum').value = d.policyNum;
                if (d.cost) {
                    // Normalize: remove currency symbols and thousands separators, but keep the decimal point
                    let costVal = String(d.cost).replace(/[^\d.]/g, '');
                    document.getElementById('insCost').value = costVal;
                }
                if (d.date) {
                    // AI returns DD/MM/YYYY — convert to YYYY-MM-DD for input type=date
                    let dateVal = d.date;
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateVal)) {
                        const parts = dateVal.split('/');
                        dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    document.getElementById('insDate').value = dateVal;
                }
                
                // Block 1
                if (d.towing || d.replacement || d.glass) {
                    document.getElementById('toggleRoadside').checked = true;
                    document.getElementById('roadside-fields').classList.remove('d-none');
                    if (d.towing) document.getElementById('insTowing').value = d.towing;
                    if (d.replacement) document.getElementById('insReplacement').value = d.replacement;
                    if (d.glass) document.getElementById('insGlass').value = d.glass;
                }
                
                // Block 2
                if (d.agentName || d.agentPhone) {
                    document.getElementById('toggleAgent').checked = true;
                    document.getElementById('agent-fields').classList.remove('d-none');
                    if (d.agentName) document.getElementById('insAgentName').value = d.agentName;
                    if (d.agentPhone) document.getElementById('insAgentPhone').value = d.agentPhone;
                }
                
                // Block 3
                if (d.driverLimit || d.deductible || d.protection) {
                    document.getElementById('toggleLimitations').checked = true;
                    document.getElementById('limitation-fields').classList.remove('d-none');
                    if (d.driverLimit) document.getElementById('insDriverLimit').value = d.driverLimit;
                    if (d.deductible) document.getElementById('insDeductible').value = d.deductible;
                    if (d.protection) document.getElementById('insProtection').value = d.protection;
                }
                
                // Set the uploaded file into the actual form input
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    document.getElementById('insDoc').files = dt.files;
                } catch(e) { console.warn("Failed to set file automatically", e); }

                alert('הנתונים חולצו בהצלחה באמצעות AI! הוספנו בנוסף את הקובץ אוטומטית. לחץ שמירה מתי שתרצה.');
            } else {
                alert('קרתה שגיאה בפענוח המסמך:\n' + (result.details || result.error || 'אנא נסה להזין ידנית.'));
            }
        } catch (err) {
             console.error('Error in ai parsing', err);
             alert('שגיאת תקשורת מול שרת ה-AI. אנא נסה שנית.');
        } finally {
            document.getElementById('aiLoading').classList.add('d-none');
            input.value = ''; // reset so can re-upload
        }
    };
    reader.readAsDataURL(file);
}

window.viewInsuranceDoc = function (type) {
    const insData = currentCar.insurance[type];
    if (insData && insData.file) {
        document.getElementById('insuranceDocPreview').src = insData.file;
        new bootstrap.Modal(document.getElementById('insuranceDocModal')).show();
    }
}

window.viewCurrentInsuranceDoc = function () {
    const type = document.getElementById('insType').value;
    window.viewInsuranceDoc(type);
}

window.removeInsuranceDoc = function () {
    const type = document.getElementById('insType').value;
    if (confirm('האם להסיר את המסמך הקיים? השינוי יישמר רק לאחר שתלחץ על "שמור שינויים".')) {
        if (currentCar.insurance[type]) {
            delete currentCar.insurance[type].file;
            document.getElementById('currentDocInfo').classList.add('d-none');
            alert('המסמך הוסר. אל תשכח לשמור את השינויים.');
        }
    }
}
