let cachedProducts = [];

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
        card.className = "product-card";
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <h3 class="product-title">${product.name}</h3>
            <div class="product-rating">${product.rating}</div>
            <div class="product-price">${product.price}</div>
            <button class="add-to-cart-btn"
                data-id="${product.id}"
                data-name="${product.name}">Add to Cart</button>
        `;

        const image = card.querySelector(".product-image");
        image.addEventListener("error", () => {
            image.src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop";
        }, { once: true });

        card.querySelector(".add-to-cart-btn").addEventListener("click", async (event) => {
            const button = event.currentTarget;
            const user = await ensureCurrentUser();
            if (!user) {
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

                button.textContent = "Added!";
                button.style.backgroundColor = "#f0c14b";
                updateCartBadge();
                setTimeout(() => {
                    button.textContent = "Add to Cart";
                    button.style.backgroundColor = "#ffd814";
                }, 1500);
            } catch (error) {
                window.alert(error.message);
            }
        });

        grid.appendChild(card);
    });
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

        document.title = `Amazon - Search: ${searchQuery}`;

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
        const id = categoryId || "health";
        if (titleEl) {
            titleEl.innerText = `${categoryNames[id] || "Products"} - Results`;
        }
        document.title = `Amazon - ${categoryNames[id] || "Products"}`;
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
    } catch (error) {
        const grid = document.getElementById("product-grid");
        if (grid) {
            grid.innerHTML = `<p>Unable to load products right now.</p>`;
        }
    }
});
