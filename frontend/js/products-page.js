document.addEventListener("DOMContentLoaded", async () => {
    const backToTop = document.getElementById("back-to-top");
    const navSearchInput = document.getElementById("search-input");
    const navSearchBtn = document.getElementById("search-btn");
    const navSearchCat = document.getElementById("search-category");
    const liveFilter = document.getElementById("live-filter");
    const productGrid = document.getElementById("product-grid");
    const noResults = document.getElementById("no-results");

    document.querySelectorAll("[data-nav-target]").forEach((element) => {
        element.addEventListener("click", () => {
            if (element.dataset.navTarget) {
                window.location.href = element.dataset.navTarget;
            }
        });
    });

    await initializeSessionUI();

    function navDoSearch() {
        if (!navSearchInput || !navSearchCat) {
            return;
        }

        const query = navSearchInput.value.trim();
        const cat = navSearchCat.value;

        if (!query) {
            navSearchInput.focus();
            navSearchInput.classList.add("shake");
            setTimeout(() => navSearchInput.classList.remove("shake"), 500);
            return;
        }

        let url = `products.html?search=${encodeURIComponent(query)}`;
        if (cat && cat !== "all") {
            url += `&category=${cat}`;
        }
        window.location.href = url;
    }

    if (backToTop) {
        backToTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    if (navSearchBtn) {
        navSearchBtn.addEventListener("click", navDoSearch);
    }

    if (navSearchInput) {
        navSearchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                navDoSearch();
            }
        });
    }

    if (liveFilter) {
        liveFilter.addEventListener("input", () => {
            if (!productGrid || !noResults) {
                return;
            }

            const term = liveFilter.value.trim().toLowerCase();
            const cards = productGrid.querySelectorAll(".product-card");
            let visible = 0;

            cards.forEach((card) => {
                const title = card.querySelector(".product-title")?.textContent.toLowerCase() || "";
                const show = !term || title.includes(term);
                card.style.display = show ? "" : "none";
                if (show) {
                    visible += 1;
                }
            });

            noResults.style.display = visible === 0 ? "block" : "none";
        });
    }

    const params = new URLSearchParams(window.location.search);
    const query = params.get("search");
    const category = params.get("category");

    if (query && navSearchInput) {
        navSearchInput.value = query;
    }

    if (category) {
        document.querySelectorAll("#category-list li").forEach((item) => {
            if (item.dataset.cat === category) {
                item.classList.add("active-cat");
            }
        });

        if (navSearchCat) {
            navSearchCat.value = category;
        }
    }
});
