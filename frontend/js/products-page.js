document.addEventListener("DOMContentLoaded", async () => {
    const backToTop = document.getElementById("back-to-top");
    const navSearchInput = document.getElementById("search-input");
    const navSearchBtn = document.getElementById("search-btn");
    const navSearchCat = document.getElementById("search-category");
    const liveFilter = document.getElementById("live-filter");
    const stockFilter = document.getElementById("stock-filter");
    const sortFilter = document.getElementById("sort-filter");
    const priceFilter = document.getElementById("price-filter");
    const resetFiltersBtn = document.getElementById("reset-filters-btn");
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

    function applyFilters() {
        if (!productGrid || !noResults) {
            return;
        }

        const term = liveFilter?.value.trim().toLowerCase() || "";
        const stockValue = stockFilter?.value || "all";
        const sortValue = sortFilter?.value || "featured";
        const priceValue = priceFilter?.value || "all";
        const cards = Array.from(productGrid.querySelectorAll(".product-card"));

        const matchesPrice = (price) => {
            if (priceValue === "all") {
                return true;
            }
            if (priceValue === "0-25") {
                return price < 2000;
            }
            if (priceValue === "25-50") {
                return price >= 2000 && price <= 4000;
            }
            if (priceValue === "50-100") {
                return price > 4000 && price <= 8000;
            }
            if (priceValue === "100-plus") {
                return price > 8000;
            }
            return true;
        };

        cards.forEach((card) => {
            const haystack = [
                card.dataset.title || "",
                card.dataset.feature || "",
                card.dataset.description || ""
            ].join(" ");
            const inStock = card.dataset.inStock === "true";
            const price = Number(card.dataset.price || 0);

            const matchesText = !term || haystack.includes(term);
            const matchesStock = stockValue === "all"
                || (stockValue === "in-stock" && inStock)
                || (stockValue === "out-of-stock" && !inStock);
            const show = matchesText && matchesStock && matchesPrice(price);
            card.style.display = show ? "" : "none";
        });

        const visibleCards = cards.filter((card) => card.style.display !== "none");

        visibleCards.sort((a, b) => {
            if (sortValue === "price-low") {
                return Number(a.dataset.price || 0) - Number(b.dataset.price || 0);
            }
            if (sortValue === "price-high") {
                return Number(b.dataset.price || 0) - Number(a.dataset.price || 0);
            }
            if (sortValue === "rating-high") {
                return Number(b.dataset.rating || 0) - Number(a.dataset.rating || 0);
            }
            if (sortValue === "name-az") {
                return (a.dataset.title || "").localeCompare(b.dataset.title || "");
            }
            return 0;
        });

        visibleCards.forEach((card) => {
            productGrid.appendChild(card);
        });

        noResults.style.display = visibleCards.length === 0 ? "block" : "none";
    }

    if (liveFilter) {
        liveFilter.addEventListener("input", applyFilters);
    }

    if (stockFilter) {
        stockFilter.addEventListener("change", applyFilters);
    }

    if (sortFilter) {
        sortFilter.addEventListener("change", applyFilters);
    }

    if (priceFilter) {
        priceFilter.addEventListener("change", applyFilters);
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
            if (liveFilter) {
                liveFilter.value = "";
            }
            if (stockFilter) {
                stockFilter.value = "all";
            }
            if (sortFilter) {
                sortFilter.value = "featured";
            }
            if (priceFilter) {
                priceFilter.value = "all";
            }
            applyFilters();
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

    applyFilters();
});
