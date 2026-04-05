document.addEventListener("DOMContentLoaded", async () => {
    const backToTop = document.getElementById("back-to-top");
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const searchCat = document.getElementById("search-category");
    const cartBadge = document.getElementById("cart-count");

    function navigateTo(url) {
        window.location.href = url;
    }

    function doSearch() {
        if (!searchInput || !searchCat) {
            return;
        }

        const query = searchInput.value.trim();
        const cat = searchCat.value;

        if (!query) {
            searchInput.focus();
            searchInput.classList.add("shake");
            setTimeout(() => searchInput.classList.remove("shake"), 500);
            return;
        }

        let url = `products.html?search=${encodeURIComponent(query)}`;
        if (cat && cat !== "all") {
            url += `&category=${cat}`;
        }
        navigateTo(url);
    }

    document.querySelectorAll("[data-nav-target]").forEach((element) => {
        element.addEventListener("click", () => {
            if (element.dataset.navTarget) {
                navigateTo(element.dataset.navTarget);
            }
        });
    });

    await initializeSessionUI();

    if (backToTop) {
        backToTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", doSearch);
    }

    if (searchInput) {
        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                doSearch();
            }
        });
    }

    document.querySelectorAll(".box").forEach((box) => {
        box.addEventListener("mouseenter", () => {
            box.style.transform = "translateY(-5px)";
            box.style.boxShadow = "0 5px 15px rgba(0,0,0,0.1)";
        });

        box.addEventListener("mouseleave", () => {
            box.style.transform = "translateY(0)";
            box.style.boxShadow = "";
        });
    });

    if (cartBadge) {
        const user = await ensureCurrentUser();
        if (!user) {
            cartBadge.textContent = "0";
        } else {
            try {
                const data = await apiRequest(`/cart?userId=${user.id}`);
                const totalQty = data.items.reduce((sum, item) => sum + item.qty, 0);
                cartBadge.textContent = totalQty;
            } catch (_error) {
                cartBadge.textContent = "0";
            }
        }
    }
});
