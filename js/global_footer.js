document.addEventListener("DOMContentLoaded", function () {
    const footerHtml = `
        <p class = "footer-text">Final Project - EasyCare Team for Yizrael Valley College 2026 - Raziel Biton & Michael</p>
        <button class="footer-contact" onclick="window.location.href='contact.html'">contact us</button>
    `;

    // Find the global footer container on the page
    const footerContainer = document.querySelector(".global-footer");

    if (footerContainer) {
        footerContainer.innerHTML = footerHtml;
    }
});
