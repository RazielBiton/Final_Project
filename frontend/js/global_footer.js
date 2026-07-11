document.addEventListener("DOMContentLoaded", function () {
    const footerHtml = `
    <p class = "footer-text">Final Project - EasyCare Team<br>Raziel Biton & Michael Geyshes</p>
    <button class="footer-contact" onclick="window.location.href='contact.html'">contact us</button>`;

    // Find the global footer container on the page
    const footerContainer = document.querySelector(".global-footer");
    if (footerContainer) {
        footerContainer.innerHTML = footerHtml;
        
        // Smart Footer hiding logic for modals (Forms/Maps)
        document.addEventListener('show.bs.modal', () => {
            // Hide footer when any modal opens
            footerContainer.style.display = 'none';
        });

        document.addEventListener('hidden.bs.modal', () => {
            // Check if there are any other modals still open (e.g. parent form when map closes)
            // Bootstrap adds 'show' class to active modals. It also keeps 'modal-open' on body if modals are active.
            setTimeout(() => {
                const openModals = document.querySelectorAll('.modal.show');
                if (openModals.length === 0) {
                    footerContainer.style.display = 'flex'; // Restore default footer flex display
                    document.body.classList.remove('modal-open');
                } else {
                    document.body.classList.add('modal-open'); // Force body to stay modal-open
                }
            }, 50); // slight delay to allow Bootstrap classes to update
        });
    }
});

// Global Function to show Quick View for images or PDFs
window.showFilePreview = function (src, type = 'image') {
    const modalEl = document.getElementById('filePreviewModal');
    if (!modalEl) return;
    
    const imgPreview = document.getElementById('filePreviewImg');
    const iframePreview = document.getElementById('filePreviewIframe');

    if (type === 'pdf') {
        imgPreview.classList.add('d-none');
        iframePreview.classList.remove('d-none');
        iframePreview.src = src;
    } else {
        iframePreview.classList.add('d-none');
        imgPreview.classList.remove('d-none');
        imgPreview.src = src;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}