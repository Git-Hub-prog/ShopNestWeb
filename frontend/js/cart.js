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
        subtotalEl.textContent = "$0.00";
        taxEl.textContent = "$0.00";
        totalEl.textContent = "$0.00";
        shippingEl.textContent = "FREE";
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.6";
        return;
    }

    const data = await apiRequest(`/cart?userId=${user.id}`);
    const cart = data.items;

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    navCount.textContent = totalItems;
    itemCountEl.textContent = totalItems;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-shopping"></i>
                <h2>Your Amazon Cart is empty</h2>
                <p>Shop today's deals and discover something great.</p>
                <a href="index.html" class="btn-shop">Shop now</a>
            </div>`;
        subtotalEl.textContent = "$0.00";
        taxEl.textContent = "$0.00";
        totalEl.textContent = "$0.00";
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
                <div class="item-stock">In Stock</div>
                <div class="item-actions">
                    <select class="qty-select" data-cart-index="${item.cartItemId}">
                        ${[1, 2, 3, 4, 5].map((qty) => `<option value="${qty}" ${item.qty === qty ? "selected" : ""}>Qty: ${qty}</option>`).join("")}
                    </select>
                    <span class="item-separator">|</span>
                    <button class="item-delete" data-remove-index="${item.cartItemId}" data-name="${item.name}">Delete</button>
                </div>
            </div>
            <div class="item-price">${item.price}</div>
        </div>
    `).join("");

    const subtotal = cart.reduce((sum, item) => {
        const price = parseFloat(item.price.replace("$", ""));
        return sum + price * item.qty;
    }, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    taxEl.textContent = `$${tax.toFixed(2)}`;
    totalEl.textContent = `$${total.toFixed(2)}`;
    shippingEl.textContent = subtotal > 0 ? "FREE" : "$0.00";
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = "1";

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
            showToast("Checkout flow can be added next.");
        });
    }

    renderCart().catch(() => {
        const container = document.getElementById("cart-items-container");
        if (container) {
            container.innerHTML = "<p>Unable to load cart right now.</p>";
        }
    });
});
