const API_URL = (window.APP_CONFIG?.API_URL || "").trim().replace(/\/+$/, "");

const API_BASE_URL = (() => {
    const { protocol, hostname, port, origin } = window.location;

    if (API_URL) {
        return `${API_URL}/api`;
    }

    if (port === "3000") {
        return `${origin}/api`;
    }

    if (protocol.startsWith("http") && hostname) {
        return `${origin}/api`;
    }

    return "http://localhost:3000/api";
})();

async function apiRequest(path, options = {}) {
    const currentUser = getCurrentUser();
    const requestHeaders = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (currentUser?.sessionToken && !requestHeaders["X-Session-Token"]) {
        requestHeaders["X-Session-Token"] = String(currentUser.sessionToken);
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            cache: "no-store",
            headers: requestHeaders,
            ...options
        });
    } catch (_error) {
        throw new Error("Unable to connect to the backend right now.");
    }

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    const data = contentType.includes("application/json") && rawText
        ? JSON.parse(rawText)
        : null;

    if (!response.ok) {
        const fallbackMessage = rawText
            ? rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : "Request failed.";

        throw new Error(data?.error || fallbackMessage || "Request failed.");
    }

    return data;
}

function getCurrentUser() {
    const raw = localStorage.getItem("amazon_current_user");
    return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
    localStorage.setItem("amazon_current_user", JSON.stringify(user));
}

function clearCurrentUser() {
    localStorage.removeItem("amazon_current_user");
}

function disableAutoAdmin() {
    localStorage.setItem("amazon_disable_auto_admin", "true");
}

function enableAutoAdmin() {
    localStorage.removeItem("amazon_disable_auto_admin");
}

function isAutoAdminDisabled() {
    return localStorage.getItem("amazon_disable_auto_admin") === "true";
}

function isLocalProjectHost() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function isAdminUser(user) {
    return Boolean(user && user.isAdmin);
}

function getReturnPage(defaultPath = "index.html") {
    const rawNext = new URLSearchParams(window.location.search).get("next");
    if (!rawNext) {
        return defaultPath;
    }

    const normalizedNext = rawNext.trim();
    if (!normalizedNext || normalizedNext.startsWith("http") || normalizedNext.startsWith("//")) {
        return defaultPath;
    }

    if (!/^[A-Za-z0-9._/?=&-]+$/.test(normalizedNext)) {
        return defaultPath;
    }

    return normalizedNext;
}

function resumeAdminMode(path = "index.html") {
    enableAutoAdmin();
    clearCurrentUser();
    window.location.href = path;
}

async function ensureCurrentUser() {
    const existingUser = getCurrentUser();
    return existingUser;
}

async function initializeSessionUI() {
    const user = await ensureCurrentUser();
    const greeting = document.getElementById("session-greeting");
    const role = document.getElementById("session-role");
    const actionButton = document.getElementById("session-action-btn");
    const dashboardLink = document.getElementById("admin-dashboard-link");
    const loginLinks = document.querySelectorAll(".nav-signin");

    if (!greeting || !role || !actionButton) {
        return user;
    }

    if (user) {
        const firstName = typeof user.name === "string" && user.name.trim()
            ? user.name.trim().split(" ")[0]
            : "User";
        greeting.textContent = `Hello, ${isAdminUser(user) ? "Admin" : firstName}`;
        role.textContent = isAdminUser(user) ? "Admin Access" : "Signed In";
        actionButton.textContent = isAdminUser(user) ? "Visitor Mode" : "Logout";

        if (dashboardLink) {
            // show dashboard link only for admin users
            dashboardLink.hidden = !isAdminUser(user);
            dashboardLink.style.display = isAdminUser(user) ? "inline-block" : "none";
        }

        // hide any elements marked as admin-only for non-admins
        document.querySelectorAll("[data-admin-only]").forEach((el) => {
            if (!isAdminUser(user)) {
                el.style.display = "none";
            } else {
                el.style.display = "";
            }
        });

        actionButton.onclick = () => {
            clearCurrentUser();
            if (isAdminUser(user)) {
                disableAutoAdmin();
                window.location.href = "login.html";
            } else {
                enableAutoAdmin();
                window.location.reload();
            }
        };

        loginLinks.forEach((element) => {
            element.style.display = "none";
        });
    } else {
        greeting.textContent = "Hello, guest";
        role.textContent = "Login Required";
        actionButton.textContent = "Login";
        if (dashboardLink) {
            dashboardLink.hidden = true;
            dashboardLink.style.display = "none";
        }

        // hide admin-only UI for visitors
        document.querySelectorAll("[data-admin-only]").forEach((el) => {
            el.style.display = "none";
        });
        actionButton.onclick = () => {
            disableAutoAdmin();
            window.location.href = "login.html";
        };
    }

    return user;
}
