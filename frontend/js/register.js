document.addEventListener("DOMContentLoaded", () => {
    const homeLogo = document.getElementById("home-logo");
    const passwordInput = document.getElementById("password");
    const strengthBar = document.getElementById("strength-bar");
    const strengthLabel = document.getElementById("strength-label");
    const form = document.getElementById("register-form");
    const errorMsg = document.getElementById("error-msg");
    const errorText = document.getElementById("error-text");
    const adminShortcut = document.getElementById("admin-shortcut");
    const adminShortcutBtn = document.getElementById("admin-shortcut-btn");

    function setupToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);

        if (!toggle || !input) {
            return;
        }

        toggle.addEventListener("click", () => {
            input.type = input.type === "password" ? "text" : "password";
            toggle.textContent = input.type === "password" ? "Show" : "Hide";
        });
    }

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

    setupToggle("toggle-pw1", "password");
    setupToggle("toggle-pw2", "confirm-password");

    if (!passwordInput || !strengthBar || !strengthLabel || !form || !errorMsg || !errorText) {
        return;
    }

    passwordInput.addEventListener("input", () => {
        const value = passwordInput.value;
        let strength = 0;

        if (value.length >= 6) strength += 1;
        if (value.length >= 10) strength += 1;
        if (/[A-Z]/.test(value)) strength += 1;
        if (/[0-9]/.test(value)) strength += 1;
        if (/[^A-Za-z0-9]/.test(value)) strength += 1;

        const colors = ["#c40000", "#f0a500", "#f0a500", "#2e7d32", "#2e7d32"];
        const labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
        const widths = ["20%", "40%", "60%", "80%", "100%"];

        if (value.length === 0) {
            strengthBar.style.width = "0";
            strengthLabel.textContent = "";
            return;
        }

        const index = Math.max(0, Math.min(strength - 1, 4));
        strengthBar.style.width = widths[index];
        strengthBar.style.backgroundColor = colors[index];
        strengthLabel.textContent = `Password strength: ${labels[index]}`;
        strengthLabel.style.color = colors[index];
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = document.getElementById("fullname").value.trim();
        const email = document.getElementById("mobile").value.trim();
        const password = passwordInput.value.trim();
        const confirm = document.getElementById("confirm-password").value.trim();
        errorMsg.style.display = "none";

        if (!name) {
            errorText.textContent = " Please enter your name.";
            errorMsg.style.display = "block";
            return;
        }

        if (!email) {
            errorText.textContent = " Please enter your email or mobile number.";
            errorMsg.style.display = "block";
            return;
        }

        if (password.length < 6) {
            errorText.textContent = " Passwords must be at least 6 characters.";
            errorMsg.style.display = "block";
            return;
        }

        if (password !== confirm) {
            errorText.textContent = " Passwords do not match. Please try again.";
            errorMsg.style.display = "block";
            return;
        }

        try {
            const data = await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            setCurrentUser(Object.assign({}, data.user, { sessionToken: data.sessionToken }));
            document.getElementById("register-box").style.display = "none";
            const successScreen = document.getElementById("success-screen");
            successScreen.style.display = "flex";
            successScreen.scrollIntoView({ behavior: "smooth" });
        } catch (error) {
            errorText.textContent = ` ${error.message}`;
            errorMsg.style.display = "block";
        }
    });
});
