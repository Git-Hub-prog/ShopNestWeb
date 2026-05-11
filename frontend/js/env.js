window.APP_CONFIG = window.APP_CONFIG || {};

// For local development (localhost), use the local backend.
// For production, use the Render backend.
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
window.APP_CONFIG.API_URL = isLocalhost ? "" : "https://shopnestweb-backend.onrender.com";

// Keep the frontend on its current origin.
// API requests are routed through API_URL in api.js (or fallback to localhost if running locally).
