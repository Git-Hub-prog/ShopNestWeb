function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}

async function renderCart() {
    const user = await ensureCurrentUser();
    const container = document.getElementById("cart-items-container");
    const itemCountEl = document.getElementById("item-count");
    const subtotalEl = document.getElementById("subtotal");
    const taxEl = document.getElementById("tax-cost");
    const totalEl = document.getElementById("total-cost");
    const navCount = document.getElementById("nav-cart-count");
    const shippingEl = document.getElementById("shipping-cost");
    const checkoutBtn = document.getElementById("checkout-btn");

    if (
        !container ||
        !itemCountEl ||
        !subtotalEl ||
        !taxEl ||
        !totalEl ||
        !navCount ||
        !shippingEl ||
        !checkoutBtn
    ) {
        return;
    }

    if (!user) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-user-lock"></i>
                <h2>Please sign in to view your cart</h2>
                <p>Your cart is now stored in the database for each user account.</p>
                <a href="login.html" class="btn-shop">Sign in</a>
            </div>`;
        itemCountEl.textContent = "0";
        navCount.textContent = "0";
        subtotalEl.textContent = "₹0.00";
        taxEl.textContent = "₹0.00";
        totalEl.textContent = "₹0.00";
        shippingEl.textContent = "FREE";
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.6";
        return;
    }

    const data = await apiRequest(`/cart?userId=${user.id}`);
    const cart = data.items;
    const hasOutOfStockItems = cart.some((item) => {
        const reservedQty = Number(item.qty || 0);
        const remainingStock = Number(item.stock || 0);
        const maxAllowedQty = Number(item.maxQty ?? (remainingStock + reservedQty));
        return !item.inStock || maxAllowedQty < reservedQty;
    });

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    navCount.textContent = totalItems;
    itemCountEl.textContent = totalItems;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-shopping"></i>
                <h2>Your ShopNest cart is empty</h2>
                <p>Shop today's deals and discover something great.</p>
                <a href="index.html" class="btn-shop">Shop now</a>
            </div>`;
        subtotalEl.textContent = "₹0.00";
        taxEl.textContent = "₹0.00";
        totalEl.textContent = "₹0.00";
        shippingEl.textContent = "FREE";
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.6";
        return;
    }

    container.innerHTML = cart.map((item) => `
        <div class="cart-item" id="item-${item.cartItemId}">
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400'">
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-stock" style="color:${item.inStock && item.stock >= item.qty ? "#007600" : "#b12704"};">
                    ${item.inStock ? `In Stock (${item.stock} left)` : "Out of Stock"}
                </div>
                <div class="item-actions">
                    <select class="qty-select" data-cart-index="${item.cartItemId}" ${!item.inStock ? "disabled" : ""}>
                        ${Array.from({ length: Math.max(1, Math.min(5, Number(item.maxQty ?? ((item.stock || 0) + (item.qty || 0))) || 1)) }, (_value, index) => index + 1).map((qty) => `<option value="${qty}" ${item.qty === qty ? "selected" : ""}>Qty: ${qty}</option>`).join("")}
                    </select>
                    <span class="item-separator">|</span>
                    <button class="item-delete" data-remove-index="${item.cartItemId}" data-name="${item.name}">Delete</button>
                </div>
            </div>
            <div class="item-price">${item.price}</div>
        </div>
    `).join("");

    const subtotal = cart.reduce((sum, item) => {
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price.replace(/[$,₹]/g, ""));
        return sum + price * item.qty;
    }, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    taxEl.textContent = `₹${tax.toFixed(2)}`;
    totalEl.textContent = `₹${total.toFixed(2)}`;
    shippingEl.textContent = subtotal > 0 ? "FREE" : "₹0.00";
    checkoutBtn.disabled = hasOutOfStockItems;
    checkoutBtn.style.opacity = hasOutOfStockItems ? "0.6" : "1";
    checkoutBtn.textContent = hasOutOfStockItems ? "Resolve Out of Stock Items" : "Proceed to Checkout";

    container.querySelectorAll("[data-cart-index]").forEach((select) => {
        select.addEventListener("change", async (event) => {
            await apiRequest(`/cart/items/${event.target.dataset.cartIndex}`, {
                method: "PATCH",
                body: JSON.stringify({ quantity: Number(event.target.value) })
            });
            renderCart();
        });
    });

    container.querySelectorAll("[data-remove-index]").forEach((button) => {
        button.addEventListener("click", async () => {
            await apiRequest(`/cart/items/${button.dataset.removeIndex}`, {
                method: "DELETE"
            });
            showToast(`"${button.dataset.name.substring(0, 30)}..." removed from cart.`);
            renderCart();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-nav-target]").forEach((element) => {
        element.addEventListener("click", () => {
            if (element.dataset.navTarget) {
                window.location.href = element.dataset.navTarget;
            }
        });
    });

    initializeSessionUI().catch(() => {});

    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            window.location.href = "checkout.html";
        });
    }

    renderCart().catch(() => {
        const container = document.getElementById("cart-items-container");
        if (container) {
            container.innerHTML = "<p>Unable to load cart right now.</p>";
        }
    });
});
