const CATEGORIES = {
    "health": "Health & Care",
    "home": "Home Essentials",
    "gaming": "Gaming",
    "fashion": "Fashion Deals",
    "decor": "Room Decor",
    "kitchen": "Kitchen",
    "home-arrivals": "New Arrivals",
    "fitness": "Fitness & Sports"
};

let selectedCategory = null;
let allProducts = [];
let allOrders = [];
let ordersPollInterval = null;
let lastOrdersError = "";
let pollingPaused = false;  // Flag to pause polling during user interactions
const IST_LOCALE = "en-IN";
const IST_TIMEZONE = "Asia/Kolkata";

function normalizeAdminOrder(order) {
    if (!order) {
        return order;
    }

    return {
        ...order,
        orderNumber: order.orderNumber || order.order_number || `#${order.id}`,
        deliveryName: order.deliveryName || order.delivery_name || order.customerName || "Guest",
        deliveryPhone: order.deliveryPhone || order.delivery_phone || "",
        deliveryAddress: order.deliveryAddress || order.delivery_address || "",
        deliveryCity: order.deliveryCity || order.delivery_city || "",
        deliveryState: order.deliveryState || order.delivery_state || "",
        deliveryZip: order.deliveryZip || order.delivery_zip || "",
        paymentMethod: order.paymentMethod || order.payment_method || "",
        items: Array.isArray(order.items)
            ? order.items.map((item) => ({
                ...item,
                name: item.name || item.product_name || item.productName || "",
                qty: item.qty || item.quantity || 0,
                price: item.price || item.product_price || 0,
                image: item.image || item.product_image || "",
                productId: item.productId || item.product_id || item.id
            }))
            : []
    };
}

