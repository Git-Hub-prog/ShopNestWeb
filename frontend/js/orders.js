function formatDisplayDate(dateString) {
    if (!dateString) {
        return "-";
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("day")}/${get("month")}/${get("year")}, ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod").toUpperCase()} IST`;
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

    // Build the progress list shown in the tracking panel.
    function buildTrackingSteps(orderLike) {
        const stage = String(orderLike?.trackingStage || orderLike?.tracking_stage || "Order Confirmed").toLowerCase();
        const status = String(orderLike?.status || "Processing").toLowerCase();
        const isCancelled = status === "cancelled" || stage === "cancelled";

        if (isCancelled) {
            return [
                { label: "Order Confirmed", completed: true },
                { label: "Cancelled", completed: true }
            ];
        }

        const base = [
            { label: "Order Confirmed", keys: ["order confirmed", "processing"] },
            { label: "Packed", keys: ["packed"] },
            { label: "Shipped", keys: ["shipped"] },
            { label: "Out for Delivery", keys: ["out for delivery"] },
            { label: "Delivered", keys: ["delivered"] }
        ];

        let reached = 0;
        for (let i = 0; i < base.length; i += 1) {
            const hit = base[i].keys.some((k) => stage.includes(k) || status.includes(k));
            if (hit) {
                reached = i;
            }
        }

        return base.map((s, idx) => ({
            label: s.label,
            completed: idx <= reached
        }));
    }

    // Convert backend status values into the display labels used by the UI.
    function resolveTrackingStage(trackingStage, status) {
        const normalizedTrackingStage = String(trackingStage || "").trim().toLowerCase();
        const normalizedStatus = String(status || "").trim().toLowerCase();

        const stageMap = {
            "processing": "Order Confirmed",
            "order confirmed": "Order Confirmed",
            "packed": "Packed",
            "shipped": "Shipped",
            "out for delivery": "Out for Delivery",
            "delivered": "Delivered",
            "cancelled": "Cancelled",
            "canceled": "Cancelled"
        };

        return stageMap[normalizedStatus] || stageMap[normalizedTrackingStage] || trackingStage || "Order Confirmed";
    }

    // Normalize snake_case backend fields into the camelCase names used by the page.
    function normalizeOrder(sourceOrder) {
        if (!sourceOrder) return sourceOrder;

        const order = Object.assign({}, sourceOrder);
        order.orderNumber = sourceOrder.order_number || sourceOrder.orderNumber || order.orderNumber;
        order.placedAt = sourceOrder.placed_at || sourceOrder.placedAt || order.placedAt;
        order.paymentMethod = sourceOrder.payment_method || sourceOrder.paymentMethod || (sourceOrder.payment || {}).method || order.paymentMethod;
        order.paymentLast4 = sourceOrder.payment_last4 || sourceOrder.paymentLast4 || (sourceOrder.payment || {}).last4 || order.paymentLast4;
        order.status = sourceOrder.status || order.status;
        order.trackingStage = resolveTrackingStage(sourceOrder.tracking_stage || sourceOrder.trackingStage || order.trackingStage, order.status);
        order.estimatedDelivery = sourceOrder.estimated_delivery || sourceOrder.estimatedDelivery || order.estimatedDelivery;
        order.deliveryName = sourceOrder.delivery_name || sourceOrder.deliveryName || order.deliveryName;
        order.deliveryAddress = sourceOrder.delivery_address || sourceOrder.deliveryAddress || order.deliveryAddress;
        order.deliveryCity = sourceOrder.delivery_city || sourceOrder.deliveryCity || order.deliveryCity;
        order.deliveryState = sourceOrder.delivery_state || sourceOrder.deliveryState || order.deliveryState;
        order.deliveryZip = sourceOrder.delivery_zip || sourceOrder.deliveryZip || order.deliveryZip;
        order.deliveryPhone = sourceOrder.delivery_phone || sourceOrder.deliveryPhone || order.deliveryPhone;

        if (Array.isArray(sourceOrder.items)) {
            order.items = sourceOrder.items.map((item) => ({
                name: item.product_name || item.name || item.productName || '',
                qty: item.quantity || item.qty || 0,
                price: item.product_price || item.price || 0,
                image: item.product_image || item.image || ''
            }));
        } else {
            order.items = Array.isArray(order.items) ? order.items : [];
        }

        order.trackingSteps = Array.isArray(sourceOrder.trackingSteps) && sourceOrder.trackingSteps.length
            ? sourceOrder.trackingSteps
            : buildTrackingSteps(order);

        order.total = sourceOrder.total || order.total;

        // Keep the buttons aligned with the backend rules.
        const normalizedStage = String(order.trackingStage || '').trim().toLowerCase();
        const normalizedStatus = String(order.status || '').trim().toLowerCase();
        const isCancelled = normalizedStatus === 'cancelled' || normalizedStage === 'cancelled';
        const isDelivered = normalizedStatus === 'delivered' || normalizedStage === 'delivered';
        const isShipped = normalizedStatus === 'shipped' || normalizedStage === 'shipped' || normalizedStatus === 'out for delivery' || normalizedStage === 'out for delivery';
        
        order.canCancel = !isShipped && !isCancelled && !isDelivered;
        order.canDelete = isCancelled || isDelivered;

        return order;
    }

    function setActiveOrderCard(orderId) {
        document.querySelectorAll(".order-card").forEach((card) => {
            card.classList.toggle("active-order", Number(card.dataset.orderId) === orderId);
        });
    }

    async function loadLatestTrackedOrder(orderId) {
        const data = await apiRequest(`/orders/${orderId}?userId=${user.id}`);
        const latestOrder = normalizeOrder(data.order);

        const orderIndex = orders.findIndex((entry) => entry.id === latestOrder.id);
        if (orderIndex !== -1) {
            orders[orderIndex] = latestOrder;
        }

        return latestOrder;
    }

    async function startTrackingOrder(orderId) {
        currentTrackedOrderId = orderId;

        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        try {
            const latestOrder = await loadLatestTrackedOrder(orderId);
            renderOrders();
            renderTracking(latestOrder);
        } catch (_error) {
            const fallbackOrder = orders.find((entry) => entry.id === orderId);
            if (fallbackOrder) {
                renderTracking(fallbackOrder);
            }
        }

        refreshInterval = setInterval(refreshTrackedOrder, 5000);
    }

    async function refreshTrackedOrder() {
        if (!currentTrackedOrderId) {
            return;
        }

        try {
            const data = await apiRequest(`/orders/${currentTrackedOrderId}?userId=${user.id}`);
            const updatedOrder = normalizeOrder(data.order);

            const orderIndex = orders.findIndex((o) => o.id === updatedOrder.id);
            if (orderIndex !== -1) {
                const previousOrder = orders[orderIndex];
                orders[orderIndex] = updatedOrder;

                if (previousOrder.trackingStage !== updatedOrder.trackingStage || previousOrder.status !== updatedOrder.status) {
                    renderOrders();
                    renderTracking(updatedOrder);

                    const message = previousOrder.trackingStage !== updatedOrder.trackingStage
                        ? `Order Stage Updated: ${updatedOrder.trackingStage}`
                        : `Order Status Updated: ${updatedOrder.status}`;

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

    // Update the right-side tracking panel.
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
        trackingPaymentText.textContent = `${(order.paymentMethod||'').toUpperCase()}${order.paymentLast4 ? ` ending in ${order.paymentLast4}` : ""}`;
        trackingSubtotal.textContent = order.subtotal;
        trackingShipping.textContent = order.shipping;
        trackingTax.textContent = order.tax;
        trackingTotal.textContent = order.total;
        trackingAddressText.textContent = `${order.deliveryName}, ${order.deliveryAddress}, ${order.deliveryCity}, ${order.deliveryState} - ${order.deliveryZip}. Phone: ${order.deliveryPhone}`;
        setActiveOrderCard(order.id);

        const steps = Array.isArray(order.trackingSteps) ? order.trackingSteps : buildTrackingSteps(order);
        trackingSteps.innerHTML = steps.map((step) => `
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

        // normalize orders so fields expected by the UI are present
        orders = orders.map(normalizeOrder);

        const selectedOrderId = Number(urlParams.get("order")) || (orders[0] && orders[0].id);
        const activeOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];

        ordersList.innerHTML = orders.map((order) => `
            <article class="order-card ${order.id === activeOrder.id ? "active-order" : ""}" data-order-id="${order.id}">
                <div class="order-topbar">
                    <div>
                        <h2>${order.orderNumber}</h2>
                        <div class="order-meta">
                            <span>Placed: ${formatDisplayDate(order.placedAt)}</span>
                            <span>Payment: ${(order.paymentMethod||'').toUpperCase()}${order.paymentLast4 ? ` ending in ${order.paymentLast4}` : ""}</span>
                        </div>
                    </div>
                    <span class="status-badge ${order.status === "Cancelled" ? "cancelled" : ""}">${order.trackingStage}</span>
                </div>
                <div class="order-items">
                    ${(Array.isArray(order.items) ? order.items : []).map((item) => `
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
                        ${order.canDelete ? `<button type="button" class="delete-btn" data-delete-order="${order.id}">Delete</button>` : ""}
                    </div>
                </div>
            </article>
        `).join("");

        document.querySelectorAll("[data-track-order]").forEach((button) => {
            button.addEventListener("click", async () => {
                const order = orders.find((entry) => entry.id === Number(button.dataset.trackOrder));
                if (order) {
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.set("order", String(order.id));
                    nextUrl.searchParams.delete("success");
                    window.history.replaceState({}, "", nextUrl);
                    await startTrackingOrder(order.id);
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

                    orders = orders.map((entry) => entry.id === orderId ? normalizeOrder(data.order) : entry);
                    if (successBanner) {
                        successBanner.hidden = false;
                        successBanner.querySelector("strong").textContent = "Order cancelled successfully.";
                        successBanner.querySelector("span").textContent = data.message;
                    }

                    urlParams.set("order", String(orderId));
                    urlParams.delete("success");
                    window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
                    renderOrders();
                    renderTracking(normalizeOrder(data.order));
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
                    await apiRequest(`/orders/${orderId}?userId=${user.id}`, {
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
        
        // When a new order is successfully placed, show the newest order
        // Otherwise, show the order specified in the URL parameter, or the first order
        let activeOrder;
        if (urlParams.get("success") === "1") {
            // Show the most recent (first) order after successful placement
            activeOrder = orders[0];
        } else {
            const trackedOrderId = Number(urlParams.get("order"));
            activeOrder = (trackedOrderId && orders.find((o) => o.id === trackedOrderId)) || orders[0];
        }

        if (activeOrder) {
            await startTrackingOrder(activeOrder.id);
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
