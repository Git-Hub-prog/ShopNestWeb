let cachedProducts = [];
let stockRefreshTimer = null;

function formatPrice(price) {
    if (!price && price !== 0) return "₹0";
    const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[₹,]/g, "")) : Number(price);
    if (isNaN(numPrice)) return "₹0";
    return `₹${Math.round(numPrice).toLocaleString('en-IN')}`;
}

function updateCartBadge() {
    const badge = document.getElementById("cart-count");
    if (!badge) {
        return;
    }

    ensureCurrentUser()
        .then((user) => {
            if (!user) {
                badge.textContent = "0";
                return;
            }

            return apiRequest(`/cart?userId=${user.id}`)
                .then((data) => {
                    const totalQty = data.items.reduce((sum, item) => sum + item.qty, 0);
                    badge.textContent = totalQty;
                });
        })
        .catch(() => {
            badge.textContent = "0";
        });
}

function renderProducts(products) {
    cachedProducts = products;

    const grid = document.getElementById("product-grid");
    const noResults = document.getElementById("no-results");
    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (products.length === 0) {
        if (noResults) {
            noResults.style.display = "block";
        }
        return;
    }

    if (noResults) {
        noResults.style.display = "none";
    }

    products.forEach((product) => {
        const card = document.createElement("div");
        const isOutOfStock = !product.inStock;
        const stockCount = Number(product.stock || 0);
        card.className = "product-card";
        card.dataset.productId = String(product.id);
        card.dataset.title = (product.name || "").toLowerCase();
        card.dataset.feature = (product.feature || "").toLowerCase();
        card.dataset.description = (product.description || "").toLowerCase();
        card.dataset.price = String(parseFloat(String(product.price).replace(/[₹,]/g, "")) || 0);
        card.dataset.rating = String(product.ratingValue || 0);
        card.dataset.inStock = String(Boolean(product.inStock));
        card.dataset.stock = String(stockCount);
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <h3 class="product-title">${product.name}</h3>
            <div class="product-feature">${product.feature || "Popular pick"}</div>
            <p class="product-description">${product.description || "A practical everyday choice built to deliver convenience, style, and reliable performance."}</p>
            <div class="product-rating">${product.rating}</div>
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-stock" style="color:${isOutOfStock ? "#b12704" : "#007600"};margin-bottom:12px;font-size:0.9rem;font-weight:700;">
                ${isOutOfStock ? "Out of Stock" : `In Stock (${stockCount})`}
            </div>
            <button class="add-to-cart-btn"
                data-id="${product.id}"
                data-name="${product.name}"
                ${isOutOfStock ? "disabled" : ""}>${isOutOfStock ? "Unavailable" : "Add to Cart"}</button>
        `;

        const image = card.querySelector(".product-image");
        image.addEventListener("error", () => {
            image.src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop";
        }, { once: true });

        card.querySelector(".add-to-cart-btn").addEventListener("click", async (event) => {
            const button = event.currentTarget;
            if (button.disabled) {
                return;
            }
            const user = await ensureCurrentUser();
            if (!user || !Number(user.id)) {
                window.alert("Please sign in first to add items to your cart.");
                window.location.href = "login.html";
                return;
            }

            try {
                await apiRequest("/cart/items", {
                    method: "POST",
                    body: JSON.stringify({
                        userId: user.id,
                        productId: Number(button.dataset.id),
                        quantity: 1
                    })
                });

                const nextStock = Math.max(0, Number(card.dataset.stock || 0) - 1);
                card.dataset.stock = String(nextStock);
                card.dataset.inStock = String(nextStock > 0);

                const stockEl = card.querySelector(".product-stock");
                if (stockEl) {
                    stockEl.style.color = nextStock > 0 ? "#007600" : "#b12704";
                    stockEl.textContent = nextStock > 0 ? `In Stock (${nextStock})` : "Out of Stock";
                }

                button.textContent = "Added!";
                button.style.backgroundColor = "#f0c14b";
                updateCartBadge();

                setTimeout(() => {
                    if (Number(card.dataset.stock || 0) > 0) {
                        button.textContent = "Add to Cart";
                        button.style.backgroundColor = "#ffd814";
                        button.disabled = false;
                    } else {
                        button.textContent = "Unavailable";
                        button.style.backgroundColor = "#e0e0e0";
                        button.disabled = true;
                    }
                }, 1500);

                // Re-sync with backend so stock remains accurate across tabs/users.
                refreshVisibleProductStock().catch(() => {});
            } catch (error) {
                if ((error?.message || "").toLowerCase().includes("user or product not found")) {
                    clearCurrentUser();
                    window.alert("Your session expired. Please sign in again.");
                    window.location.href = "login.html";
                    return;
                }
                window.alert(error.message);
            }
        });

        grid.appendChild(card);
    });
}

function updateCardStockFromServer(card, product) {
    if (!card || !product) {
        return;
    }

    const nextStock = Number(product.stock || 0);
    const inStock = Boolean(product.inStock);
    const stockEl = card.querySelector(".product-stock");
    const button = card.querySelector(".add-to-cart-btn");

    card.dataset.stock = String(nextStock);
    card.dataset.inStock = String(inStock);

    if (stockEl) {
        stockEl.style.color = inStock ? "#007600" : "#b12704";
        stockEl.textContent = inStock ? `In Stock (${nextStock})` : "Out of Stock";
    }

    if (button) {
        button.disabled = !inStock;
        if (inStock) {
            if (button.textContent !== "Added!") {
                button.textContent = "Add to Cart";
                button.style.backgroundColor = "#ffd814";
            }
        } else {
            button.textContent = "Unavailable";
            button.style.backgroundColor = "#e0e0e0";
        }
    }
}

async function refreshVisibleProductStock() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get("category") || "";
    const searchQuery = (urlParams.get("search") || "").trim();
    const query = new URLSearchParams();

    if (categoryId) {
        query.set("category", categoryId);
    }
    if (searchQuery) {
        query.set("search", searchQuery);
    }

    const data = await apiRequest(`/products${query.toString() ? `?${query.toString()}` : ""}`);
    const latestProducts = Array.isArray(data?.products) ? data.products : [];
    const byId = new Map(latestProducts.map((item) => [String(item.id), item]));

    cachedProducts = latestProducts;

    document.querySelectorAll(".product-card[data-product-id]").forEach((card) => {
        const product = byId.get(card.dataset.productId || "");
        if (product) {
            updateCardStockFromServer(card, product);
        }
    });
}

function startStockAutoRefresh() {
    if (stockRefreshTimer) {
        clearInterval(stockRefreshTimer);
    }

    stockRefreshTimer = setInterval(() => {
        refreshVisibleProductStock().catch(() => {});
    }, 10000);
}

async function loadProducts() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get("category") || "";
    const searchQuery = (urlParams.get("search") || "").trim();
    const titleEl = document.getElementById("category-title");
    const bannerEl = document.getElementById("search-results-banner");
    const liveInput = document.getElementById("live-filter");

    const categoryNames = {
        "health": "Health & Personal Care",
        "home": "Home Essentials",
        "gaming": "Gaming",
        "fashion": "Fashion Deals",
        "decor": "Room Decor",
        "kitchen": "Kitchen Appliances",
        "home-arrivals": "New Home Arrivals",
        "fitness": "Fitness & Sports"
    };

    const query = new URLSearchParams();
    if (categoryId) {
        query.set("category", categoryId);
    }
    if (searchQuery) {
        query.set("search", searchQuery);
    }

    const data = await apiRequest(`/products${query.toString() ? `?${query.toString()}` : ""}`);

    if (searchQuery) {
        if (titleEl) {
            titleEl.innerText = `Search Results for "${searchQuery}"`;
        }

        document.title = `ShopNest - Search: ${searchQuery}`;

        if (bannerEl) {
            bannerEl.style.display = "block";
            const scope = categoryId
                ? ` in <em>${categoryNames[categoryId] || categoryId}</em>`
                : " across all categories";
            bannerEl.innerHTML = `
                <strong>${data.products.length}</strong> result${data.products.length !== 1 ? "s" : ""}
                for <strong>"${searchQuery}"</strong>${scope}
                <span class="clear-search">Clear search</span>
            `;
            const clearSearch = bannerEl.querySelector(".clear-search");
            clearSearch.addEventListener("click", () => {
                window.location.href = "products.html";
            });
        }

        if (liveInput) {
            liveInput.value = searchQuery;
        }
    } else {
        const hasCategory = Boolean(categoryId);
        if (titleEl) {
            titleEl.innerText = hasCategory
                ? `${categoryNames[categoryId] || "Products"} - Results`
                : "All Products";
        }

        document.title = hasCategory
            ? `ShopNest - ${categoryNames[categoryId] || "Products"}`
            : "ShopNest - All Products";

        if (bannerEl) {
            bannerEl.style.display = "none";
        }
    }

    renderProducts(data.products);
}

document.addEventListener("DOMContentLoaded", async () => {
    updateCartBadge();
    try {
        await loadProducts();
        startStockAutoRefresh();
    } catch (error) {
        const grid = document.getElementById("product-grid");
        if (grid) {
            grid.innerHTML = `<p>Unable to load products right now.</p>`;
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            refreshVisibleProductStock().catch(() => {});
        }
    });

    window.addEventListener("beforeunload", () => {
        if (stockRefreshTimer) {
            clearInterval(stockRefreshTimer);
        }
    });
});