function getProductById(id) {
    return allProducts.find(p => String(p.id) === String(id) || Number(p.id) === Number(id));
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const parts = new Intl.DateTimeFormat(IST_LOCALE, {
        timeZone: IST_TIMEZONE,
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

function setMessage(message, type = "success") {
    const messageBox = document.getElementById("admin-message");
    if (!messageBox) {
        return;
    }

    if (!message) {
        messageBox.hidden = true;
        messageBox.textContent = "";
        messageBox.className = "dashboard-message";
        return;
    }

    messageBox.hidden = false;
    messageBox.textContent = message;
    messageBox.className = `dashboard-message ${type}`;
}

function updateSummary(users) {
    const totalUsers = document.getElementById("total-users");
    const activeUsers = document.getElementById("active-users");
    const blockedUsers = document.getElementById("blocked-users");

    if (!totalUsers || !activeUsers || !blockedUsers) {
        return;
    }

    const blockedCount = users.filter((user) => user.isBlocked).length;
    totalUsers.textContent = String(users.length);
    blockedUsers.textContent = String(blockedCount);
    activeUsers.textContent = String(users.length - blockedCount);
}

function createActionButton(label, className, onClick, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-btn ${className}`;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
}

function initTabs() {
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tab = document.getElementById(tabName);
            if (tab) tab.classList.add("active");
        });
    });
}

function initCategorySelectors() {
    const addSelector = document.getElementById("category-selector");
    const listSelector = document.getElementById("list-category-selector");

    if (!addSelector || !listSelector) return;

    Object.entries(CATEGORIES).forEach(([key, name]) => {
        const btn1 = createCategoryButton(key, name, (cat, target) => {
            selectedCategory = cat;
            document.querySelectorAll("#category-selector .category-btn").forEach(b => b.classList.remove("selected"));
            if (target && target.classList.contains("category-btn")) {
                target.classList.add("selected");
            }
        });
        
        const btn2 = createCategoryButton(key, name, async (cat, target) => {
            document.querySelectorAll("#list-category-selector .category-btn").forEach(b => b.classList.remove("selected"));
            if (target && target.classList.contains("category-btn")) {
                target.classList.add("selected");
            }
            await displayProductsByCategory(cat);
        });

        if (addSelector) addSelector.appendChild(btn1);
        if (listSelector) listSelector.appendChild(btn2);
    });
}

function createCategoryButton(key, name, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-btn";
    btn.textContent = name;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        onClick(key, e.currentTarget);
    });
    return btn;
}

function initAddProductForm() {
    const form = document.getElementById("add-product-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!selectedCategory) {
            showMessage("add-error-msg", "Please select a category first!");
            return;
        }

        const product = {
            categoryId: selectedCategory,
            name: document.getElementById("product-name").value,
            price: Number(document.getElementById("product-price").value),
            stock: Number(document.getElementById("product-stock").value),
            feature: document.getElementById("product-feature").value,
            description: document.getElementById("product-description").value,
            rating: Number(document.getElementById("product-rating").value) || 4.0,
            image: document.getElementById("product-image").value || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop"
        };

        try {
            const response = await apiRequest("/admin/products", {
                method: "POST",
                body: JSON.stringify(product)
            });

            setMessage(`✓ Product "${product.name}" added successfully!`);
            form.reset();
            selectedCategory = null;
            document.querySelectorAll("#category-selector .category-btn").forEach(b => b.classList.remove("selected"));
            
            await loadAllProducts();
            
            setTimeout(() => {
                setMessage("");
            }, 3000);
        } catch (error) {
            setMessage(error.message || "Error adding product", "error");
        }
    });
}

async function loadAllProducts() {
    try {
        const data = await apiRequest("/products");
        allProducts = [];
        
        if (Array.isArray(data)) {
            allProducts = data;
        } else if (data.products) {
            allProducts = data.products;
        } else if (data.items) {
            data.items.forEach(item => allProducts.push(item));
        } else {
            Object.values(data).forEach(category => {
                if (category && category.items) {
                    category.items.forEach(item => allProducts.push(item));
                }
            });
        }
    } catch (error) {
        allProducts = [];
    }
}

async function displayProductsByCategory(category) {
    const container = document.getElementById("list-items-container");
    if (!container) return;

    const categoryName = CATEGORIES[category];
    
    const filtered = allProducts.filter(p => {
        const categoryId = p.category || p.categoryId || "";
        return categoryId === category;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="section-box"><p>No products in ${categoryName}</p></div>`;
        return;
    }

    let html = `<h3 style="margin-top: 20px; margin-bottom: 20px;">${categoryName}</h3>`;
    html += '<div class="items-grid">';
    
    filtered.forEach(product => {
        html += `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800'">
                <h4>${product.name}</h4>
                <p>${product.feature || "Popular pick"}</p>
                <div class="product-price">₹${Number(product.price).toLocaleString('en-IN')}</div>
                <p style="color: ${product.stock > 0 ? '#007600' : '#b12704'}; font-weight: 700;">
                    ${product.stock > 0 ? `Stock: ${product.stock}` : "OUT OF STOCK"}
                </p>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadOrders() {
    try {
        const data = await apiRequest("/admin/orders");
        const source = data && data.orders ? data.orders : (Array.isArray(data) ? data : []);
        allOrders = source
            .map(normalizeAdminOrder)
            .sort((a, b) => {
                const aTime = Date.parse(a?.placedAt || a?.placed_at || "") || 0;
                const bTime = Date.parse(b?.placedAt || b?.placed_at || "") || 0;
                if (bTime !== aTime) {
                    return bTime - aTime;
                }
                return Number(b?.id || 0) - Number(a?.id || 0);
            });
        lastOrdersError = "";
        displayOrders();
    } catch (error) {
        allOrders = [];
        lastOrdersError = error?.message || "Unable to load orders.";
        setMessage(`Orders list failed to load: ${lastOrdersError}`, "error");
        if (error?.status === 403) {
            setTimeout(() => {
                clearCurrentUser();
                window.location.href = "login.html?next=admin.html";
            }, 900);
        }
        displayOrders();
    }
}

function displayOrders() {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;
    
    if (!allOrders || allOrders.length === 0) {
        const text = lastOrdersError
            ? `Unable to load orders (${lastOrdersError})`
            : "No orders found";
        tbody.innerHTML = `<tr><td colspan="6" class="table-placeholder">${text}</td></tr>`;
        return;
    }

    tbody.innerHTML = allOrders.map(order => {
        const itemCount = order.items ? order.items.length : 0;
        const total = order.total || order.subtotal || 0;
        const status = order.status || "Processing";
        const customer = order.deliveryName || order.customerName || "Guest";

        // check current availability for items using allProducts snapshot
        const anyUnavailable = (order.items || []).some(it => {
            const pid = it.productId || it.id;
            const prod = getProductById(pid);
            return !prod || !prod.inStock;
        });

        const availabilityBadge = anyUnavailable ? '<span style="color:#b12704;font-weight:700;">(Some items unavailable)</span>' : '';

        // Build product names and quantities
        const productsList = (order.items || [])
            .map(it => {
                const name = it.product_name || it.name || 'Unknown Product';
                const qty = it.quantity || it.qty || 0;
                return `${name} x${qty}`;
            })
            .join(', ');

        return `
            <tr>
                <td>#${order.id}</td>
                <td>${customer}</td>
                <td>
                    <div style="max-width: 300px; word-wrap: break-word;">
                        ${productsList || 'No items'} 
                        ${availabilityBadge}
                    </div>
                </td>
                <td>₹${Number(total).toLocaleString('en-IN')}</td>
                <td>
                    <select class="status-dropdown" onchange="updateOrderStatus(${order.id}, this.value)" onfocus="pauseOrderPolling()" onblur="resumeOrderPolling()">
                        <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Packed" ${status === 'Packed' ? 'selected' : ''}>Packed</option>
                        <option value="Shipped" ${status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Out for Delivery" ${status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td><button class="btn-small" onclick="viewOrderDetails(${order.id})" style="cursor:pointer;">View</button></td>
            </tr>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await apiRequest(`/admin/orders/${orderId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
        });
        // Show confirmation message before refreshing table
        setMessage(`Order #${orderId} status updated to: ${newStatus}`);
        // Wait 1.5 seconds to let user see confirmation before table refreshes
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadOrders();
    } catch (error) {
        setMessage("Error updating order: " + error.message, "error");
    }
}

function pauseOrderPolling() {
    pollingPaused = true;
}

function resumeOrderPolling() {
    pollingPaused = false;
}

function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    let details = `Order #${order.id}\n`;
    details += `Order Number: ${order.orderNumber || "N/A"}\n`;
    details += `Customer: ${order.deliveryName || "Guest"}\n`;
    details += `Phone: ${order.deliveryPhone || "N/A"}\n`;
    details += `Address: ${order.deliveryAddress || "N/A"}\n`;
    details += `${order.deliveryCity || ""}, ${order.deliveryState || ""} ${order.deliveryZip || ""}\n`;
    details += `Status: ${order.status || "Processing"}\n`;
    details += `Payment Method: ${order.paymentMethod || "N/A"}\n`;
    details += `Subtotal: ₹${Number(order.subtotal || 0).toLocaleString('en-IN')}\n`;
    details += `Tax: ₹${Number(order.tax || 0).toLocaleString('en-IN')}\n`;
    details += `Shipping: ₹${Number(order.shipping || 0).toLocaleString('en-IN')}\n`;
    details += `Total: ₹${Number(order.total || 0).toLocaleString('en-IN')}\n\n`;
    details += `Items:\n`;
    
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const name = item.name || '';
                const qty = item.qty || 0;
                const price = item.price || 0;
                const pid = item.productId || item.id;
                const prod = getProductById(pid);
                const availability = prod ? (prod.inStock ? `In Stock (${prod.stock})` : 'Out of Stock') : 'Product not found';
                details += `- ${name} x${qty} @ ₹${Number(price).toLocaleString('en-IN')} — ${availability}\n`;
            });
        }
    
    alert(details);
}

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.style.display = message ? "block" : "none";
}

