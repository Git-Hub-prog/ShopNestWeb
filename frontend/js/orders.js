function formatDisplayDate(dateString) {
    if (!dateString) {
        return "-";
    }

    return new Date(dateString).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

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
        window.location.href = "login.html?next=orders.html";
        return;
    }

    const ordersList = document.getElementById("orders-list");
    const emptyState = document.getElementById("orders-empty");
    const successBanner = document.getElementById("order-success-banner");
    const trackingCard = document.getElementById("tracking-card");
    const trackingOrderNumber = document.getElementById("tracking-order-number");
    const trackingStatus = document.getElementById("tracking-status");
    const trackingDelivery = document.getElementById("tracking-delivery");
    const trackingSteps = document.getElementById("tracking-steps");
    const trackingPaymentText = document.getElementById("tracking-payment-text");
    const trackingSubtotal = document.getElementById("tracking-subtotal");
    const trackingShipping = document.getElementById("tracking-shipping");
    const trackingTax = document.getElementById("tracking-tax");
    const trackingTotal = document.getElementById("tracking-total");
    const trackingAddressText = document.getElementById("tracking-address-text");
    const urlParams = new URLSearchParams(window.location.search);

    let orders = [];
    let refreshInterval = null;
    let currentTrackedOrderId = null;

    function setActiveOrderCard(orderId) {
        document.querySelectorAll(".order-card").forEach((card) => {
            card.classList.toggle("active-order", Number(card.dataset.orderId) === orderId);
        });
    }

    function startTrackingOrder(orderId) {
        currentTrackedOrderId = orderId;

        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        refreshTrackedOrder();
        refreshInterval = setInterval(refreshTrackedOrder, 5000);
    }

    async function refreshTrackedOrder() {
        if (!currentTrackedOrderId) {
            return;
        }

        try {
            const data = await apiRequest(`/orders/${currentTrackedOrderId}?userId=${user.id}`);
            const updatedOrder = data.order;
            
            // Update the order in the orders array
            const orderIndex = orders.findIndex((o) => o.id === updatedOrder.id);
            if (orderIndex !== -1) {
                const previousOrder = orders[orderIndex];
                orders[orderIndex] = updatedOrder;
                
                // If status changed, update the display
                if (previousOrder.trackingStage !== updatedOrder.trackingStage) {
                    renderOrders();
                    renderTracking(updatedOrder);
                    
                    // Show notification of status change
                    const message = `Order Status Updated: ${updatedOrder.trackingStage}`;
                    if (successBanner) {
                        successBanner.hidden = false;
                        successBanner.className = "success-banner";
                        successBanner.querySelector("strong").textContent = "Order Updated!";
                        successBanner.querySelector("span").textContent = message;
                        setTimeout(() => {
                            successBanner.hidden = true;
                        }, 5000);
                    }
                }
            }
        } catch (error) {
        }
    }

    function renderTracking(order) {
        if (
            !trackingCard ||
            !trackingOrderNumber ||
            !trackingStatus ||
            !trackingDelivery ||
            !trackingSteps ||
            !trackingPaymentText ||
            !trackingSubtotal ||
            !trackingShipping ||
            !trackingTax ||
            !trackingTotal ||
            !trackingAddressText
        ) {
            return;
        }

        trackingCard.hidden = false;
        trackingOrderNumber.textContent = order.orderNumber;
        trackingStatus.textContent = `${order.status} | ${order.trackingStage}`;
        trackingDelivery.textContent = order.trackingStage === "Cancelled"
            ? "Cancelled"
            : formatDisplayDate(order.estimatedDelivery);
        trackingPaymentText.textContent = `${order.paymentMethod.toUpperCase()}${order.paymentLast4 ? ` ending in ${order.paymentLast4}` : ""}`;
        trackingSubtotal.textContent = order.subtotal;
        trackingShipping.textContent = order.shipping;
        trackingTax.textContent = order.tax;
        trackingTotal.textContent = order.total;
        trackingAddressText.textContent = `${order.deliveryName}, ${order.deliveryAddress}, ${order.deliveryCity}, ${order.deliveryState} - ${order.deliveryZip}. Phone: ${order.deliveryPhone}`;
        setActiveOrderCard(order.id);

        trackingSteps.innerHTML = order.trackingSteps.map((step) => `
            <div class="tracking-step ${step.completed ? "completed" : ""}">
                <span class="tracking-step-dot"></span>
                <span>${step.label}</span>
            </div>
        `).join("");
    }

    function renderOrders() {
        if (!ordersList) {
            return;
        }

        if (!orders.length) {
            if (emptyState) {
                emptyState.hidden = false;
            }
            ordersList.innerHTML = "";
            if (trackingCard) {
                trackingCard.hidden = true;
            }
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        const selectedOrderId = Number(urlParams.get("order")) || orders[0].id;
        const activeOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];

        ordersList.innerHTML = orders.map((order) => `
            <article class="order-card ${order.id === activeOrder.id ? "active-order" : ""}" data-order-id="${order.id}">
                <div class="order-topbar">
                    <div>
                        <h2>${order.orderNumber}</h2>
                        <div class="order-meta">
                            <span>Placed: ${formatDisplayDate(order.placedAt)}</span>
                            <span>Payment: ${order.paymentMethod.toUpperCase()}${order.paymentLast4 ? ` ending in ${order.paymentLast4}` : ""}</span>
                        </div>
                    </div>
                    <span class="status-badge ${order.status === "Cancelled" ? "cancelled" : ""}">${order.trackingStage}</span>
                </div>
                <div class="order-items">
                    ${order.items.map((item) => `
                        <div class="order-item">
                            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400'">
                            <div class="item-copy">
                                <strong>${item.name}</strong>
                                <span>Qty: ${item.qty}</span>
                            </div>
                            <div class="item-price">${item.price}</div>
                        </div>
                    `).join("")}
                </div>
                <div class="order-total-row">
                    <strong>Total: ${order.total}</strong>
                    <div class="order-actions">
                        <button type="button" class="track-btn" data-track-order="${order.id}">Track Order</button>
                        ${order.canCancel ? `<button type="button" class="cancel-btn" data-cancel-order="${order.id}">Cancel Order</button>` : ""}
                        ${order.trackingStage !== "Out for Delivery" ? `<button type="button" class="delete-btn" data-delete-order="${order.id}">Delete</button>` : ""}
                    </div>
                </div>
            </article>
        `).join("");

        document.querySelectorAll("[data-track-order]").forEach((button) => {
            button.addEventListener("click", () => {
                const order = orders.find((entry) => entry.id === Number(button.dataset.trackOrder));
                if (order) {
                    renderTracking(order);
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.set("order", String(order.id));
                    nextUrl.searchParams.delete("success");
                    window.history.replaceState({}, "", nextUrl);
                    startTrackingOrder(order.id);
                }
            });
        });

        document.querySelectorAll("[data-cancel-order]").forEach((button) => {
            button.addEventListener("click", async () => {
                const orderId = Number(button.dataset.cancelOrder);
                button.disabled = true;
                button.textContent = "Cancelling...";

                try {
                    const data = await apiRequest(`/orders/${orderId}/cancel`, {
                        method: "PATCH",
                        body: JSON.stringify({ userId: user.id })
                    });

                    orders = orders.map((entry) => entry.id === orderId ? data.order : entry);
                    if (successBanner) {
                        successBanner.hidden = false;
                        successBanner.querySelector("strong").textContent = "Order cancelled successfully.";
                        successBanner.querySelector("span").textContent = data.message;
                    }

                    urlParams.set("order", String(orderId));
                    urlParams.delete("success");
                    window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
                    renderOrders();
                    renderTracking(data.order);
                } catch (error) {
                    button.disabled = false;
                    button.textContent = "Cancel Order";
                    window.alert(error.message);
                }
            });
        });

        document.querySelectorAll("[data-delete-order]").forEach((button) => {
            button.addEventListener("click", async () => {
                const orderId = Number(button.dataset.deleteOrder);

                if (!window.confirm("Remove this order from your history? This cannot be undone.")) {
                    return;
                }

                button.disabled = true;
                button.textContent = "Deleting...";

                try {
                    await apiRequest(`/orders/${orderId}`, {
                        method: "DELETE"
                    });

                    orders = orders.filter((o) => o.id !== orderId);

                    if (successBanner) {
                        successBanner.hidden = false;
                        successBanner.querySelector("strong").textContent = "Order removed.";
                        successBanner.querySelector("span").textContent = "Order deleted from your history.";
                    }

                    if (trackingCard) {
                        trackingCard.hidden = true;
                    }

                    renderOrders();
                } catch (error) {
                    button.disabled = false;
                    button.textContent = "Delete";
                    window.alert(error.message);
                }
            });
        });

        renderTracking(activeOrder);
    }

    try {
        const data = await apiRequest(`/orders?userId=${user.id}`);
        orders = data.orders || [];

        if (successBanner && urlParams.get("success") === "1") {
            successBanner.hidden = false;
        }

        renderOrders();
        
        const trackedOrderId = Number(urlParams.get("order"));
        const activeOrder = orders.find((o) => o.id === trackedOrderId) || orders[0];

        if (activeOrder) {
            startTrackingOrder(activeOrder.id);
        }
    } catch (error) {
        if (ordersList) {
            ordersList.innerHTML = `<p>${error.message}</p>`;
        }
    }
});

// Clean up interval when page is unloaded
window.addEventListener("beforeunload", () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
