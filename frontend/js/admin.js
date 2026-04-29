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

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
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
        const btn1 = createCategoryButton(key, name, (cat) => {
            selectedCategory = cat;
            document.querySelectorAll("#category-selector .category-btn").forEach(b => b.classList.remove("selected"));
            if (event.target.classList.contains("category-btn")) {
                event.target.classList.add("selected");
            }
        });
        
        const btn2 = createCategoryButton(key, name, async (cat) => {
            document.querySelectorAll("#list-category-selector .category-btn").forEach(b => b.classList.remove("selected"));
            if (event.target.classList.contains("category-btn")) {
                event.target.classList.add("selected");
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
        onClick(key);
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
        allOrders = data && data.orders ? data.orders : (Array.isArray(data) ? data : []);
        displayOrders();
    } catch (error) {
        allOrders = [];
        displayOrders();
    }
}

function displayOrders() {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;
    
    if (!allOrders || allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-placeholder">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = allOrders.map(order => {
        const itemCount = order.items ? order.items.length : 0;
        const total = order.total || order.subtotal || 0;
        const status = order.status || "pending";

        return `
            <tr>
                <td>#${order.id}</td>
                <td>${order.deliveryName || order.customerName || "Guest"}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td>₹${Number(total).toLocaleString('en-IN')}</td>
                <td>
                    <select class="status-dropdown" onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="packed" ${status === 'packed' ? 'selected' : ''}>Packed</option>
                        <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="out-for-delivery" ${status === 'out-for-delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>Delivered</option>
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
        await loadOrders();
        setMessage(`Order #${orderId} status updated to: ${newStatus}`);
    } catch (error) {
        setMessage("Error updating order: " + error.message, "error");
    }
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
    details += `Status: ${order.status || "pending"}\n`;
    details += `Payment Method: ${order.paymentMethod || "N/A"}\n`;
    details += `Subtotal: ₹${Number(order.subtotal || 0).toLocaleString('en-IN')}\n`;
    details += `Tax: ₹${Number(order.tax || 0).toLocaleString('en-IN')}\n`;
    details += `Shipping: ₹${Number(order.shipping || 0).toLocaleString('en-IN')}\n`;
    details += `Total: ₹${Number(order.total || 0).toLocaleString('en-IN')}\n\n`;
    details += `Items:\n`;
    
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            details += `- ${item.name} x${item.qty} @ ₹${Number(item.price).toLocaleString('en-IN')}\n`;
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

                // Clear polling when user leaves the admin page
                window.addEventListener("beforeunload", () => {
                    if (ordersPollInterval) {
                        clearInterval(ordersPollInterval);
                    }
                });
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

    // Initialize tabs and product/order management
    initTabs();
    initCategorySelectors();
    initAddProductForm();

    // Load initial data
    await loadAllProducts();
    await loadOrders();

    // Poll for new orders every 8 seconds so admin sees recent bookings without manual refresh
    let ordersPollInterval = setInterval(async () => {
        try {
            await loadOrders();
        } catch (err) {
            // ignore polling errors
        }
    }, 8000);

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
});
