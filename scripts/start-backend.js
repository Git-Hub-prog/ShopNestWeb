const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = "127.0.0.1";

function isPortInUse(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });
  });
}

function checkHealth(port, host) {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: host,
        port,
        path: "/api/health",
        method: "GET",
        timeout: 1500
      },
      (response) => {
        let raw = "";

        response.on("data", (chunk) => {
          raw += chunk;
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            resolve(false);
            return;
          }

          try {
            const data = JSON.parse(raw || "{}");
            resolve(Boolean(data && data.ok));
          } catch (_error) {
            resolve(false);
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => {
      resolve(false);
    });

    request.end();
  });
}

function startBackendProcess() {
  const serverScript = path.join(__dirname, "..", "backend", "server.js");
  const child = spawn(process.execPath, [serverScript], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

(async () => {
  const inUse = await isPortInUse(PORT, HOST);

  if (!inUse) {
    startBackendProcess();
    return;
  }

  const healthyBackend = await checkHealth(PORT, HOST);

  if (healthyBackend) {
    console.log(`Backend is already running on http://localhost:${PORT}. Reusing existing server.`);
    process.exit(0);
    return;
  }

  console.error(`Port ${PORT} is already in use by another process. Stop that process, then run npm start again.`);
  process.exit(1);
})();
