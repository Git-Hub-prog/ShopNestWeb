document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("password");
    const form = document.getElementById("login-form");
    const errorMsg = document.getElementById("error-msg");
    const errorText = document.getElementById("error-text");
    const signinBtn = document.getElementById("signin-btn");
    const homeBtn = document.getElementById("home-btn");
    const successScreen = document.getElementById("success-screen");

    // Toggle password visibility
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

    // Handle home button on success screen
    if (homeBtn) {
        homeBtn.addEventListener("click", () => {
            window.location.href = "index.html";
        });
    }

    if (!form || !passwordInput || !errorMsg || !errorText) {
        return;
    }

    // Handle login form submission
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = passwordInput.value.trim();
        errorMsg.classList.remove("show");

        // Validation
        if (!email) {
            errorText.textContent = "Please enter your email address.";
            errorMsg.classList.add("show");
            return;
        }

        if (!password) {
            errorText.textContent = "Please enter your password.";
            errorMsg.classList.add("show");
            return;
        }

        try {
            // Show loading state
            signinBtn.textContent = "Signing in...";
            signinBtn.disabled = true;

            // Call login API
            const data = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            // Successful login - persist user and session token
            setCurrentUser(Object.assign({}, data.user, { sessionToken: data.sessionToken }));

            // Show success screen
            if (successScreen) {
                successScreen.classList.add("show");
                // Redirect to the home page after a short confirmation delay
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 900);
            }
        } catch (error) {
            console.error("Login failed:", { 
                message: error.message, 
                status: error.status, 
                raw: error.raw 
            });

            // Show error message
            errorText.textContent = error.message || "Login failed. Please try again.";
            errorMsg.classList.add("show");

            // Restore button state
            signinBtn.textContent = "Sign In";
            signinBtn.disabled = false;
        }
    });
});
