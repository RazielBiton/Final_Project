// ============================================
// GLOBAL FORM AUTOSAVE DRAFT FEATURE (EASYCARE)
// Saves input field state automatically per page
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const ignoreTypes = ['password', 'file', 'submit', 'button', 'hidden'];
        
        // Restore drafted values across all pages
        document.querySelectorAll('input, select, textarea').forEach(field => {
            if (!field.id || ignoreTypes.includes(field.type)) return;
            const context = window.location.search + window.location.hash;
            const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
            const draftedValue = localStorage.getItem(draftKey);
            if (draftedValue !== null) {
                if (field.type === 'checkbox' || field.type === 'radio') field.checked = (draftedValue === 'true');
                else field.value = draftedValue;
                
                // Dispatch event to trigger visual changes (like switches revealing blocks)
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Listen dynamically for typing/clicking and save
        document.body.addEventListener('input', (e) => {
            const field = e.target;
            if (!field.id || ignoreTypes.includes(field.type)) return;
            const context = window.location.search + window.location.hash;
            const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
            const val = (field.type === 'checkbox' || field.type === 'radio') ? field.checked : field.value;
            localStorage.setItem(draftKey, val);
        });

        // Clear drafts natively when a form is successfully submitted/saved
        document.body.addEventListener('submit', (e) => {
            const formInputs = e.target.querySelectorAll('input, select, textarea');
            formInputs.forEach(field => {
                if (!field.id) return;
                const context = window.location.search + window.location.hash;
                const draftKey = `Draft_${window.location.pathname}_${context}_${field.id}`;
                localStorage.removeItem(draftKey);
            });
        });

        // Clear drafts on dynamic save buttons
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.db-btn-primary') || e.target.closest('[onclick*="save"]')) {
                const modalOrForm = e.target.closest('.modal') || e.target.closest('form');
                if (!modalOrForm) return;
                modalOrForm.querySelectorAll('input, select, textarea').forEach(field => {
                    if (field.id) {
                        const context = window.location.search + window.location.hash;
                        localStorage.removeItem(`Draft_${window.location.pathname}_${context}_${field.id}`);
                    }
                });
            }
        });
        
    }, 1500); // 1.5s delay to allow dynamic SPA content to load
});