function renderUsers(users) {
    const tableBody = document.getElementById("users-table-body");
    const currentUser = getCurrentUser();
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = "";

    if (!users.length) {
        tableBody.innerHTML = `<tr><td colspan="6" class="table-placeholder">No registered users found.</td></tr>`;
        updateSummary(users);
        return;
    }

    updateSummary(users);

    users.forEach((user) => {
        const row = document.createElement("tr");
        const actions = document.createElement("div");
        actions.className = "action-group";

        const isProtectedAdmin = user.isAdmin;
        const isCurrentAdmin = currentUser?.id === user.id;

        const blockLabel = user.isBlocked ? "Unblock" : "Block";
        const blockClass = user.isBlocked ? "unblock" : "block";

        actions.appendChild(createActionButton(
            blockLabel,
            blockClass,
            async () => {
                try {
                    setMessage("");
                    await apiRequest(`/admin/users/${user.id}/block`, {
                        method: "PATCH",
                        body: JSON.stringify({ blocked: !user.isBlocked })
                    });
                    setMessage(`${user.name} has been ${user.isBlocked ? "unblocked" : "blocked"}.`);
                    await loadUsers();
                } catch (error) {
                    setMessage(error.message, "error");
                }
            },
            isProtectedAdmin
        ));

        actions.appendChild(createActionButton(
            "Delete",
            "delete",
            async () => {
                const confirmed = window.confirm(`Delete ${user.name}'s account? This cannot be undone.`);
                if (!confirmed) {
                    return;
                }

                try {
                    setMessage("");
                    await apiRequest(`/admin/users/${user.id}`, {
                        method: "DELETE"
                    });
                    setMessage(`${user.name} has been deleted.`);
                    await loadUsers();
                } catch (error) {
                    setMessage(error.message, "error");
                }
            },
            isProtectedAdmin || isCurrentAdmin
        ));

        row.innerHTML = `
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.isAdmin ? "role-admin" : "role-user"}">${user.isAdmin ? "Admin" : "User"}</span></td>
            <td><span class="status-badge ${user.isBlocked ? "status-blocked" : "status-active"}">${user.isBlocked ? "Blocked" : "Active"}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td></td>
        `;
        row.lastElementChild.appendChild(actions);
        tableBody.appendChild(row);
    });
}

