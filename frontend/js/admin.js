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
    const data = await apiRequest("/admin/users");
    renderUsers(data.users || []);
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
