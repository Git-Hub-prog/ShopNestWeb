document.addEventListener("DOMContentLoaded", () => {
    const homeLogo = document.getElementById("home-logo");
    const toggleBtn = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("password");
    const form = document.getElementById("login-form");
    const errorMsg = document.getElementById("error-msg");
    const errorText = document.getElementById("error-text");
    const createAccountBtn = document.getElementById("create-account-btn");
    const adminShortcut = document.getElementById("admin-shortcut");
    const adminShortcutBtn = document.getElementById("admin-shortcut-btn");

    if (homeLogo) {
        homeLogo.addEventListener("click", () => {
            window.location.href = "index.html";
        });
    }

    if (adminShortcut && adminShortcutBtn && isLocalProjectHost()) {
        adminShortcut.hidden = false;
        adminShortcutBtn.addEventListener("click", () => {
            resumeAdminMode(getReturnPage("index.html"));
        });
    }

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener("click", () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                toggleBtn.textContent = "Hide";
            } else {
                passwordInput.type = "password";
                toggleBtn.textContent = "Show";
            }
        });
    }

    if (!form || !passwordInput || !errorMsg || !errorText) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = passwordInput.value.trim();
        errorMsg.style.display = "none";

        if (!email) {
            errorText.textContent = " Please enter your email or phone number.";
            errorMsg.style.display = "block";
            return;
        }

        if (!password) {
            errorText.textContent = " Please enter your password.";
            errorMsg.style.display = "block";
            return;
        }

        try {
            const data = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            // successful login — persist user and session
            setCurrentUser(Object.assign({}, data.user, { sessionToken: data.sessionToken }));
            document.getElementById("login-box").style.display = "none";
            document.getElementById("new-account-box").style.display = "none";
            const successScreen = document.getElementById("success-screen");
            successScreen.style.display = "flex";
            successScreen.scrollIntoView({ behavior: "smooth" });
        } catch (error) {
            // expose extra debug info in the console and on the page to help
            // diagnose why backend rejected the login (status + raw backend body)
            console.error("Login failed:", { message: error.message, status: error.status, raw: error.raw });
            errorText.textContent = ` ${error.message}`;
            errorMsg.style.display = "block";

            // show a compact debug block below the error for troubleshooting
            let dbg = document.getElementById("login-debug-raw");
            if (!dbg) {
                dbg = document.createElement("pre");
                dbg.id = "login-debug-raw";
                dbg.style.background = "#f8f8f8";
                dbg.style.border = "1px solid #e0e0e0";
                dbg.style.padding = "8px";
                dbg.style.marginTop = "12px";
                dbg.style.whiteSpace = "pre-wrap";
                dbg.style.maxWidth = "520px";
                dbg.style.overflowX = "auto";
                errorMsg.parentNode.insertBefore(dbg, errorMsg.nextSibling);
            }

            dbg.textContent = `status: ${error.status || "?"}\nbody: ${error.raw || "(no body)"}`;
        }
    });

    if (createAccountBtn) {
        createAccountBtn.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.href = "register.html";
        });
    }
});