async function loadUsers() {
    try {
        const data = await apiRequest("/admin/users");
        renderUsers(data.users || []);
    } catch (error) {
        setMessage(`Users list failed to load: ${error?.message || "Unknown error"}`, "error");
        if (error?.status === 403) {
            setTimeout(() => {
                clearCurrentUser();
                window.location.href = "login.html?next=admin.html";
            }, 900);
        }
        renderUsers([]);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll("[data-nav-target]").forEach((element) => {
        element.addEventListener("click", () => {
            if (element.dataset.navTarget) {
                window.location.href = element.dataset.navTarget;
            }
        });
    });

    const currentUser = await initializeSessionUI();
    if (!isAdminUser(currentUser)) {
        setMessage("Admin access is required to open this page.", "error");
        setTimeout(() => {
            window.location.href = "login.html?next=admin.html";
        }, 1200);
        return;
    }

    if (!currentUser?.sessionToken) {
        setMessage("Your admin session is missing. Please login again.", "error");
        setTimeout(() => {
            clearCurrentUser();
            window.location.href = "login.html?next=admin.html";
        }, 1200);
        return;
    }

    // Initialize tabs and product/order management
    initTabs();
    initCategorySelectors();
    initAddProductForm();

    // Load initial data
    await loadAllProducts();
    await loadOrders();

    // Poll for new orders more frequently so admin updates feel near-real-time
    ordersPollInterval = setInterval(async () => {
        // Skip polling if user is interacting with dropdowns
        if (pollingPaused) {
            return;
        }
        try {
            await loadOrders();
        } catch (err) {
            // ignore polling errors
        }
    }, 2500);

    // Refresh immediately when tab becomes active again.
    document.addEventListener("visibilitychange", async () => {
        if (!document.hidden) {
            try {
                await loadOrders();
            } catch (_err) {
                // ignore focus refresh errors
            }
        }
    });

    window.addEventListener("focus", async () => {
        try {
            await loadOrders();
        } catch (_err) {
            // ignore focus refresh errors
        }
    });

    const refreshButton = document.getElementById("refresh-users-btn");
    if (refreshButton) {
        refreshButton.addEventListener("click", async () => {
            try {
                setMessage("");
                await loadUsers();
            } catch (error) {
                setMessage(error.message, "error");
            }
        });
    }

    try {
        await loadUsers();
    } catch (error) {
        setMessage(error.message, "error");
        renderUsers([]);
    }

    // Clear polling when user leaves the admin page
    window.addEventListener("beforeunload", () => {
        if (ordersPollInterval) {
            clearInterval(ordersPollInterval);
        }
    });
});
