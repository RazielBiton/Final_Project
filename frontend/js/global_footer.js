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