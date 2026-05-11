document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("password");
    const strengthBar = document.getElementById("strength-bar");
    const strengthLabel = document.getElementById("strength-label");
    const form = document.getElementById("register-form");
    const errorMsg = document.getElementById("error-msg");
    const errorText = document.getElementById("error-text");
    const successScreen = document.getElementById("success-screen");
    const registerCard = document.getElementById("registerCard");
    const registerCardInner = document.getElementById("registerCardInner");
    const stayHereBtn = document.getElementById("stay-here-btn");

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

    setupToggle("toggle-pw1", "password");
    setupToggle("toggle-pw2", "confirm-password");

    if (stayHereBtn) {
        stayHereBtn.addEventListener("click", () => {
            if (successScreen) {
                successScreen.classList.remove("show");
            }
            if (registerCard) {
                registerCard.style.visibility = "visible";
            }
        });
    }

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
        errorMsg.classList.remove("show");

        if (!name) {
            errorText.textContent = "Please enter your name.";
            errorMsg.classList.add("show");
            return;
        }

        if (!email) {
            errorText.textContent = "Please enter your email or mobile number.";
            errorMsg.classList.add("show");
            return;
        }

        if (password.length < 6) {
            errorText.textContent = "Passwords must be at least 6 characters.";
            errorMsg.classList.add("show");
            return;
        }

        if (password !== confirm) {
            errorText.textContent = "Passwords do not match. Please try again.";
            errorMsg.classList.add("show");
            return;
        }

        try {
            const registerButton = document.getElementById("register-btn");
            if (registerButton) {
                registerButton.disabled = true;
                registerButton.textContent = "Creating account...";
            }

            const data = await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            setCurrentUser(Object.assign({}, data.user, { sessionToken: data.sessionToken }));
            // Redirect to home page after successful registration
            window.location.href = "index.html";
        } catch (error) {
            errorText.textContent = error.message || "Registration failed. Please try again.";
            errorMsg.classList.add("show");
        } finally {
            const registerButton = document.getElementById("register-btn");
            if (registerButton) {
                registerButton.disabled = false;
                registerButton.textContent = "Create your ShopNest account";
            }
        }
    });

    if (registerCardInner) {
        document.addEventListener("mousemove", (event) => {
            const rect = registerCardInner.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (event.clientX - cx) / (rect.width / 2);
            const dy = (event.clientY - cy) / (rect.height / 2);
            const rx = dy * -8;
            const ry = dx * 8;
            registerCardInner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
            registerCardInner.style.transition = 'transform 0.1s ease-out';
        });

        document.addEventListener("mouseleave", () => {
            registerCardInner.style.transform = '';
            registerCardInner.style.transition = 'transform 1s ease-out';
        });
    }
});
