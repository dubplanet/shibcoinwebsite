document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
});

function initializeMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.querySelector('.main-nav');
    const body = document.body;

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';
    body.appendChild(overlay);

    if (menuToggle && mainNav) {
        // Add animation delay to menu items
        const menuItems = mainNav.querySelectorAll('li');
        menuItems.forEach((item, index) => {
            item.style.setProperty('--item-index', index);
        });

        // Toggle menu when hamburger is clicked
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
            overlay.classList.toggle('active');
            body.style.overflow = body.style.overflow === 'hidden' ? '' : 'hidden';
        });

        // Close menu when clicking overlay
        overlay.addEventListener('click', () => {
            closeMenu(menuToggle, mainNav, overlay, body);
        });

        // Close menu when clicking menu items
        const menuLinks = mainNav.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMenu(menuToggle, mainNav, overlay, body);
            });
        });

        // Close menu on resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && mainNav.classList.contains('active')) {
                closeMenu(menuToggle, mainNav, overlay, body);
            }
        });
    }
}

function closeMenu(menuToggle, mainNav, overlay, body) {
    menuToggle.classList.remove('active');
    mainNav.classList.remove('active');
    overlay.classList.remove('active');
    body.style.overflow = '';
}