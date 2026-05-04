window.APP_CONFIG = window.APP_CONFIG || {};

window.APP_CONFIG.API_URL = "http://localhost:3000";

// If the page is opened from a different origin (e.g. Live Server at 127.0.0.1:5500)
// and a backend API URL is configured and reachable, redirect the browser to
// the backend origin so localStorage (session) is shared with the API origin.
(async () => {
	try {
		const apiUrl = (window.APP_CONFIG?.API_URL || "").trim().replace(/\/+$/, "");
		if (!apiUrl) return;
		const apiOrigin = new URL(apiUrl).origin;
		if (window.location.origin === apiOrigin) return; // already correct origin

		// probe backend health before redirecting to avoid redirect loops
		const healthUrl = `${apiUrl}/api/health`;
		const resp = await fetch(healthUrl, { cache: "no-store" });
		if (!resp.ok) return;

		// Map current path from /frontend/html/... to /html/... when switching origins
		let path = window.location.pathname;
		path = path.replace(/^\/frontend/, "");
		if (!path.startsWith("/")) path = "/" + path;

		const target = apiOrigin + path + window.location.search + window.location.hash;
		// only redirect if target differs (avoid unnecessary reloads)
		if (target !== window.location.href) {
			window.location.replace(target);
		}
	} catch (_e) {
		// ignore — don't break the site if backend isn't reachable
	}
})();