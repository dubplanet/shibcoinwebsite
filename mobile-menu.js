document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.querySelector('.main-nav');
    const body = document.body;

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';
    body.appendChild(overlay);

    if (menuToggle && mainNav) {
        // Toggle menu when hamburger is clicked
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('open'); // Toggle the 'open' class for animation
            mainNav.classList.toggle('active'); // Toggle the 'active' class
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
    }

    function closeMenu(menuToggle, mainNav, overlay, body) {
        menuToggle.classList.remove('open'); // Remove the 'open' class for animation
        menuToggle.classList.remove('active');
        mainNav.classList.remove('active');
        overlay.classList.remove('active');
        body.style.overflow = '';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.querySelector('.main-nav');

    menuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('active'); // Toggle the 'active' class
        menuToggle.classList.toggle('open'); // Toggle the 'open' class for animation
    });
});