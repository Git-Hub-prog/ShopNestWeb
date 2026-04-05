// Amazon Portfolio Script

document.addEventListener('DOMContentLoaded', () => {
    // Back to top functionality
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Search bar focus effects (enhancing the CSS focus-within)
    const searchInput = document.querySelector('.search-input');
    const searchBar = document.querySelector('.nav-search');

    if (searchInput && searchBar) {
        searchInput.addEventListener('focus', () => {
            searchBar.style.boxShadow = '0 0 0 3px #f3a847';
        });

        searchInput.addEventListener('blur', () => {
            searchBar.style.boxShadow = 'none';
        });
    }

    // Add subtle hover sound or effect to boxes (demonstrating JS capability)
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => {
        box.addEventListener('mouseenter', () => {
            box.style.transform = 'translateY(-5px)';
            box.style.transition = 'transform 0.3s ease';
            box.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
        });

        box.addEventListener('mouseleave', () => {
            box.style.transform = 'translateY(0)';
            box.style.boxShadow = 'none';
        });
    });

    console.log("Amazon Portfolio Enhanced: Navbar and interactive features initialized.");
});
