const prefix = "/__autora/api/v1";
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const readRoutes = [
  /^\/(status|bindings)$/,
  /^\/bindings\/[a-zA-Z0-9_-]+\/context$/,
  /^\/conversations\/[a-zA-Z0-9_-]+$/,
  /^\/turns\/[a-zA-Z0-9_-]+$/,
];
const writeRoutes = [
  /^\/(requirements|conversations)$/,
  /^\/conversations\/[a-zA-Z0-9_-]+\/turns$/,
  /^\/turns\/[a-zA-Z0-9_-]+\/cancel$/,
];

const respond = (res, status, code) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ error: { code } }));
};

// This bridge is registered only in the local Vite development server.
export function autoraLocalMiddleware(env, fetchUpstream = fetch) {
  return async (req, res, next) => {
    if (!req.url?.startsWith("/__autora/")) return next();
    res.setHeader("Cache-Control", "no-store");
    let incoming;
    try {
      incoming = new URL(req.url, `http://${req.headers.host}`);
      const address = req.socket.remoteAddress;
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) ||
        !localHosts.has(incoming.hostname) ||
        (req.headers.origin && req.headers.origin !== incoming.origin) ||
        req.headers["sec-fetch-site"] === "cross-site") {
        return respond(res, 403, "local_only");
      }
    } catch {
      return respond(res, 403, "local_only");
    }
    const route = incoming.pathname.slice(prefix.length);
    const allowed = incoming.pathname.startsWith(prefix) && !incoming.search &&
      ((req.method === "GET" && readRoutes.some((pattern) => pattern.test(route))) ||
        (req.method === "POST" && writeRoutes.some((pattern) => pattern.test(route))));
    if (!allowed) return respond(res, 404, "not_found");
    const token = env.AUTORA_ADMIN_TOKEN;
    if (!token) return respond(res, 503, "autora_not_configured");
    let upstream;
    try {
      upstream = new URL(env.AUTORA_LOCAL_URL || "http://127.0.0.1:8890");
      if (upstream.protocol !== "http:" || upstream.hostname !== "127.0.0.1" ||
        upstream.username || upstream.password || upstream.pathname !== "/" || upstream.search || upstream.hash) {
        return respond(res, 503, "autora_invalid_config");
      }
    } catch {
      return respond(res, 503, "autora_invalid_config");
    }
    const headers = { Authorization: `Bearer ${token}` };
    let body;
    if (req.method === "POST") {
      if (req.headers["content-type"]?.split(";")[0] !== "application/json" ||
        typeof req.headers["idempotency-key"] !== "string" ||
        !/^[a-zA-Z0-9_-]{1,200}$/.test(req.headers["idempotency-key"])) {
        return respond(res, 400, "invalid_request");
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 256 * 1024) return respond(res, 413, "body_too_large");
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
      headers["Content-Type"] = "application/json";
      headers["Idempotency-Key"] = req.headers["idempotency-key"];
    }
    try {
      const response = await fetchUpstream(`${upstream.origin}/api/v1${route}`, {
        method: req.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      const text = (await response.text()).replaceAll(token, "[redacted]");
      res.writeHead(response.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(text);
    } catch {
      respond(res, 503, "autora_unavailable");
    }
  };
}

export function autoraLocalPlugin(env) {
  return {
    name: "autora-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(autoraLocalMiddleware(env));
    },
  };
}
