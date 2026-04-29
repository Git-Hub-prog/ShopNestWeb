function showCheckoutMessage(message) {
    const box = document.getElementById("checkout-message");
    if (!box) {
        return;
    }

    box.textContent = message;
    box.className = "checkout-message error";
    box.hidden = false;
}

function clearCheckoutMessage() {
    const box = document.getElementById("checkout-message");
    if (!box) {
        return;
    }

    box.hidden = true;
    box.textContent = "";
}

function sanitizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

function formatCardNumber(value) {
    return sanitizeDigits(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
    const digits = sanitizeDigits(value).slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }

    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validateCheckoutPayload(payload) {
    const { delivery, payment } = payload;

    if (!delivery.fullName || !delivery.phone || !delivery.address || !delivery.city || !delivery.state || !delivery.postalCode) {
        return "Please complete all delivery information fields.";
    }

    if (sanitizeDigits(delivery.phone).length < 10) {
        return "Please enter a valid phone number.";
    }

    if (!payment.method || !paymentMethods.includes(payment.method)) {
        return "Please select a valid payment method.";
    }

    if (payment.method === "upi") {
        if (!payment.upiId || !payment.upiId.includes("@")) {
            return "Please enter a valid UPI ID (e.g., yourname@paytm or yourname@okhdfcbank).";
        }
    }

    return "";
}

function parseCurrencyValue(amountText) {
    const parsed = parseFloat(String(amountText || "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

const paymentMethods = ["upi", "cod"];

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll("[data-nav-target]").forEach((element) => {
        element.addEventListener("click", () => {
            if (element.dataset.navTarget) {
                window.location.href = element.dataset.navTarget;
            }
        });
    });

    const user = await initializeSessionUI();
    if (!user) {
        window.location.href = "login.html?next=checkout.html";
        return;
    }

    const checkoutItems = document.getElementById("checkout-items");
    const summaryCount = document.getElementById("summary-count");
    const summarySubtotal = document.getElementById("summary-subtotal");
    const summaryShipping = document.getElementById("summary-shipping");
    const summaryTax = document.getElementById("summary-tax");
    const summaryTotal = document.getElementById("summary-total");
    const checkoutForm = document.getElementById("checkout-form");
    const placeOrderBtn = document.getElementById("place-order-btn");

    const deliveryName = document.getElementById("delivery-name");
    const deliveryPhone = document.getElementById("delivery-phone");
    const deliveryAddress = document.getElementById("delivery-address");
    const deliveryCity = document.getElementById("delivery-city");
    const deliveryState = document.getElementById("delivery-state");
    const deliveryZip = document.getElementById("delivery-zip");

    const codFields = document.getElementById("cod-fields");
    const upiFields = document.getElementById("upi-fields");
    const upiIdInput = document.getElementById("upi-id");
    const upiRadio = document.getElementById("payment-upi");
    const codRadio = document.getElementById("payment-cod");

    let cartItems = [];
    let currentTotals = { subtotal: 0, tax: 0, total: 0 };

    function buildCheckoutPayload() {
        const paymentMethod = document.querySelector("input[name='payment-method']:checked")?.value || "upi";

        return {
            userId: user.id,
            delivery: {
                fullName: deliveryName?.value.trim() || user.name || "",
                phone: deliveryPhone?.value.trim() || "",
                address: deliveryAddress?.value.trim() || "",
                city: deliveryCity?.value.trim() || "",
                state: deliveryState?.value.trim() || "",
                postalCode: deliveryZip?.value.trim() || ""
            },
            payment: {
                method: paymentMethod,
                upiId: paymentMethod === "upi" ? (upiIdInput?.value.trim() || "") : ""
            }
        };
    }

    function updatePaymentView() {
        const method = document.querySelector("input[name='payment-method']:checked")?.value || "upi";
        if (upiFields) {
            upiFields.hidden = method !== "upi";
        }
        if (codFields) {
            codFields.hidden = method !== "cod";
        }
        clearCheckoutMessage();
    }

    function renderSummary(items) {
        cartItems = items;

        if (!checkoutItems || !summaryCount || !summarySubtotal || !summaryShipping || !summaryTax || !summaryTotal) {
            return;
        }

        if (!items.length) {
            checkoutItems.innerHTML = `
                <div class="checkout-item">
                    <div></div>
                    <div>
                        <strong>Your cart is empty</strong>
                        <span>Add products before checkout.</span>
                    </div>
                </div>
            `;
            summaryCount.textContent = "0";
            summarySubtotal.textContent = "$0.00";
            summaryShipping.textContent = "FREE";
            summaryTax.textContent = "$0.00";
            summaryTotal.textContent = "$0.00";
            if (placeOrderBtn) {
                placeOrderBtn.disabled = true;
                placeOrderBtn.style.opacity = "0.6";
            }
            return;
        }

        const hasOutOfStockItems = items.some((item) => {
            const reservedQty = Number(item.qty || 0);
            const remainingStock = Number(item.stock || 0);
            const maxAllowedQty = Number(item.maxQty ?? (remainingStock + reservedQty));
            return !item.inStock || maxAllowedQty < reservedQty;
        });

        const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
        const subtotal = items.reduce((sum, item) => sum + ((typeof item.price === "number" ? item.price : parseFloat(item.price.replace(/[$,₹]/g, ""))) * item.qty), 0);
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        currentTotals = { subtotal, tax, total };

        checkoutItems.innerHTML = items.map((item) => `
            <div class="checkout-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400'">
                <div>
                    <strong>${item.name}</strong>
                    <span style="display:block;">Qty: ${item.qty} | ${item.price}</span>
                    <span style="color:${item.inStock ? "#007600" : "#b12704"};font-weight:700;">
                        ${item.inStock ? `In Stock (${item.stock} left)` : "Out of Stock"}
                    </span>
                </div>
            </div>
        `).join("");

        summaryCount.textContent = String(totalItems);
        summarySubtotal.textContent = `₹${subtotal.toFixed(2)}`;
        summaryShipping.textContent = "FREE";
        summaryTax.textContent = `₹${tax.toFixed(2)}`;
        summaryTotal.textContent = `₹${total.toFixed(2)}`;

        if (placeOrderBtn) {
            placeOrderBtn.disabled = hasOutOfStockItems;
            placeOrderBtn.style.opacity = "1";
            placeOrderBtn.textContent = hasOutOfStockItems ? "Resolve Out of Stock Items" : "Pay and Place Order";
        }

        if (hasOutOfStockItems) {
            showCheckoutMessage("One or more items in your cart are out of stock. Please update your cart before payment.");
        }
    }

    try {
        const cartData = await apiRequest(`/cart?userId=${user.id}`);
        renderSummary(cartData.items || []);
    } catch (error) {
        showCheckoutMessage(error.message);
    }

    if (deliveryName && !deliveryName.value) {
        deliveryName.value = user.name || "";
    }

    document.querySelectorAll("input[name='payment-method']").forEach((input) => {
        input.addEventListener("change", () => {
            updatePaymentView();
        });
    });
    updatePaymentView();

    if (deliveryPhone) {
        deliveryPhone.addEventListener("input", () => {
            deliveryPhone.value = sanitizeDigits(deliveryPhone.value).slice(0, 12);
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearCheckoutMessage();

            if (!cartItems.length) {
                showCheckoutMessage("Your cart is empty. Add products before placing an order.");
                return;
            }

            const payload = buildCheckoutPayload();
            const paymentMethod = payload.payment.method;
            const validationError = validateCheckoutPayload(payload);

            if (validationError) {
                showCheckoutMessage(validationError);
                return;
            }

            if (placeOrderBtn) {
                placeOrderBtn.disabled = true;
                placeOrderBtn.textContent = "Processing Payment...";
            }

            try {
                const data = await apiRequest("/orders", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });

                window.location.href = `orders.html?order=${data.order.id}&success=1`;
            } catch (error) {
                showCheckoutMessage(error.message || "Unable to place your order. Please try again.");
                if (placeOrderBtn) {
                    placeOrderBtn.disabled = false;
                    placeOrderBtn.textContent = "Pay and Place Order";
                }
            }
        });
    }
});
