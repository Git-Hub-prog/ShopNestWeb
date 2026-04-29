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

            setCurrentUser(Object.assign({}, data.user, { sessionToken: data.sessionToken }));
            document.getElementById("login-box").style.display = "none";
            document.getElementById("new-account-box").style.display = "none";
            const successScreen = document.getElementById("success-screen");
            successScreen.style.display = "flex";
            successScreen.scrollIntoView({ behavior: "smooth" });
        } catch (error) {
            errorText.textContent = ` ${error.message}`;
            errorMsg.style.display = "block";
        }
    });

    if (createAccountBtn) {
        createAccountBtn.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.href = "register.html";
        });
    }
});
